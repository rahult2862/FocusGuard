import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { createToken } from "../lib/tokens.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();
const credentials = z.object({
  email: z.string().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128)
});
const timezoneSchema = z.string().max(80).refine((value) => {
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }); return true; }
  catch { return false; }
}, "Enter a valid timezone");

authRouter.post("/register", async (req, res, next) => {
  try {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Enter a valid email and a password with at least 8 characters" });
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) return res.status(409).json({ error: "An account with that email already exists" });
    const timezone = timezoneSchema.optional().safeParse(req.body.timezone);
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        passwordHash: await bcrypt.hash(parsed.data.password, 12),
        timezone: timezone.success && timezone.data ? timezone.data : "UTC"
      },
      select: { id: true, email: true, timezone: true }
    });
    res.status(201).json({ token: createToken(user.id), user });
  } catch (error) { next(error); }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Enter a valid email and password" });
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      return res.status(401).json({ error: "Email or password is incorrect" });
    }
    res.json({ token: createToken(user.id), user: { id: user.id, email: user.email, timezone: user.timezone } });
  } catch (error) { next(error); }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, email: true, timezone: true } });
    if (!user) return res.status(404).json({ error: "Account not found" });
    res.json({ user });
  } catch (error) { next(error); }
});
