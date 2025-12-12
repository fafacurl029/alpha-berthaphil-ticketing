const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getPrisma } = require("../db");
const { ok, bad } = require("../utils/http");
const { isEmail } = require("../utils/validation");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!isEmail(email) || password.length < 6) {
      return bad(res, 400, "Invalid email or password");
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.active) return bad(res, 401, "Invalid credentials");

    const okPwd = await bcrypt.compare(password, user.passwordHash);
    if (!okPwd) return bad(res, 401, "Invalid credentials");

    const secret = process.env.JWT_SECRET;
    if (!secret) return bad(res, 500, "Server misconfigured: missing JWT_SECRET");

    const token = jwt.sign(
      { role: user.role, name: user.name, email: user.email },
      secret,
      { subject: user.id, expiresIn: "7d" }
    );

    return ok(res, {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (e) {
    return bad(res, 500, "Login failed");
  }
});

router.get("/me", requireAuth(), async (req, res) => {
  return ok(res, { user: req.user });
});

module.exports = router;
