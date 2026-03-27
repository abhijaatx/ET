import type { Context, Next } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { lucia } from "../auth";
import type { AppEnv } from "../types/app";

export async function authMiddleware(c: Context<AppEnv>, next: Next) {
  const sessionId = getCookie(c, lucia.sessionCookieName);
  if (!sessionId) {
    c.set("user", null);
    c.set("session", null);
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { session, user } = await lucia.validateSession(sessionId);
  if (session && session.fresh) {
    const sessionCookie = lucia.createSessionCookie(session.id);
    setCookie(c, sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
  }
  if (!session) {
    const sessionCookie = lucia.createBlankSessionCookie();
    setCookie(c, sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
    c.set("user", null);
    c.set("session", null);
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", user as any);
  c.set("session", session as any);
  await next();
}

export async function optionalAuthMiddleware(c: Context<AppEnv>, next: Next) {
  const sessionId = getCookie(c, lucia.sessionCookieName);
  if (!sessionId) {
    c.set("user", null);
    c.set("session", null);
    return await next();
  }

  const { session, user } = await lucia.validateSession(sessionId);
  if (session && session.fresh) {
    const sessionCookie = lucia.createSessionCookie(session.id);
    setCookie(c, sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
  }
  
  if (!session) {
    c.set("user", null);
    c.set("session", null);
  } else {
    c.set("user", user as any);
    c.set("session", session as any);
  }
  
  await next();
}
