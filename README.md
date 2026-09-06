# PrepVault

PrepVault is a production-oriented MCQ preparation platform for maintaining a private question bank, practicing active questions, and running timed mock tests. It is built for coaching centers, exam-prep teams, and internal training groups that need controlled question imports, student-specific configuration, and admin oversight.

## Product Goal

PrepVault helps learners move from raw question-bank files to measurable practice outcomes:

- Admins create and manage users.
- Students import structured Excel question banks.
- Students choose which imports are active for study.
- Browse, Practice, and Mock flows reuse only active questions.
- Mock history and summaries make progress visible over time.

## Core Capabilities

- Role-based access for admins and students.
- Admin user management with edit, status, role, and password reset.
- Admin student emulation for support and verification.
- Profile self-service for name, email, and password updates.
- Session invalidation through `sessionVersion` when passwords change.
- Excel import validation before committing questions.
- Duplicate-question prevention per question owner.
- Active-import selection for controlling study scope.
- Searchable question browsing with correct-answer highlighting.
- Random practice with previous/next visited-question navigation.
- Timed mock tests with extensions, submission scoring, history, and PNG summary download.

## User Flows

### Admin Flow

1. Log in with an admin account.
2. Open Admin from the header.
3. Create users with name, email, role, and temporary password.
4. Search users and select a user to inspect their imports.
5. Edit a user to update name, email, role, status, or reset password.
6. Emulate an active student to inspect their student experience.
7. Stop emulation to return to the admin actor session.

### Student Import Flow

1. Log in with a student account, or as an admin emulating a student.
2. Open Imports.
3. Download the sample Excel template if needed.
4. Choose a workbook and enter label, syllabus, and question type.
5. Validate the file.
6. Import only after validation passes.
7. Review active imports in Configuration.

### Study Flow

1. Open Configuration and select the imports that should be active.
2. Use Browse to search active questions and inspect details.
3. Use Practice for random questions from the active set.
4. Move backward and forward through visited practice questions.
5. Use Mock to start a timed attempt from the active set.
6. Submit the mock to see score, attempted count, and incorrect count.
7. Download a PNG score summary or return to Mock Home.

### Profile Flow

1. Open Profile from the header.
2. Update name or email.
3. Change password.
4. Choose whether to stay logged in with a refreshed session or log out all devices.

## Tech Stack

- React and Vite for the web client.
- Express for the API.
- Prisma with PostgreSQL for persistence.
- JWT cookie sessions.
- ExcelJS for workbook parsing.
- Vitest for automated tests.

## Local Setup

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL:

```bash
docker compose up -d postgres
```

3. Install dependencies:

```bash
npm install
```

4. Run migrations and seed data:

```bash
npm run prisma:migrate
npm run seed
```

5. Start the app:

```bash
npm run dev
```

Frontend: `http://localhost:5173`

API health check: `http://localhost:4000/api/health`

The bundled Compose file maps PostgreSQL to host port `5433` to avoid common conflicts with a local PostgreSQL install.

## Seed Users

- Admin: `admin@example.com` / `AdminPass123!`
- Student: `student@example.com` / `StudentPass123!`

## Import Workbook Format

Required columns:

- `question`
- `option A`
- `option B`
- `option C`
- `option D`
- `correct answer`

Optional columns:

- `explanation`
- `topic`
- `syllabus`
- `category`

Correct answers must be one of `A`, `B`, `C`, or `D`.

## Verification

```bash
npm test
npm run build
```

## Production Notes

- Set a long random `JWT_SECRET`.
- Put the Vite build and API behind one same-origin reverse proxy.
- Point `DATABASE_URL` to PostgreSQL and run Prisma migrations during deploy.
- Persist and back up both PostgreSQL and `UPLOAD_DIR`.
- Restrict filesystem permissions on `UPLOAD_DIR` to the API process.
- Keep `.env`, uploads, dependencies, and build output out of Git.
