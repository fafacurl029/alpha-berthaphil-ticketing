/*
  Optional seed script:
  Creates an initial ADMIN user if none exists.
  Run: npm run seed
*/
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const adminExists = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (adminExists) {
    console.log("Admin already exists. Seed skipped.");
    return;
  }

  const email = process.env.SEED_ADMIN_EMAIL || "admin@alpha.local";
  const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMeNow123!";
  const name = process.env.SEED_ADMIN_NAME || "Alpha Admin";

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { name, email, passwordHash, role: "ADMIN", active: true }
  });

  console.log("Seeded admin:", email, "password:", password);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
