let currentUser = null;
let tickets = [];
let selectedTicketId = null;

function setView(view) {
  qs("#viewTickets").style.display = view === "tickets" ? "block" : "none";
  qs("#viewReports").style.display = view === "reports" ? "block" : "none";
  qs("#viewUsers").style.display = view === "users" ? "block" : "none";

  qsa(".nav a[data-view]").forEach(a => {
    a.classList.toggle("active", a.dataset.view === view);
  });

  if (view === "users") loadUsers();
}

function openModal() {
  qs("#modalBackdrop").style.display = "flex";
  qs("#modalErr").style.display = "none";
  qs("#nTitle").focus();
}

function closeModal() {
  qs("#modalBackdrop").style.display = "none";
  qs("#nTitle").value = "";
  qs("#nProgram").value = "";
  qs("#nCategory").value = "";
  qs("#nDescription").value = "";
  qs("#nPriority").value = "MEDIUM";
}

function ticketRow(t) {
  return `
    <tr data-id="${t.id}">
      <td style="font-family:var(--mono)">${t.ticketNo}</td>
      <td>
        <div style="font-weight:700">${escapeHtml(t.title)}</div>
        <div class="small muted">${escapeHtml(t.program || "")}</div>
      </td>
      <td>${pillForStatus(t.status)}</td>
      <td>${pillForPriority(t.priority)}</td>
      <td class="small muted">${fmtDate(t.updatedAt)}</td>
    </tr>
  `;
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadTickets() {
  const q = qs("#q").value.trim();
  const status = qs("#fStatus").value.trim();
  const priority = qs("#fPriority").value.trim();

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (priority) params.set("priority", priority);

  tickets = await API.request("/api/tickets?" + params.toString());
  qs("#ticketsTbody").innerHTML = tickets.map(ticketRow).join("") || `
    <tr><td colspan="5" class="small muted">No tickets found.</td></tr>
  `;

  qsa("#ticketsTbody tr[data-id]").forEach(tr => {
    tr.addEventListener("click", () => selectTicket(tr.dataset.id));
  });
}

async function selectTicket(id) {
  selectedTicketId = id;
  const data = await API.request("/api/tickets/" + id);

  qs("#detailsEmpty").style.display = "none";
  qs("#details").style.display = "block";
  qs("#detailNo").textContent = data.ticketNo;

  qs("#detailTitle").textContent = data.title;
  qs("#detailStatus").value = data.status;
  qs("#detailPriority").value = data.priority;
  qs("#detailProgram").value = data.program || "";
  qs("#detailCategory").value = data.category || "";
  qs("#detailDescription").value = data.description || "";

  // Comments
  qs("#comments").innerHTML = (data.comments || []).map(c => `
    <div class="card" style="box-shadow:none;border-radius:16px;padding:10px;background:rgba(255,255,255,0.04)">
      <div class="small muted">${escapeHtml(c.user?.name || "User")} • ${fmtDate(c.createdAt)}</div>
      <div style="margin-top:6px;white-space:pre-wrap">${escapeHtml(c.message)}</div>
    </div>
  `).join("") || `<div class="small muted">No comments yet.</div>`;

  // Activity
  qs("#activity").innerHTML = (data.activities || []).map(a => `
    <div class="card" style="box-shadow:none;border-radius:16px;padding:10px;background:rgba(255,255,255,0.04)">
      <div class="small muted">${fmtDate(a.createdAt)} • ${escapeHtml(a.user?.name || "User")}</div>
      <div style="margin-top:6px">
        <span class="badge">${escapeHtml(a.action)}</span>
        <span class="small muted">${escapeHtml(JSON.stringify(a.meta || {}))}</span>
      </div>
    </div>
  `).join("") || `<div class="small muted">No recent activity.</div>`;
}

async function saveTicket() {
  if (!selectedTicketId) return;

  const payload = {
    status: qs("#detailStatus").value,
    priority: qs("#detailPriority").value,
    program: qs("#detailProgram").value.trim(),
    category: qs("#detailCategory").value.trim(),
    description: qs("#detailDescription").value
  };

  await API.request("/api/tickets/" + selectedTicketId, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });

  toast("Ticket updated");
  await loadTickets();
  await selectTicket(selectedTicketId);
}

async function addComment() {
  if (!selectedTicketId) return;
  const message = qs("#newComment").value.trim();
  if (!message) return toast("Type a comment first.");

  await API.request(`/api/tickets/${selectedTicketId}/comments`, {
    method: "POST",
    body: JSON.stringify({ message })
  });

  qs("#newComment").value = "";
  toast("Comment posted");
  await selectTicket(selectedTicketId);
  await loadTickets();
}

async function createTicket() {
  const title = qs("#nTitle").value.trim();
  if (!title) {
    qs("#modalErr").textContent = "Title is required";
    qs("#modalErr").style.display = "block";
    return;
  }

  const payload = {
    title,
    program: qs("#nProgram").value.trim(),
    category: qs("#nCategory").value.trim(),
    priority: qs("#nPriority").value,
    description: qs("#nDescription").value
  };

  const btn = qs("#btnCreateTicket");
  btn.disabled = true; btn.textContent = "Creating...";

  try {
    const created = await API.request("/api/tickets", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    closeModal();
    toast("Ticket created: " + created.ticketNo);
    await loadTickets();
    await selectTicket(created.id);
  } catch (e) {
    qs("#modalErr").textContent = e.message || "Create failed";
    qs("#modalErr").style.display = "block";
  } finally {
    btn.disabled = false; btn.textContent = "Create";
  }
}

async function loadUsers() {
  const tbody = qs("#usersTbody");
  tbody.innerHTML = `<tr><td colspan="5" class="small muted">Loading...</td></tr>`;

  try {
    const users = await API.request("/api/users");
    tbody.innerHTML = users.map(u => `
      <tr data-id="${u.id}">
        <td>${escapeHtml(u.name)}</td>
        <td class="small muted">${escapeHtml(u.email)}</td>
        <td><span class="badge">${escapeHtml(u.role)}</span></td>
        <td>${u.active ? `<span class="pill good">YES</span>` : `<span class="pill bad">NO</span>`}</td>
        <td>
          <button class="btn" data-action="toggle">${u.active ? "Disable" : "Enable"}</button>
        </td>
      </tr>
    `).join("") || `<tr><td colspan="5" class="small muted">No users.</td></tr>`;

    qsa('#usersTbody button[data-action="toggle"]').forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const tr = e.target.closest("tr");
        const id = tr.dataset.id;
        const active = tr.innerHTML.includes("YES");
        await API.request("/api/users/" + id, {
          method: "PATCH",
          body: JSON.stringify({ active: !active })
        });
        toast("User updated");
        loadUsers();
      });
    });
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="small" style="color:var(--bad)">Failed: ${escapeHtml(e.message)}</td></tr>`;
  }
}

async function createUser() {
  const name = qs("#uName").value.trim();
  const email = qs("#uEmail").value.trim();
  const role = qs("#uRole").value;
  const password = qs("#uPass").value.trim();

  if (!name || !email || !password) return toast("Fill name, email, and password.");

  await API.request("/api/users", {
    method: "POST",
    body: JSON.stringify({ name, email, role, password })
  });

  toast("User created");
  qs("#uName").value = "";
  qs("#uEmail").value = "";
  qs("#uPass").value = "";
  await loadUsers();
}

function exportCsv() {
  const status = qs("#rStatus").value.trim();
  const priority = qs("#rPriority").value.trim();
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (priority) params.set("priority", priority);

  const token = localStorage.getItem("ab_token");
  // We need Authorization header; easiest is open a fetch and download blob.
  fetch("/api/tickets/export/csv?" + params.toString(), {
    headers: token ? { "Authorization": "Bearer " + token } : {}
  }).then(async (res) => {
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tickets.csv";
    a.click();
    URL.revokeObjectURL(url);
  }).catch(e => toast(e.message));
}

(async function init(){
  try {
    const me = await API.me();
    currentUser = me.user;
    qs("#who").textContent = `${currentUser.name} • ${currentUser.role}`;

    if (currentUser.role === "ADMIN") {
      qs("#navUsers").style.display = "flex";
    }

    // nav
    qsa(".nav a[data-view]").forEach(a => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        setView(a.dataset.view);
      });
    });

    // tickets actions
    qs("#btnRefresh").addEventListener("click", loadTickets);
    qs("#q").addEventListener("input", () => {
      clearTimeout(window.__qT);
      window.__qT = setTimeout(loadTickets, 250);
    });
    qs("#fStatus").addEventListener("change", loadTickets);
    qs("#fPriority").addEventListener("change", loadTickets);

    qs("#btnSaveTicket").addEventListener("click", saveTicket);
    qs("#btnReloadTicket").addEventListener("click", () => selectedTicketId && selectTicket(selectedTicketId));
    qs("#btnAddComment").addEventListener("click", addComment);

    // modal
    qs("#btnNewTicket").addEventListener("click", openModal);
    qs("#btnCloseModal").addEventListener("click", closeModal);
    qs("#modalBackdrop").addEventListener("click", (e) => {
      if (e.target.id === "modalBackdrop") closeModal();
    });
    qs("#btnCreateTicket").addEventListener("click", createTicket);

    // reports
    qs("#btnExport").addEventListener("click", exportCsv);

    // users
    qs("#btnCreateUser").addEventListener("click", createUser);

    // logout
    qs("#btnLogout").addEventListener("click", logout);

    await loadTickets();
  } catch (e) {
    logout();
  }
})();
