import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { users } from "@myet/db";
import { eq } from "drizzle-orm";
import { lucia } from "../auth";
import { setCookie } from "hono/cookie";
import bcrypt from "bcryptjs";

import { authMiddleware } from "../middleware/auth";
import type { AppEnv } from "../types/app";

const authRoutes = new Hono<AppEnv>();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

authRoutes.post("/register", async (c) => {
  const body = credentialsSchema.parse(await c.req.json());

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1);

  if (existing.length > 0) {
    return c.json({ error: "Email already registered" }, 400);
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  const inserted = await db
    .insert(users)
    .values({ email: body.email, passwordHash })
    .returning({ id: users.id, email: users.email });

  const user = inserted[0];
  if (!user) return c.json({ error: "Registration failed" }, 500);

  const session = await lucia.createSession(user.id, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  setCookie(c, sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

  return c.json({ id: user.id, email: user.email });
});

authRoutes.post("/login", async (c) => {
  const body = credentialsSchema.parse(await c.req.json());

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1);

  const user = existing[0];
  if (!user) return c.json({ error: "Invalid credentials" }, 401);

  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) return c.json({ error: "Invalid credentials" }, 401);

  const session = await lucia.createSession(user.id, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  setCookie(c, sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

  return c.json({ id: user.id, email: user.email });
});

authRoutes.post("/logout", authMiddleware, async (c) => {
  const session = c.get("session");
  const user = c.get("user");
  if (session && user) {
    await lucia.invalidateSession(session.id);
  }

  const sessionCookie = lucia.createBlankSessionCookie();
  setCookie(c, sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

  return c.json({ ok: true });
});

export default authRoutes;
