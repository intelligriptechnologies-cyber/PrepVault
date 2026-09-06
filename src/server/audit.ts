import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export async function auditLog(input: {
  actorUserId: string;
  targetUserId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata
    }
  });
}
