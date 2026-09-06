import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "./config";
import { prisma } from "./db";
import { ApiError } from "./errors";

type SessionPayload = {
  sub: string;
  sessionVersion: number;
  emulatedUserId?: string;
};

declare global {
  namespace Express {
    interface Request {
      actor?: {
        id: string;
        role: "ADMIN" | "STUDENT";
        name: string;
        username: string;
        sessionVersion: number;
      };
      effectiveUser?: {
        id: string;
        role: "ADMIN" | "STUDENT";
        name: string;
        username: string;
      };
      emulatedUserId?: string;
    }
  }
}

export function signSession(userId: string, sessionVersion: number, emulatedUserId?: string) {
  return jwt.sign({ sub: userId, sessionVersion, emulatedUserId }, config.jwtSecret, {
    expiresIn: "12h"
  });
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 12 * 60 * 60 * 1000
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(config.cookieName);
}

export async function attachSession(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const token = req.cookies?.[config.cookieName];
  if (!token) return next();

  try {
    const payload = jwt.verify(token, config.jwtSecret) as SessionPayload;
    const actor = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!actor || actor.status !== "ACTIVE") return next();
    if (payload.sessionVersion !== actor.sessionVersion) return next();

    req.actor = {
      id: actor.id,
      role: actor.role,
      name: actor.name,
      username: actor.username,
      sessionVersion: actor.sessionVersion
    };

    if (payload.emulatedUserId && actor.role === "ADMIN") {
      const target = await prisma.user.findUnique({
        where: { id: payload.emulatedUserId }
      });
      if (target && target.role === "STUDENT" && target.status === "ACTIVE") {
        req.effectiveUser = {
          id: target.id,
          role: target.role,
          name: target.name,
          username: target.username
        };
        req.emulatedUserId = target.id;
        return next();
      }
    }

    req.effectiveUser = req.actor;
    next();
  } catch {
    next();
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.actor || !req.effectiveUser) {
    throw new ApiError(401, "AUTH_REQUIRED", "Please log in.");
  }
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.actor || req.actor.role !== "ADMIN") {
    throw new ApiError(403, "ADMIN_REQUIRED", "Admin access is required.");
  }
  next();
}

export function requireStudentContext(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  if (!req.effectiveUser || req.effectiveUser.role !== "STUDENT") {
    throw new ApiError(403, "STUDENT_CONTEXT_REQUIRED", "Student access is required.");
  }
  next();
}
