const express = require("express");
const bcrypt = require("bcryptjs");
const { getPrisma } = require("../db");
const { ok, bad } = require("../utils/http");
const { isEmail, cleanStr, ALLOWED_ROLES } = require("../utils/validation");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/roles");

const router = express.Router();

router.use(requireAuth(), requireRole("ADMIN"));

router.get("/", async (req, res) => {
  const prisma = getPrisma();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true }
  });
  return ok(res, users);
});

router.post("/", async (req, res) => {
  try {
    const name = cleanStr(req.body.name, 80);
    const email = (req.body.email || "").trim().toLowerCase();
    const role = (req.body.role || "STAFF").toUpperCase();
    const password = String(req.body.password || "");

    if (!name) return bad(res, 400, "Name is required");
    if (!isEmail(email)) return bad(res, 400, "Invalid email");
    if (!ALLOWED_ROLES.has(role)) return bad(res, 400, "Invalid role");
    if (password.length < 8) return bad(res, 400, "Password must be at least 8 characters");

    const prisma = getPrisma();
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { name, email, passwordHash, role, active: true },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true }
    });

    return ok(res, user);
  } catch (e) {
    return bad(res, 500, "Create user failed", String(e?.message || e));
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const name = cleanStr(req.body.name, 80);
    const role = req.body.role ? String(req.body.role).toUpperCase() : null;
    const active = (req.body.active === true || req.body.active === false) ? req.body.active : null;

    const data = {};
    if (name) data.name = name;
    if (role) {
      if (!ALLOWED_ROLES.has(role)) return bad(res, 400, "Invalid role");
      data.role = role;
    }
    if (active !== null) data.active = active;

    if (Object.keys(data).length === 0) return bad(res, 400, "No changes");

    const prisma = getPrisma();
    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true }
    });

    return ok(res, user);
  } catch (e) {
    return bad(res, 500, "Update user failed", String(e?.message || e));
  }
});

module.exports = router;
