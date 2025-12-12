/* Shared helpers */

const API = {
  async request(path, opts = {}) {
    const token = localStorage.getItem("ab_token");
    const headers = Object.assign(
      { "Content-Type": "application/json" },
      opts.headers || {}
    );
    if (token) headers["Authorization"] = "Bearer " + token;

    const res = await fetch(path, { ...opts, headers });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) {
      const msg = json.message || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return json.data;
  },

  async login(email, password) {
    return API.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  },

  async me() {
    return API.request("/api/auth/me");
  }
};

function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString();
}

function pillForStatus(status) {
  const s = String(status || "").toUpperCase();
  if (s === "OPEN") return `<span class="pill bad">OPEN</span>`;
  if (s === "IN_PROGRESS") return `<span class="pill warn">IN PROGRESS</span>`;
  if (s === "DONE") return `<span class="pill good">DONE</span>`;
  if (s === "CLOSED") return `<span class="pill">CLOSED</span>`;
  return `<span class="pill">${s || "-"}</span>`;
}

function pillForPriority(p) {
  const s = String(p || "").toUpperCase();
  if (s === "URGENT") return `<span class="pill bad">URGENT</span>`;
  if (s === "HIGH") return `<span class="pill warn">HIGH</span>`;
  if (s === "MEDIUM") return `<span class="pill">MEDIUM</span>`;
  if (s === "LOW") return `<span class="pill good">LOW</span>`;
  return `<span class="pill">${s || "-"}</span>`;
}

function toast(msg) {
  const el = qs("#toast");
  if (!el) return alert(msg);
  el.textContent = msg;
  el.style.display = "block";
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(() => el.style.display = "none", 2800);
}

function logout() {
  localStorage.removeItem("ab_token");
  localStorage.removeItem("ab_user");
  location.href = "/login.html";
}
