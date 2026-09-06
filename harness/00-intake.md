# Intake

Build a web-based MCQ preparation system where admin-created student accounts can upload private Excel question banks, choose active imports, browse/review questions, practice with immediate feedback, and take timed mock tests. Admins manage users, reset passwords, inspect import metadata, inactivate imports, and emulate students for audited support.

## Unknowns Resolved From Prior Plan
- Users: students and admins.
- Stack: React, Node.js API, PostgreSQL, Prisma, same-origin deployment.
- Non-goals: public signup, multi-answer questions, storing practice history.
- Definition of done: end-to-end app covering auth, import/configuration, browse, practice, mock tests, admin management, audit logs, and verification.

## Capability Classification
- Auth and roles: feature plus security constraint.
- Strict Excel import: feature plus validation constraint.
- Active question-bank configuration: feature.
- Browse/practice/mock flows: student learning features.
- Admin import/user/emulation tools: support and governance features.
- Privacy and audit logging: security constraints.
