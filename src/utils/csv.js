function escapeCsv(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows, columns) {
  const header = columns.map(c => escapeCsv(c.label)).join(",");
  const lines = rows.map(r => columns.map(c => escapeCsv(r[c.key])).join(","));
  return [header, ...lines].join("\n");
}

module.exports = { toCsv };
