const { bad } = require("../utils/http");

function requireRole(...roles) {
  const set = new Set(roles);
  return (req, res, next) => {
    if (!req.user) return bad(res, 401, "Not authenticated");
    if (!set.has(req.user.role)) return bad(res, 403, "Forbidden");
    next();
  };
}

module.exports = { requireRole };
