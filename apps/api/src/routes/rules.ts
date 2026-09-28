import { Router } from "express";
import { RuleType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

export const rulesRouter = Router();
const domainPattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const ruleInput = z.object({
  domain: z.string().trim().toLowerCase().transform((value) => (value.replace(/^https?:\/\//, "").split(/[/?#]/)[0] ?? "").replace(/^www\./, "")).refine((value) => domainPattern.test(value), "Enter a valid domain name"),
  type: z.nativeEnum(RuleType).default(RuleType.BLOCK),
  enabled: z.boolean().default(true),
  dailyLimitMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  scheduleId: z.string().nullable().optional()
});

rulesRouter.get("/", async (req, res, next) => {
  try {
    const rules = await prisma.domainRule.findMany({ where: { userId: req.userId }, include: { schedule: { select: { id: true, name: true, startTime: true, endTime: true, daysOfWeek: true, enabled: true } } }, orderBy: { domain: "asc" } });
    res.json({ rules });
  } catch (error) { next(error); }
});

rulesRouter.post("/", async (req, res, next) => {
  try {
    const parsed = ruleInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid rule" });
    if (parsed.data.scheduleId) {
      const schedule = await prisma.schedule.findFirst({ where: { id: parsed.data.scheduleId, userId: req.userId } });
      if (!schedule) return res.status(400).json({ error: "Choose one of your schedules" });
    }
    const rule = await prisma.domainRule.create({ data: { ...parsed.data, userId: req.userId! }, include: { schedule: true } });
    res.status(201).json({ rule });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") return res.status(409).json({ error: "A rule for this domain already exists" });
    next(error);
  }
});

rulesRouter.patch("/:id", async (req, res, next) => {
  try {
    const parsed = ruleInput.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid rule" });
    if (parsed.data.scheduleId) {
      const schedule = await prisma.schedule.findFirst({ where: { id: parsed.data.scheduleId, userId: req.userId } });
      if (!schedule) return res.status(400).json({ error: "Choose one of your schedules" });
    }
    const result = await prisma.domainRule.updateMany({ where: { id: req.params.id, userId: req.userId }, data: parsed.data });
    if (result.count === 0) return res.status(404).json({ error: "Rule not found" });
    const rule = await prisma.domainRule.findUnique({ where: { id: req.params.id }, include: { schedule: true } });
    res.json({ rule });
  } catch (error) { next(error); }
});

rulesRouter.delete("/:id", async (req, res, next) => {
  try {
    const result = await prisma.domainRule.deleteMany({ where: { id: req.params.id, userId: req.userId } });
    if (!result.count) return res.status(404).json({ error: "Rule not found" });
    res.status(204).end();
  } catch (error) { next(error); }
});
