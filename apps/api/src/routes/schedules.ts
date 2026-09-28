import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

export const schedulesRouter = Router();
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour time, such as 09:00");
const scheduleInput = z.object({
  name: z.string().trim().min(1).max(60),
  startTime: time,
  endTime: time,
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  enabled: z.boolean().default(true)
});

schedulesRouter.get("/", async (req, res, next) => {
  try {
    const schedules = await prisma.schedule.findMany({ where: { userId: req.userId }, include: { _count: { select: { rules: true } } }, orderBy: { createdAt: "asc" } });
    res.json({ schedules });
  } catch (error) { next(error); }
});

schedulesRouter.post("/", async (req, res, next) => {
  try {
    const parsed = scheduleInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid schedule" });
    const schedule = await prisma.schedule.create({ data: { ...parsed.data, daysOfWeek: [...new Set(parsed.data.daysOfWeek)].sort(), userId: req.userId! } });
    res.status(201).json({ schedule });
  } catch (error) { next(error); }
});

schedulesRouter.patch("/:id", async (req, res, next) => {
  try {
    const parsed = scheduleInput.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid schedule" });
    const data = parsed.data.daysOfWeek ? { ...parsed.data, daysOfWeek: [...new Set(parsed.data.daysOfWeek)].sort() } : parsed.data;
    const result = await prisma.schedule.updateMany({ where: { id: req.params.id, userId: req.userId }, data });
    if (!result.count) return res.status(404).json({ error: "Schedule not found" });
    const schedule = await prisma.schedule.findUnique({ where: { id: req.params.id }, include: { _count: { select: { rules: true } } } });
    res.json({ schedule });
  } catch (error) { next(error); }
});

schedulesRouter.delete("/:id", async (req, res, next) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const schedule = await tx.schedule.findFirst({ where: { id: req.params.id, userId: req.userId }, select: { id: true } });
      if (!schedule) return false;
      // Removing a schedule pauses its linked rules rather than unexpectedly making them always-on.
      await tx.domainRule.updateMany({ where: { scheduleId: schedule.id, userId: req.userId }, data: { scheduleId: null, enabled: false } });
      await tx.schedule.delete({ where: { id: schedule.id } });
      return true;
    });
    if (!result) return res.status(404).json({ error: "Schedule not found" });
    res.status(204).end();
  } catch (error) { next(error); }
});
