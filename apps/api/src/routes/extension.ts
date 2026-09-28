import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { isScheduleActive } from "../services/policy.js";
import { localDateKey, localDayStart } from "../services/time.js";

export const extensionRouter = Router();
const usageInput = z.object({
  domain: z.string().trim().toLowerCase().max(253).regex(/^(?:[a-z0-9-]+\.)+[a-z]{2,63}$/i),
  durationSeconds: z.number().int().min(1).max(3600),
  startedAt: z.string().datetime().optional()
});

extensionRouter.get("/policy", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { timezone: true } });
    if (!user) return res.status(404).json({ error: "Account not found" });
    const now = new Date();
    const todayStart = localDayStart(localDateKey(now, user.timezone), user.timezone);
    const [rules, usage, focusSession] = await Promise.all([
      prisma.domainRule.findMany({ where: { userId: req.userId, enabled: true, type: "BLOCK" }, include: { schedule: true } }),
      prisma.usageEntry.findMany({ where: { userId: req.userId, startedAt: { gte: todayStart } }, select: { domain: true, durationSeconds: true } }),
      prisma.focusSession.findFirst({ where: { userId: req.userId, endedAt: null, startedAt: { lte: now } }, select: { startedAt: true, plannedMins: true } })
    ]);
    const usageByDomain = new Map<string, number>();
    for (const entry of usage) usageByDomain.set(entry.domain, (usageByDomain.get(entry.domain) ?? 0) + entry.durationSeconds);
    const blockingDomains = rules
      .filter((rule) => {
        const hasUsageLimit = rule.dailyLimitMinutes !== null;
        const scheduleActive = rule.scheduleId
          ? Boolean(rule.schedule && isScheduleActive(rule.schedule, user.timezone, now))
          : !hasUsageLimit;
        const consumedSeconds = [...usageByDomain.entries()]
          .filter(([domain]) => domain === rule.domain || domain.endsWith(`.${rule.domain}`))
          .reduce((sum, [, seconds]) => sum + seconds, 0);
        const limitReached = rule.dailyLimitMinutes !== null && rule.dailyLimitMinutes !== undefined
          && consumedSeconds >= rule.dailyLimitMinutes * 60;
        const focusActive = focusSession !== null
          && now.getTime() < focusSession.startedAt.getTime() + focusSession.plannedMins * 60_000;
        return focusActive || scheduleActive || limitReached;
      })
      .map((rule) => rule.domain);
    res.json({ blockingDomains, syncedAt: new Date().toISOString() });
  } catch (error) { next(error); }
});

extensionRouter.post("/usage", async (req, res, next) => {
  try {
    const parsed = usageInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid usage segment" });
    const { domain, durationSeconds, startedAt } = parsed.data;
    const entry = await prisma.usageEntry.create({ data: {
      userId: req.userId!, domain, durationSeconds,
      startedAt: startedAt ? new Date(startedAt) : new Date()
    } });
    res.status(201).json({ entry: { id: entry.id } });
  } catch (error) { next(error); }
});
