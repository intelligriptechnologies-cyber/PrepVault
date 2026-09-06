import bcrypt from "bcryptjs";
import { prisma } from "../src/server/db";

async function main() {
  const adminPassword = await bcrypt.hash("AdminPass123!", 12);
  const studentPassword = await bcrypt.hash("StudentPass123!", 12);
  await prisma.user.upsert({
    where: { username: "admin@example.com" },
    update: {},
    create: {
      name: "Admin",
      username: "admin@example.com",
      role: "ADMIN",
      passwordHash: adminPassword
    }
  });
  await prisma.user.upsert({
    where: { username: "student@example.com" },
    update: {},
    create: {
      name: "Student",
      username: "student@example.com",
      role: "STUDENT",
      passwordHash: studentPassword
    }
  });
}

main().finally(async () => prisma.$disconnect());
