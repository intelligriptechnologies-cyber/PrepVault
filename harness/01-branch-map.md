# Branch Map

- Identity and access: login, HTTP-only sessions, active/inactive users, admin/student route guards, emulation.
- Content ownership: imports/questions/mock attempts belong to one student; admin metadata visibility excludes question content.
- Import pipeline: template, upload, checksum, retained original file, strict parsing, all-or-nothing validation, duplicate detection.
- Student configuration: active import selection, first import active by default, inactive imports excluded immediately.
- Learning workflows: browse, practice, mock setup, answer capture, submit/review/history.
- Operational hardening: audit logs, stable API errors, seed data, deployment docs, tests.
