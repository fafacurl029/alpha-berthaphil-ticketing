const jwt = require("jsonwebtoken");
const { bad } = require("../utils/http");
const { getPrisma } = require("../db");

function requireAuth() {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : null;
      if (!token) return bad(res, 401, "Missing token");

      const secret = process.env.JWT_SECRET;
      if (!secret) return bad(res, 500, "Server misconfigured: missing JWT_SECRET");

      const payload = jwt.verify(token, secret);

      const prisma = getPrisma();
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.active) return bad(res, 401, "Invalid user");

      req.user = { id: user.id, role: user.role, name: user.name, email: user.email };
      next();
    } catch (err) {
      return bad(res, 401, "Not authenticated");
    }
  };
}

module.exports = { requireAuth };
