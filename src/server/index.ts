import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import ExcelJS from "exceljs";
import multer from "multer";
import { z } from "zod";
import {
  attachSession,
  clearSessionCookie,
  requireAdmin,
  requireAuth,
  requireStudentContext,
  setSessionCookie,
  signSession
} from "./auth";
import { auditLog } from "./audit";
import { config } from "./config";
import { prisma } from "./db";
import { ApiError, asyncHandler, errorHandler } from "./errors";
import { parseWorkbook } from "./importValidation";

fs.mkdirSync(config.uploadDir, { recursive: true });

const app = express();
const upload = multer({ dest: config.uploadDir });

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(attachSession);

const loginSchema = z.object({ username: z.string(), password: z.string() });
const userSchema = z.object({
  name: z.string().min(1),
  username: z.string().min(3),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "STUDENT"]).default("STUDENT")
});
const updateUserSchema = z.object({
  name: z.string().min(1),
  username: z.string().min(3),
  role: z.enum(["ADMIN", "STUDENT"]),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional()
});
const resetPasswordSchema = z.object({ password: z.string().min(8) });
const profileSchema = z.object({
  name: z.string().min(1),
  username: z.string().min(3)
});
const profilePasswordSchema = z.object({
  password: z.string().min(8),
  logoutAllDevices: z.boolean().default(false),
  stayLoggedIn: z.boolean().default(true)
});
const activeImportsSchema = z.object({ importIds: z.array(z.string()) });
const mockCreateSchema = z.object({
  questionCount: z.number().int().min(10).max(100),
  durationMinutes: z.number().int().min(5).max(120)
});
const answerSchema = z.object({ answer: z.enum(["A", "B", "C", "D"]) });

function publicUser(user: { id: string; name: string; username: string; role: string; status?: string }) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    status: user.status
  };
}

async function assertUniqueUsername(username: string, exceptUserId?: string) {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing && existing.id !== exceptUserId) {
    throw new ApiError(409, "USERNAME_TAKEN", "That email is already in use.");
  }
}

async function activeImportIds(userId: string) {
  const active = await prisma.userActiveImport.findMany({
    where: { userId, import: { status: "ACTIVE" } },
    select: { importId: true }
  });
  return active.map((row) => row.importId);
}

function removeUploadedFile(filePath: string) {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

async function validateUploadedWorkbook(filePath: string, userId: string) {
  const parsed = await parseWorkbook(filePath);
  if (!parsed.ok) return parsed;

  const existing = await prisma.question.findMany({
    where: {
      ownerUserId: userId,
      normalizedDuplicateKey: { in: parsed.questions.map((q) => q.duplicateKey) }
    },
    select: { normalizedDuplicateKey: true }
  });
  if (existing.length > 0) {
    return {
      ok: false as const,
      checksum: parsed.checksum,
      rowCount: parsed.rowCount,
      errors: ["Import contains questions already in your bank."]
    };
  }

  return parsed;
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/auth/login", asyncHandler(async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { username: input.username } });
  if (!user || user.status !== "ACTIVE") {
    throw new ApiError(401, "INVALID_LOGIN", "Invalid username or password.");
  }
  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw new ApiError(401, "INVALID_LOGIN", "Invalid username or password.");
  setSessionCookie(res, signSession(user.id, user.sessionVersion));
  res.json({ user: publicUser(user), effectiveUser: publicUser(user) });
}));

app.post("/api/auth/logout", requireAuth, asyncHandler(async (req, res) => {
  if (req.emulatedUserId && req.actor) {
    await auditLog({
      actorUserId: req.actor.id,
      targetUserId: req.emulatedUserId,
      action: "EMULATION_STOP",
      entityType: "user",
      entityId: req.emulatedUserId
    });
  }
  clearSessionCookie(res);
  res.json({ ok: true });
}));

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({
    user: req.actor,
    effectiveUser: req.effectiveUser,
    emulating: Boolean(req.emulatedUserId)
  });
});

app.get("/api/admin/users", requireAuth, requireAdmin, asyncHandler(async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ users: users.map(publicUser) });
}));

app.post("/api/admin/users", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const input = userSchema.parse(req.body);
  await assertUniqueUsername(input.username);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      username: input.username,
      role: input.role,
      passwordHash: await bcrypt.hash(input.password, 12)
    }
  });
  await auditLog({
    actorUserId: req.actor!.id,
    targetUserId: user.id,
    action: "USER_CREATE",
    entityType: "user",
    entityId: user.id,
    metadata: { role: user.role }
  });
  res.status(201).json({ user: publicUser(user) });
}));

app.patch("/api/admin/users/:id", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const input = updateUserSchema.parse(req.body);
  await assertUniqueUsername(input.username, req.params.id);
  const user = await prisma.user.update({ where: { id: req.params.id }, data: input });
  await auditLog({
    actorUserId: req.actor!.id,
    targetUserId: user.id,
    action: "USER_UPDATE",
    entityType: "user",
    entityId: user.id,
    metadata: input
  });
  res.json({ user: publicUser(user) });
}));

app.post("/api/admin/users/:id/reset-password", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const input = resetPasswordSchema.parse(req.body);
  await prisma.user.update({
    where: { id: req.params.id },
    data: { passwordHash: await bcrypt.hash(input.password, 12), sessionVersion: { increment: 1 } }
  });
  await auditLog({
    actorUserId: req.actor!.id,
    targetUserId: req.params.id,
    action: "PASSWORD_RESET",
    entityType: "user",
    entityId: req.params.id
  });
  res.json({ ok: true });
}));

app.patch("/api/profile", requireAuth, asyncHandler(async (req, res) => {
  const input = profileSchema.parse(req.body);
  await assertUniqueUsername(input.username, req.actor!.id);
  const user = await prisma.user.update({
    where: { id: req.actor!.id },
    data: input
  });
  await auditLog({
    actorUserId: req.actor!.id,
    targetUserId: req.actor!.id,
    action: "PROFILE_UPDATE",
    entityType: "user",
    entityId: req.actor!.id,
    metadata: input
  });
  res.json({ user: publicUser(user) });
}));

app.post("/api/profile/password", requireAuth, asyncHandler(async (req, res) => {
  const input = profilePasswordSchema.parse(req.body);
  const user = await prisma.user.update({
    where: { id: req.actor!.id },
    data: {
      passwordHash: await bcrypt.hash(input.password, 12),
      ...(input.logoutAllDevices ? { sessionVersion: { increment: 1 } } : {})
    }
  });
  await auditLog({
    actorUserId: req.actor!.id,
    targetUserId: req.actor!.id,
    action: "PASSWORD_CHANGE",
    entityType: "user",
    entityId: req.actor!.id,
    metadata: { logoutAllDevices: input.logoutAllDevices }
  });
  if (input.logoutAllDevices && input.stayLoggedIn) {
    setSessionCookie(res, signSession(user.id, user.sessionVersion));
  } else if (input.logoutAllDevices) {
    clearSessionCookie(res);
  }
  res.json({ ok: true, loggedIn: !(input.logoutAllDevices && !input.stayLoggedIn) });
}));

app.get("/api/admin/imports", requireAuth, requireAdmin, asyncHandler(async (_req, res) => {
  const imports = await prisma.questionBankImport.findMany({
    include: { owner: { select: { id: true, name: true, username: true } } },
    orderBy: { createdAt: "desc" }
  });
  res.json({ imports });
}));

app.post("/api/admin/imports/:id/inactivate", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const updated = await prisma.questionBankImport.update({
    where: { id: req.params.id },
    data: { status: "INACTIVE", inactivatedBy: req.actor!.id, inactivatedAt: new Date() }
  });
  await prisma.userActiveImport.deleteMany({ where: { importId: updated.id } });
  await auditLog({
    actorUserId: req.actor!.id,
    targetUserId: updated.ownerUserId,
    action: "IMPORT_INACTIVATE",
    entityType: "import",
    entityId: updated.id
  });
  res.json({ import: updated });
}));

app.post("/api/admin/emulation/:studentId/start", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.studentId } });
  if (!target || target.role !== "STUDENT" || target.status !== "ACTIVE") {
    throw new ApiError(404, "STUDENT_NOT_FOUND", "Active student not found.");
  }
  await auditLog({
    actorUserId: req.actor!.id,
    targetUserId: target.id,
    action: "EMULATION_START",
    entityType: "user",
    entityId: target.id
  });
  setSessionCookie(res, signSession(req.actor!.id, req.actor!.sessionVersion, target.id));
  res.json({ effectiveUser: publicUser(target) });
}));

app.post("/api/admin/emulation/stop", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  if (req.emulatedUserId) {
    await auditLog({
      actorUserId: req.actor!.id,
      targetUserId: req.emulatedUserId,
      action: "EMULATION_STOP",
      entityType: "user",
      entityId: req.emulatedUserId
    });
  }
  setSessionCookie(res, signSession(req.actor!.id, req.actor!.sessionVersion));
  res.json({ effectiveUser: req.actor });
}));

app.get("/api/imports/template", requireAuth, requireStudentContext, asyncHandler(async (_req, res) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Questions");
  sheet.columns = [
    { header: "question", key: "question" },
    { header: "option A", key: "optionA" },
    { header: "option B", key: "optionB" },
    { header: "option C", key: "optionC" },
    { header: "option D", key: "optionD" },
    { header: "correct answer", key: "correctAnswer" },
    { header: "explanation", key: "explanation" },
    { header: "topic", key: "topic" },
    { header: "syllabus", key: "syllabus" },
    { header: "category", key: "category" }
  ];
  sheet.addRow({
    question: "Which option is correct?",
    optionA: "First",
    optionB: "Second",
    optionC: "Third",
    optionD: "Fourth",
    correctAnswer: "A",
    explanation: "Why A is correct",
    topic: "Sample topic",
    syllabus: "Sample syllabus",
    category: "Sample category"
  });
  const data = await workbook.xlsx.writeBuffer();
  res.setHeader("Content-Disposition", "attachment; filename=question-bank-template.xlsx");
  res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").send(Buffer.from(data));
}));

app.get("/api/imports", requireAuth, requireStudentContext, asyncHandler(async (req, res) => {
  const imports = await prisma.questionBankImport.findMany({
    where: { ownerUserId: req.effectiveUser!.id },
    orderBy: { createdAt: "desc" }
  });
  const active = await activeImportIds(req.effectiveUser!.id);
  res.json({ imports, activeImportIds: active });
}));

app.post("/api/imports/validate", requireAuth, requireStudentContext, upload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400).json({ valid: false, errors: ["Excel file is required."] });
    return;
  }

  const parsed = await validateUploadedWorkbook(req.file.path, req.effectiveUser!.id)
    .finally(() => removeUploadedFile(req.file!.path));

  if (!parsed.ok) {
    res.json({ valid: false, errors: parsed.errors });
    return;
  }

  res.json({
    valid: true,
    rowCount: parsed.rowCount,
    questionCount: parsed.questions.length,
    checksum: parsed.checksum
  });
}));

app.post("/api/imports", requireAuth, requireStudentContext, upload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "FILE_REQUIRED", "Excel file is required.");
  const label = String(req.body.label || req.file.originalname);
  const parsed = await validateUploadedWorkbook(req.file.path, req.effectiveUser!.id);
  if (!parsed.ok) {
    removeUploadedFile(req.file.path);
    throw new ApiError(400, "IMPORT_VALIDATION_FAILED", "Import validation failed.", parsed.errors);
  }

  const finalPath = path.join(config.uploadDir, `${parsed.checksum}-${req.file.originalname}`);
  fs.renameSync(req.file.path, finalPath);

  const result = await prisma.$transaction(async (tx) => {
    const importRow = await tx.questionBankImport.create({
      data: {
        ownerUserId: req.effectiveUser!.id,
        label,
        syllabus: req.body.syllabus || null,
        questionType: req.body.questionType || null,
        originalFilePath: finalPath,
        checksum: parsed.checksum,
        rowCount: parsed.rowCount,
        questionCount: parsed.questions.length
      }
    });
    await tx.question.createMany({
      data: parsed.questions.map((question) => ({
        importId: importRow.id,
        ownerUserId: req.effectiveUser!.id,
        questionText: question.questionText,
        optionA: question.optionA,
        optionB: question.optionB,
        optionC: question.optionC,
        optionD: question.optionD,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        topic: question.topic,
        syllabus: question.syllabus ?? req.body.syllabus ?? null,
        category: question.category ?? req.body.questionType ?? null,
        normalizedDuplicateKey: question.duplicateKey
      }))
    });
    const activeCount = await tx.userActiveImport.count({
      where: { userId: req.effectiveUser!.id }
    });
    if (activeCount === 0) {
      await tx.userActiveImport.create({
        data: { userId: req.effectiveUser!.id, importId: importRow.id }
      });
    }
    return importRow;
  });

  res.status(201).json({ import: result });
}));

app.patch("/api/imports/:id/inactivate", requireAuth, requireStudentContext, asyncHandler(async (req, res) => {
  const importRow = await prisma.questionBankImport.findFirst({
    where: { id: req.params.id, ownerUserId: req.effectiveUser!.id }
  });
  if (!importRow) throw new ApiError(404, "IMPORT_NOT_FOUND", "Import not found.");
  const updated = await prisma.questionBankImport.update({
    where: { id: importRow.id },
    data: {
      status: "INACTIVE",
      inactivatedBy: req.actor!.id,
      inactivatedAt: new Date()
    }
  });
  await prisma.userActiveImport.deleteMany({ where: { importId: updated.id } });
  res.json({ import: updated });
}));

app.put("/api/imports/active", requireAuth, requireStudentContext, asyncHandler(async (req, res) => {
  const input = activeImportsSchema.parse(req.body);
  const count = await prisma.questionBankImport.count({
    where: { id: { in: input.importIds }, ownerUserId: req.effectiveUser!.id, status: "ACTIVE" }
  });
  if (count !== input.importIds.length) {
    throw new ApiError(400, "INVALID_ACTIVE_IMPORTS", "Only your active imports can be selected.");
  }
  await prisma.$transaction([
    prisma.userActiveImport.deleteMany({ where: { userId: req.effectiveUser!.id } }),
    ...input.importIds.map((importId) =>
      prisma.userActiveImport.create({ data: { userId: req.effectiveUser!.id, importId } })
    )
  ]);
  res.json({ activeImportIds: input.importIds });
}));

app.get("/api/questions", requireAuth, requireStudentContext, asyncHandler(async (req, res) => {
  const importIds = await activeImportIds(req.effectiveUser!.id);
  const search = String(req.query.search ?? "").trim();
  const activeImportCount = importIds.length;
  const where = {
    ownerUserId: req.effectiveUser!.id,
    importId: { in: importIds },
    import: { status: "ACTIVE" as const },
    ...(search
      ? { questionText: { contains: search, mode: "insensitive" as const } }
      : {})
  };
  const [questions, totalCount] = await Promise.all([
    prisma.question.findMany({
      where,
      include: { import: { select: { id: true, label: true, createdAt: true } } },
      take: 100,
      orderBy: { id: "asc" }
    }),
    prisma.question.count({ where })
  ]);
  res.json({ questions, totalCount, activeImportCount });
}));

app.get("/api/practice/next", requireAuth, requireStudentContext, asyncHandler(async (req, res) => {
  const importIds = await activeImportIds(req.effectiveUser!.id);
  const questions = await prisma.question.findMany({
    where: { ownerUserId: req.effectiveUser!.id, importId: { in: importIds }, import: { status: "ACTIVE" } },
    take: 50
  });
  if (questions.length === 0) throw new ApiError(404, "NO_ACTIVE_QUESTIONS", "No active questions available.");
  const question = questions[Math.floor(Math.random() * questions.length)];
  res.json({ question });
}));

app.post("/api/practice/:questionId/answer", requireAuth, requireStudentContext, asyncHandler(async (req, res) => {
  const input = answerSchema.parse(req.body);
  const question = await prisma.question.findFirst({
    where: { id: req.params.questionId, ownerUserId: req.effectiveUser!.id, import: { status: "ACTIVE" } }
  });
  if (!question) throw new ApiError(404, "QUESTION_NOT_FOUND", "Question not found.");
  res.json({
    selectedAnswer: input.answer,
    correctAnswer: question.correctAnswer,
    isCorrect: input.answer === question.correctAnswer,
    explanation: question.explanation
  });
}));

app.post("/api/mock-attempts", requireAuth, requireStudentContext, asyncHandler(async (req, res) => {
  const input = mockCreateSchema.parse(req.body);
  const importIds = await activeImportIds(req.effectiveUser!.id);
  const available = await prisma.question.findMany({
    where: { ownerUserId: req.effectiveUser!.id, importId: { in: importIds }, import: { status: "ACTIVE" } },
    select: { id: true }
  });
  if (available.length < input.questionCount) {
    throw new ApiError(400, "INSUFFICIENT_QUESTIONS", `Only ${available.length} active questions are available.`);
  }
  const shuffled = available.sort(() => Math.random() - 0.5).slice(0, input.questionCount);
  const attempt = await prisma.mockAttempt.create({
    data: {
      userId: req.effectiveUser!.id,
      requestedQuestionCount: input.questionCount,
      durationMinutes: input.durationMinutes,
      questions: {
        create: shuffled.map((q, index) => ({
          questionId: q.id,
          displayOrder: index + 1
        }))
      }
    },
    include: { questions: { include: { question: true }, orderBy: { displayOrder: "asc" } } }
  });
  res.status(201).json({ attempt });
}));

app.get("/api/mock-attempts", requireAuth, requireStudentContext, asyncHandler(async (req, res) => {
  const attempts = await prisma.mockAttempt.findMany({
    where: { userId: req.effectiveUser!.id },
    orderBy: { startedAt: "desc" },
    take: 50
  });
  res.json({ attempts });
}));

app.get("/api/mock-attempts/:id", requireAuth, requireStudentContext, asyncHandler(async (req, res) => {
  const attempt = await prisma.mockAttempt.findFirst({
    where: { id: req.params.id, userId: req.effectiveUser!.id },
    include: { questions: { include: { question: true }, orderBy: { displayOrder: "asc" } } }
  });
  if (!attempt) throw new ApiError(404, "ATTEMPT_NOT_FOUND", "Attempt not found.");
  res.json({ attempt });
}));

app.post("/api/mock-attempts/:id/answers/:questionId", requireAuth, requireStudentContext, asyncHandler(async (req, res) => {
  const input = answerSchema.parse(req.body);
  const attempt = await prisma.mockAttempt.findFirst({
    where: { id: req.params.id, userId: req.effectiveUser!.id }
  });
  if (!attempt || attempt.submittedAt) throw new ApiError(400, "ATTEMPT_CLOSED", "Attempt is not open.");
  const question = await prisma.question.findUnique({ where: { id: req.params.questionId } });
  if (!question || question.ownerUserId !== req.effectiveUser!.id) {
    throw new ApiError(404, "QUESTION_NOT_FOUND", "Question not found.");
  }
  const updated = await prisma.mockAttemptQuestion.update({
    where: { attemptId_questionId: { attemptId: attempt.id, questionId: question.id } },
    data: { selectedAnswer: input.answer, isCorrect: input.answer === question.correctAnswer }
  });
  res.json({ answer: updated });
}));

app.post("/api/mock-attempts/:id/extend", requireAuth, requireStudentContext, asyncHandler(async (req, res) => {
  const attempt = await prisma.mockAttempt.findFirst({
    where: { id: req.params.id, userId: req.effectiveUser!.id }
  });
  if (!attempt || attempt.submittedAt) throw new ApiError(400, "ATTEMPT_CLOSED", "Attempt is not open.");
  if (attempt.extensionUsed) throw new ApiError(400, "EXTENSION_ALREADY_USED", "The 5-minute extension was already used.");
  const updated = await prisma.mockAttempt.update({
    where: { id: attempt.id },
    data: { extensionUsed: true, durationMinutes: attempt.durationMinutes + 5 }
  });
  res.json({ attempt: updated });
}));

app.post("/api/mock-attempts/:id/submit", requireAuth, requireStudentContext, asyncHandler(async (req, res) => {
  const attempt = await prisma.mockAttempt.findFirst({
    where: { id: req.params.id, userId: req.effectiveUser!.id },
    include: { questions: true }
  });
  if (!attempt) throw new ApiError(404, "ATTEMPT_NOT_FOUND", "Attempt not found.");
  if (attempt.submittedAt) throw new ApiError(400, "ATTEMPT_ALREADY_SUBMITTED", "Attempt is already submitted.");
  const attemptedCount = attempt.questions.filter((q) => q.selectedAnswer).length;
  const correctCount = attempt.questions.filter((q) => q.isCorrect).length;
  const incorrectCount = attemptedCount - correctCount;
  const scorePercent = attempt.questions.length === 0 ? 0 : (correctCount / attempt.questions.length) * 100;
  const updated = await prisma.mockAttempt.update({
    where: { id: attempt.id },
    data: { submittedAt: new Date(), attemptedCount, correctCount, incorrectCount, scorePercent },
    include: { questions: { include: { question: true }, orderBy: { displayOrder: "asc" } } }
  });
  res.json({ attempt: updated });
}));

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});
