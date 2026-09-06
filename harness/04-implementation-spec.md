# Implementation Spec

- Frontend: Vite React in `src/web`.
- Backend: Express API in `src/server`.
- Database: Prisma schema targeting PostgreSQL in `prisma/schema.prisma`.
- Auth: bcrypt password hashes and HTTP-only JWT session cookie.
- Uploads: retained under `UPLOAD_DIR` with SHA-256 checksum in import metadata.
- Tests: Vitest unit coverage for Excel validation.
