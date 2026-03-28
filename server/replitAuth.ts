import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    pool,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  const secret = process.env.SESSION_SECRET || "changeme-set-SESSION_SECRET-in-production";
  return session({
    secret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      // sameSite "none" allows the cookie to be sent from the Capacitor mobile
      // app (capacitor://localhost origin) when the webview calls the server.
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if ((req as any).session?.localUser) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};
