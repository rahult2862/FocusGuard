import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { requireAuth } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";
import { rulesRouter } from "./routes/rules.js";
import { schedulesRouter } from "./routes/schedules.js";
import { extensionRouter } from "./routes/extension.js";
import { analyticsRouter } from "./routes/analytics.js";
import { focusRouter } from "./routes/focus.js";

export const app = express();
app.disable("x-powered-by");
app.use(helmet());
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";
app.use(cors({ origin: (origin, callback) => {
  // During local development Chrome assigns the unpacked extension a generated origin.
  if (!origin || origin === webOrigin || origin.startsWith("chrome-extension://")) return callback(null, true);
  return callback(null, false);
} }));
app.use(express.json({ limit: "100kb" }));
app.get("/health", (_req, res) => res.json({ ok: true, service: "focusguard-api" }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false });
const api = express.Router();
api.use("/auth", authLimiter, authRouter);
api.use("/rules", requireAuth, rulesRouter);
api.use("/schedules", requireAuth, schedulesRouter);
api.use("/extension", requireAuth, extensionRouter);
api.use("/analytics", requireAuth, analyticsRouter);
api.use("/focus", requireAuth, focusRouter);
app.use("/api/v1", api);

app.use((_req, res) => res.status(404).json({ error: "That route does not exist" }));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});
