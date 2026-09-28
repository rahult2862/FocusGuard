import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

export const focusRouter = Router();

focusRouter.get("/current", async (req, res, next) => {
  try {
    let session = await prisma.focusSession.findFirst({ where: { userId: req.userId, endedAt: null }, orderBy: { startedAt: "desc" } });
    if (session && Date.now() >= session.startedAt.getTime() + session.plannedMins * 60_000) {
      const plannedEnd = new Date(session.startedAt.getTime() + session.plannedMins * 60_000);
      await prisma.focusSession.update({ where: { id: session.id }, data: { endedAt: plannedEnd } });
      session = null;
    }
    res.json({ session });
  } catch (error) { next(error); }
});

focusRouter.post("/start", async (req, res, next) => {
  try {
    const input = z.object({ title: z.string().trim().min(1).max(80).default("Focus session"), plannedMins: z.number().int().min(1).max(240).default(25) }).safeParse(req.body ?? {});
    if (!input.success) return res.status(400).json({ error: "Choose a focus length between 1 and 240 minutes" });
    const session = await prisma.$transaction(async (tx) => {
      await tx.focusSession.updateMany({ where: { userId: req.userId, endedAt: null }, data: { endedAt: new Date() } });
      return tx.focusSession.create({ data: { ...input.data, userId: req.userId! } });
    });
    res.status(201).json({ session });
  } catch (error) { next(error); }
});

focusRouter.post("/stop", async (req, res, next) => {
  try {
    const active = await prisma.focusSession.findFirst({ where: { userId: req.userId, endedAt: null }, orderBy: { startedAt: "desc" } });
    if (!active) return res.status(404).json({ error: "There is no active focus session" });
    const plannedEnd = active.startedAt.getTime() + active.plannedMins * 60_000;
    const session = await prisma.focusSession.update({ where: { id: active.id }, data: { endedAt: new Date(Math.min(Date.now(), plannedEnd)) } });
    res.json({ session });
  } catch (error) { next(error); }
});
