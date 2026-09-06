# Decisions Ledger

- D-1 | Web app with React frontend and Node.js API | Desktop-only/local scripts rejected | Matches explicit product default.
- D-2 | Prisma data model targets PostgreSQL | Ad hoc SQL rejected | Keeps migrations and ownership constraints explicit.
- D-3 | HTTP-only JWT cookie sessions | Local storage tokens rejected | Reduces token exposure in browser code.
- D-4 | Admin emulation changes effective user while preserving actor | Shared passwords rejected | Supports audited support without exposing credentials.
- D-5 | Excel imports are all-or-nothing with exact duplicate keys per student | Partial import rejected | Prevents ambiguous question-bank state.
- D-6 | First successful import is activated automatically | Manual first configuration rejected | Reduces setup friction.
- D-7 | Practice answers are returned as immediate feedback and not persisted | Practice history rejected for v1 | Matches non-goal.
- D-8 | Mock attempt questions are selected once and stored | Re-randomizing on view rejected | Preserves review integrity.
