function ok(res, data) {
  return res.json({ ok: true, data });
}

function bad(res, status, message, details) {
  return res.status(status).json({ ok: false, message, details });
}

module.exports = { ok, bad };
