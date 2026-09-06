-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'STUDENT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "Answer" AS ENUM ('A', 'B', 'C', 'D');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_bank_imports" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "syllabus" TEXT,
    "question_type" TEXT,
    "original_file_path" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "row_count" INTEGER NOT NULL,
    "question_count" INTEGER NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inactivated_by" TEXT,
    "inactivated_at" TIMESTAMP(3),

    CONSTRAINT "question_bank_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "import_id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "option_a" TEXT NOT NULL,
    "option_b" TEXT NOT NULL,
    "option_c" TEXT NOT NULL,
    "option_d" TEXT NOT NULL,
    "correct_answer" "Answer" NOT NULL,
    "explanation" TEXT,
    "topic" TEXT,
    "syllabus" TEXT,
    "category" TEXT,
    "normalized_duplicate_key" TEXT NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_active_imports" (
    "user_id" TEXT NOT NULL,
    "import_id" TEXT NOT NULL,

    CONSTRAINT "user_active_imports_pkey" PRIMARY KEY ("user_id","import_id")
);

-- CreateTable
CREATE TABLE "mock_attempts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "requested_question_count" INTEGER NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "extension_used" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "attempted_count" INTEGER NOT NULL DEFAULT 0,
    "correct_count" INTEGER NOT NULL DEFAULT 0,
    "incorrect_count" INTEGER NOT NULL DEFAULT 0,
    "score_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "mock_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mock_attempt_questions" (
    "attempt_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "selected_answer" "Answer",
    "is_correct" BOOLEAN,

    CONSTRAINT "mock_attempt_questions_pkey" PRIMARY KEY ("attempt_id","question_id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "target_user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "question_bank_imports_owner_user_id_status_idx" ON "question_bank_imports"("owner_user_id", "status");

-- CreateIndex
CREATE INDEX "questions_owner_user_id_import_id_idx" ON "questions"("owner_user_id", "import_id");

-- CreateIndex
CREATE UNIQUE INDEX "questions_owner_user_id_normalized_duplicate_key_key" ON "questions"("owner_user_id", "normalized_duplicate_key");

-- CreateIndex
CREATE INDEX "mock_attempts_user_id_started_at_idx" ON "mock_attempts"("user_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "mock_attempt_questions_attempt_id_display_order_key" ON "mock_attempt_questions"("attempt_id", "display_order");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "question_bank_imports" ADD CONSTRAINT "question_bank_imports_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "question_bank_imports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_active_imports" ADD CONSTRAINT "user_active_imports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_active_imports" ADD CONSTRAINT "user_active_imports_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "question_bank_imports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mock_attempts" ADD CONSTRAINT "mock_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mock_attempt_questions" ADD CONSTRAINT "mock_attempt_questions_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "mock_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mock_attempt_questions" ADD CONSTRAINT "mock_attempt_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
