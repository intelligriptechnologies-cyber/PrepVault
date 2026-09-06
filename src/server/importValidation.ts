import crypto from "node:crypto";
import fs from "node:fs";
import ExcelJS from "exceljs";

export type ParsedQuestion = {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: "A" | "B" | "C" | "D";
  explanation?: string;
  topic?: string;
  syllabus?: string;
  category?: string;
  duplicateKey: string;
};

export type ImportValidationResult =
  | { ok: true; checksum: string; rowCount: number; questions: ParsedQuestion[] }
  | { ok: false; checksum: string; rowCount: number; errors: string[] };

const columnAliases = {
  question: ["question", "question text", "question_text"],
  optionA: ["option a", "option_a", "a"],
  optionB: ["option b", "option_b", "b"],
  optionC: ["option c", "option_c", "c"],
  optionD: ["option d", "option_d", "d"],
  correctAnswer: ["correct answer", "correct_answer", "answer"],
  explanation: ["explanation"],
  topic: ["topic", "chapter"],
  syllabus: ["syllabus"],
  category: ["category", "type", "question type"]
} as const;

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function value(row: Record<string, unknown>, aliases: readonly string[]) {
  const key = Object.keys(row).find((candidate) =>
    aliases.includes(normalizeHeader(candidate))
  );
  const raw = key ? row[key] : undefined;
  return raw == null ? "" : String(raw).trim();
}

export function duplicateKey(parts: {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
}) {
  return [
    parts.questionText,
    parts.optionA,
    parts.optionB,
    parts.optionC,
    parts.optionD
  ]
    .map((part) => part.trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}

export async function parseWorkbook(filePath: string): Promise<ImportValidationResult> {
  const buffer = fs.readFileSync(filePath);
  const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const firstSheet = workbook.worksheets[0];
  const headerRow = firstSheet?.getRow(1);
  const headers = (headerRow?.values as unknown[])
    ?.slice(1)
    .map((cell) => String(cell ?? ""))
    ?? [];
  const rows: Record<string, unknown>[] = [];
  firstSheet?.eachRow((sheetRow, rowNumber) => {
    if (rowNumber === 1) return;
    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      row[header] = sheetRow.getCell(index + 1).text;
    });
    rows.push(row);
  });
  const errors: string[] = [];
  const normalizedHeaders = headers.map(normalizeHeader);

  for (const [name, aliases] of Object.entries(columnAliases)) {
    if (["explanation", "topic", "syllabus", "category"].includes(name)) continue;
    if (!normalizedHeaders.some((header) => (aliases as readonly string[]).includes(header))) {
      errors.push(`Missing required column: ${aliases[0]}`);
    }
  }

  const seen = new Set<string>();
  const questions: ParsedQuestion[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const questionText = value(row, columnAliases.question);
    const optionA = value(row, columnAliases.optionA);
    const optionB = value(row, columnAliases.optionB);
    const optionC = value(row, columnAliases.optionC);
    const optionD = value(row, columnAliases.optionD);
    const correctAnswer = value(row, columnAliases.correctAnswer).toUpperCase();
    const required = { questionText, optionA, optionB, optionC, optionD };

    for (const [field, fieldValue] of Object.entries(required)) {
      if (!fieldValue) errors.push(`Row ${rowNumber}: ${field} is required.`);
    }

    if (!["A", "B", "C", "D"].includes(correctAnswer)) {
      errors.push(`Row ${rowNumber}: correct answer must be A, B, C, or D.`);
    }

    const key = duplicateKey(required);
    if (seen.has(key)) errors.push(`Row ${rowNumber}: duplicate question in file.`);
    seen.add(key);

    questions.push({
      ...required,
      correctAnswer: correctAnswer as "A" | "B" | "C" | "D",
      explanation: value(row, columnAliases.explanation) || undefined,
      topic: value(row, columnAliases.topic) || undefined,
      syllabus: value(row, columnAliases.syllabus) || undefined,
      category: value(row, columnAliases.category) || undefined,
      duplicateKey: key
    });
  });

  if (errors.length > 0) return { ok: false, checksum, rowCount: rows.length, errors };
  return { ok: true, checksum, rowCount: rows.length, questions };
}
