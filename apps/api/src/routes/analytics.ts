import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { isScheduleActive } from "../services/policy.js";
import { localDateKey, localDayStart } from "../services/time.js";

export const analyticsRouter = Router();

function shiftDateKey(dateKey: string, days: number) {
  const [year = 1970, month = 1, day = 1] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

analyticsRouter.get("/summary", async (req, res, next) => {
  try {
    const now = new Date();
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { timezone: true } });
    const timezone = user?.timezone ?? "UTC";
    const todayKey = localDateKey(now, timezone);
    const dayKeys = Array.from({ length: 7 }, (_, index) => shiftDateKey(todayKey, index - 6));
    const startOfToday = localDayStart(todayKey, timezone);
    const weekStart = localDayStart(dayKeys[0] ?? todayKey, timezone);
    const [entries, sessions, ruleRows] = await Promise.all([
      prisma.usageEntry.findMany({ where: { userId: req.userId, startedAt: { gte: weekStart } }, select: { domain: true, startedAt: true, durationSeconds: true } }),
      prisma.focusSession.findMany({ where: { userId: req.userId, startedAt: { lt: now }, OR: [{ endedAt: null }, { endedAt: { gte: startOfToday } }] }, select: { startedAt: true, endedAt: true, plannedMins: true } }),
      prisma.domainRule.findMany({ where: { userId: req.userId, type: "BLOCK", enabled: true }, include: { schedule: true } }),
    ]);
    const daily = dayKeys.map((key) => ({
      date: key,
      totalSeconds: entries.reduce((sum, entry) => sum + (localDateKey(entry.startedAt, timezone) === key ? entry.durationSeconds : 0), 0)
    }));
    const totals = new Map<string, number>();
    for (const entry of entries) {
      if (localDateKey(entry.startedAt, timezone) === todayKey) totals.set(entry.domain, (totals.get(entry.domain) ?? 0) + entry.durationSeconds);
    }
    const topDomains = [...totals.entries()].map(([domain, totalSeconds]) => ({ domain, totalSeconds })).sort((a, b) => b.totalSeconds - a.totalSeconds).slice(0, 6);
    const usageByDomainToday = new Map<string, number>();
    for (const entry of entries) {
      if (localDateKey(entry.startedAt, timezone) === todayKey) usageByDomainToday.set(entry.domain, (usageByDomainToday.get(entry.domain) ?? 0) + entry.durationSeconds);
    }
    const focusSessionActive = sessions.some((session) => session.endedAt === null
      && now.getTime() < session.startedAt.getTime() + session.plannedMins * 60_000);
    const activeRules = ruleRows.filter((rule) => {
      const hasUsageLimit = rule.dailyLimitMinutes !== null;
      const scheduleActive = rule.scheduleId
        ? Boolean(rule.schedule && isScheduleActive(rule.schedule, timezone, now))
        : !hasUsageLimit;
      const consumedSeconds = [...usageByDomainToday.entries()]
        .filter(([domain]) => domain === rule.domain || domain.endsWith(`.${rule.domain}`))
        .reduce((sum, [, seconds]) => sum + seconds, 0);
      const limitReached = rule.dailyLimitMinutes !== null
        && consumedSeconds >= rule.dailyLimitMinutes * 60;
      return focusSessionActive || scheduleActive || limitReached;
    }).length;
    const todaySeconds = daily.at(-1)?.totalSeconds ?? 0;
    const focusSecondsToday = sessions.reduce((sum, session) => {
      const plannedEnd = session.startedAt.getTime() + session.plannedMins * 60_000;
      const end = Math.min(session.endedAt?.getTime() ?? plannedEnd, now.getTime());
      return sum + Math.max(0, Math.floor((end - Math.max(session.startedAt.getTime(), startOfToday.getTime())) / 1000));
    }, 0);
    res.json({ todaySeconds, focusSecondsToday, activeRules, daily, topDomains });
  } catch (error) { next(error); }
});
