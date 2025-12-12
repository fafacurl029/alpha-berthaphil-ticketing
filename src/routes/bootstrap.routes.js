/*
  Securely create the first ADMIN account.

  Conditions:
  - BOOTSTRAP_TOKEN must match
  - Only allowed if there is no existing ADMIN user
*/
const express = require("express");
const bcrypt = require("bcryptjs");
const { getPrisma } = require("../db");
const { ok, bad } = require("../utils/http");
const { isEmail, cleanStr } = require("../utils/validation");

const router = express.Router();

router.post("/admin", async (req, res) => {
  try {
    const bootstrapToken = String(req.body.bootstrapToken || "");
    const expected = process.env.BOOTSTRAP_TOKEN || "";
    if (!expected || bootstrapToken !== expected) return bad(res, 403, "Invalid bootstrap token");

    const prisma = getPrisma();
    const adminExists = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (adminExists) return bad(res, 409, "Admin already exists");

    const name = cleanStr(req.body.name, 80) || "Admin";
    const email = (req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!isEmail(email) || password.length < 8) {
      return bad(res, 400, "Provide valid email and a password (min 8 chars)");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: "ADMIN", active: true }
    });

    return ok(res, { id: user.id, email: user.email });
  } catch (e) {
    return bad(res, 500, "Bootstrap failed", String(e?.message || e));
  }
});

module.exports = router;
