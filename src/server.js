require("dotenv").config();

const rateLimit = require("express-rate-limit");
const { createApp } = require("./app");
const { getPrisma } = require("./db");

const PORT = process.env.PORT || 3000;

async function main() {
  // Warm up Prisma connection (optional but helpful for early failures)
  const prisma = getPrisma();
  await prisma.$connect();

  const app = createApp();

  // Basic global limiter (protects all routes)
  app.use(rateLimit({
    windowMs: 60 * 1000,
    limit: 600,
    standardHeaders: true,
    legacyHeaders: false
  }));

  app.listen(PORT, () => {
    console.log(`Alpha berthaphil Ticketing running on :${PORT}`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
