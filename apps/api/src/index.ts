import dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

const [{ app }, { prisma }] = await Promise.all([
  import("./app.js"),
  import("./lib/prisma.js")
]);

const port = Number(process.env.API_PORT ?? 4000);
const server = app.listen(port, () => console.log(`FocusGuard API listening on http://localhost:${port}`));

async function shutdown() {
  server.close();
  await prisma.$disconnect();
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
