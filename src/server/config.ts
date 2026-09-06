import path from "node:path";

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "dev-only-change-me",
  uploadDir: path.resolve(process.env.UPLOAD_DIR ?? "uploads"),
  cookieName: "qb_session"
};
