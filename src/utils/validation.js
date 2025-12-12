const ALLOWED_ROLES = new Set(["ADMIN", "STAFF"]);
const ALLOWED_STATUS = new Set(["OPEN", "IN_PROGRESS", "DONE", "CLOSED"]);
const ALLOWED_PRIORITY = new Set(["LOW", "MEDIUM", "HIGH", "URGENT"]);

function isEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function cleanStr(s, max = 5000) {
  if (s === null || s === undefined) return null;
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (!t) return null;
  return t.slice(0, max);
}

module.exports = {
  ALLOWED_ROLES,
  ALLOWED_STATUS,
  ALLOWED_PRIORITY,
  isEmail,
  cleanStr
};
