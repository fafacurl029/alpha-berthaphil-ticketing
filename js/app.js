(function(){
  const Alpha = window.Alpha = window.Alpha || {};
  const $ = (id)=>document.getElementById(id);

  function mustAuth(){
    const u = Alpha.Auth.currentUser();
    if(!u){ window.location.href = './index.html'; return null; }
    return u;
  }

  function setNav(user){
    const nav = $('nav');
    const items = [
      { href:'#/dashboard', label:'Dashboard', minRole:'Requester' },
      { href:'#/tickets', label:'Tickets', minRole:'Requester' },
      { href:'#/kb', label:'Knowledge Base', minRole:'Requester' },
      { href:'#/reports', label:'Reports', minRole:'Agent' },
      { href:'#/admin', label:'Admin', minRole:'Admin' },
      { href:'#/settings', label:'Settings', minRole:'Requester' }
    ];
    nav.innerHTML = items
      .filter(i=>Alpha.Auth.roleAtLeast(user.role, i.minRole))
      .map(i=>`<a href="${i.href}" data-nav="${i.href}"><span>${i.label}</span><span class="hint">→</span></a>`)
      .join('');
  }

  function setActiveNav(hash){
    document.querySelectorAll('[data-nav]').forEach(a=>{
      a.classList.toggle('active', hash.startsWith(a.getAttribute('data-nav')));
    });
  }

  function hydrateUserCard(user){
    $('whoName').textContent = user.name;
    $('whoRole').textContent = user.role;
  }

  function parseHash(){
    const h = (location.hash || '#/dashboard').replace(/^#/, '');
    const parts = h.split('/').filter(Boolean);
    return { route: parts[0] || 'dashboard', id: parts[1] || null };
  }

  function render(){
    const user = mustAuth(); if(!user) return;
    Alpha.UI.applyBranding();
    setNav(user);
    hydrateUserCard(user);

    const { route, id } = parseHash();
    setActiveNav('#/'+route);

    if(route==='dashboard') return renderDashboard(user);
    if(route==='tickets') return id ? renderTicketDetail(user, id) : renderTickets(user);
    if(route==='kb') return id ? renderKBDetail(user, id) : renderKB(user);
    if(route==='reports') return renderReports(user);
    if(route==='admin') return renderAdmin(user);
    if(route==='settings') return renderSettings(user);
    $('view').innerHTML = `<div class="notice">Unknown route.</div>`;
  }

  // Global search
  function wireGlobalSearch(){
    const input = $('globalSearch');
    input.addEventListener('keydown', (e)=>{
      if(e.key !== 'Enter') return;
      const q = input.value.trim().toLowerCase();
      if(!q){ location.hash = '#/tickets'; return; }
      location.hash = '#/tickets';
      setTimeout(()=>{ filterTicketsByQuery(q); }, 50);
    });
  }
  function filterTicketsByQuery(q){
    const input = document.querySelector('[data-ticket-filter]');
    if(input){ input.value = q; input.dispatchEvent(new Event('input')); }
  }

  function wireTopNewTicket(){
    $('newTicketTop').addEventListener('click', ()=>{
      const user = mustAuth(); if(!user) return;
      openTicketCreateModal(user);
    });
  }

  // ---------- Dashboard ----------
  function renderDashboard(user){
    const all = Alpha.Tickets.listTicketsForUser(user);
    const open = all.filter(t=>!['Resolved','Closed','Cancelled'].includes(t.status));
    const mine = all.filter(t=>t.assignedToId===user.id);
    const breaches = all.filter(t=>t._breach && (t._breach.frBreached || t._breach.resBreached));

    const latest = all.slice(0, 8);

    $('view').innerHTML = `
      <div class="grid">
        <div class="kpi"><div class="k">Total tickets</div><div class="v">${all.length}</div><div class="s">Visible to your role</div></div>
        <div class="kpi"><div class="k">Open</div><div class="v">${open.length}</div><div class="s">Not resolved/closed</div></div>
        <div class="kpi"><div class="k">Assigned to me</div><div class="v">${mine.length}</div><div class="s">Agent workload</div></div>
        <div class="kpi"><div class="k">SLA breaches</div><div class="v">${breaches.length}</div><div class="s">First response / resolution</div></div>
      </div>

      <div class="panel">
        <div class="panelHeader">
          <h3>Recent tickets</h3>
          <div class="flex">
            <button class="btn secondary small" id="dashNewTicket" type="button">+ New Ticket</button>
            <a class="btn secondary small" href="#/tickets">View all</a>
          </div>
        </div>
        <div class="panelBody">
          <div class="tableWrap desktopOnly">
            <table>
              <thead><tr>
                <th>ID</th><th>Subject</th><th>Status</th><th>Priority</th><th>Requester</th><th>Assigned</th><th>Created</th>
              </tr></thead>
              <tbody>
                ${latest.map(t=>`
                  <tr data-open-ticket="${t.id}" style="cursor:pointer">
                    <td><b>${Alpha.UI.esc(t.humanId)}</b></td>
                    <td>${Alpha.UI.esc(t.subject)}<span class="sub">${Alpha.UI.esc(t.category)} / ${Alpha.UI.esc(t.subcategory)}</span></td>
                    <td>${Alpha.UI.statusChip(t.status)} ${slaBadge(t)}</td>
                    <td>${Alpha.UI.priorityChip(t.priority)}</td>
                    <td>${Alpha.UI.esc(t.requesterName)}</td>
                    <td>${Alpha.UI.esc(t.assignedToName||'—')}</td>
                    <td>${Alpha.UI.fmtDate(t.createdAt)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
<div class="cardsList mobileOnly">
  ${latest.length ? latest.map(t=>`
    <div class="listCard" data-open-ticket="${t.id}">
      <div class="listCardTop">
        <div>
          <div class="listCardId">${Alpha.UI.esc(t.humanId)}</div>
          <div class="listCardSubject">${Alpha.UI.esc(t.subject)}</div>
          <div class="sub">${Alpha.UI.esc(t.category)} / ${Alpha.UI.esc(t.subcategory)}</div>
        </div>
        <div class="stack">
          ${Alpha.UI.statusChip(t.status)}
          ${Alpha.UI.priorityChip(t.priority)}
        </div>
      </div>
      <div class="listCardMeta">
        <div class="metaPair"><span class="metaKey">Requester</span><span class="metaVal">${Alpha.UI.esc(t.requesterName)}</span></div>
        <div class="metaPair"><span class="metaKey">Assigned</span><span class="metaVal">${Alpha.UI.esc(t.assignedToName||'—')}</span></div>
      </div>
      <div class="listCardFoot">
        <span>Created: ${Alpha.UI.fmtDate(t.createdAt)}</span>
        <span>${slaBadge(t)}</span>
      </div>
    </div>
  `).join('') : `<div class="notice">No tickets yet.</div>`}
</div>
        </div
      </div>
    `;

    document.querySelectorAll('[data-open-ticket]').forEach(tr=>{
      tr.addEventListener('click', ()=>location.hash = '#/tickets/'+tr.getAttribute('data-open-ticket'));
    });
    $('dashNewTicket').addEventListener('click', ()=>openTicketCreateModal(user));
  }

  function slaBadge(t){
    const b = t._breach || Alpha.Tickets.breachInfo(t);
    if(b.frBreached || b.resBreached){
      return `<span class="chip"><span class="dot danger"></span>SLA Breach</span>`;
    }
    const frDue = t.firstResponseDueAt ? Alpha.UI.relativeFromNow(t.firstResponseDueAt) : '';
    const resDue = t.resolutionDueAt ? Alpha.UI.relativeFromNow(t.resolutionDueAt) : '';
    if(!t.firstResponseAt && frDue) return `<span class="chip"><span class="dot warn"></span>FR ${Alpha.UI.esc(frDue)}</span>`;
    if(!t.resolvedAt && !t.closedAt && resDue) return `<span class="chip"><span class="dot warn"></span>RES ${Alpha.UI.esc(resDue)}</span>`;
    return '';
  }

  // ---------- Tickets list ----------
  function renderTickets(user){
    const tickets = Alpha.Tickets.listTicketsForUser(user);

    $('view').innerHTML = `
      <div class="panel">
        <div class="panelHeader">
          <h3>Tickets</h3>
          <div class="flex">
            <input data-ticket-filter type="text" placeholder="Filter: id, subject, requester, tag…" style="min-width:260px" />
            <select data-ticket-status>
              <option value="">All statuses</option>
              ${Alpha.Tickets.STATUS.map(s=>`<option value="${Alpha.UI.esc(s)}">${Alpha.UI.esc(s)}</option>`).join('')}
            </select>
            <select data-ticket-priority>
              <option value="">All priorities</option>
              ${['P1','P2','P3','P4'].map(p=>`<option value="${p}">${p}</option>`).join('')}
            </select>
            <button class="btn small" id="ticketsNew" type="button">+ New Ticket</button>
          </div>
        </div>
        <div class="panelBody">
          <div class="tableWrap desktopOnly">
            <table>
              <thead><tr>
                <th>ID</th><th>Subject</th><th>Status</th><th>Priority</th><th>Requester</th><th>Assigned</th><th>Updated</th>
              </tr></thead>
              <tbody id="ticketsBody"></tbody>
            </table>
          </div>

          <div class="cardsList mobileOnly" id="ticketsCards"></div>
        </div>
      </div>
    `;

    const body = $('ticketsBody');
    const cards = document.getElementById('ticketsCards');
    function row(t){
      return `
        <tr data-open-ticket="${t.id}" style="cursor:pointer">
          <td><b>${Alpha.UI.esc(t.humanId)}</b></td>
          <td>${Alpha.UI.esc(t.subject)}<span class="sub">${Alpha.UI.esc(t.category)} / ${Alpha.UI.esc(t.subcategory)}</span></td>
          <td>${Alpha.UI.statusChip(t.status)} ${slaBadge(t)}</td>
          <td>${Alpha.UI.priorityChip(t.priority)}</td>
          <td>${Alpha.UI.esc(t.requesterName)}</td>
          <td>${Alpha.UI.esc(t.assignedToName||'—')}</td>
          <td>${Alpha.UI.fmtDate(t.updatedAt)}</td>
        </tr>
      `;


function card(t){
  return `
    <div class="listCard" data-open-ticket="${t.id}">
      <div class="listCardTop">
        <div>
          <div class="listCardId">${Alpha.UI.esc(t.humanId)}</div>
          <div class="listCardSubject">${Alpha.UI.esc(t.subject)}</div>
          <div class="sub">${Alpha.UI.esc(t.category)} / ${Alpha.UI.esc(t.subcategory)}</div>
        </div>
        <div class="stack">
          ${Alpha.UI.statusChip(t.status)} ${slaBadge(t)}
          ${Alpha.UI.priorityChip(t.priority)}
        </div>
      </div>
      <div class="listCardMeta">
        <div class="metaPair"><span class="metaKey">Requester</span><span class="metaVal">${Alpha.UI.esc(t.requesterName)}</span></div>
        <div class="metaPair"><span class="metaKey">Assigned</span><span class="metaVal">${Alpha.UI.esc(t.assignedToName||'—')}</span></div>
      </div>
      <div class="listCardFoot">
        <span>Updated: ${Alpha.UI.fmtDate(t.updatedAt)}</span>
        <span>${(t.tags||[]).slice(0,3).map(x=>`<span class="badge">${Alpha.UI.esc(x)}</span>`).join(' ')}</span>
      </div>
    </div>
  `;
}

    }

    function apply(){
      const q = document.querySelector('[data-ticket-filter]').value.trim().toLowerCase();
      const st = document.querySelector('[data-ticket-status]').value;
      const pr = document.querySelector('[data-ticket-priority]').value;

      const filtered = tickets.filter(t=>{
        const hay = [
          t.humanId, t.subject, t.description, t.requesterName, t.assignedToName,
          (t.tags||[]).join(' ')
        ].join(' ').toLowerCase();
        if(q && !hay.includes(q)) return false;
        if(st && t.status !== st) return false;
        if(pr && t.priority !== pr) return false;
        return true;
      });

      body.innerHTML = filtered.map(row).join('') || `<tr><td colspan="7" class="smallMuted">No tickets match.</td></tr>`;

if(cards){
  cards.innerHTML = filtered.map(card).join('') || `<div class="notice">No tickets found.</div>`;
}
      document.querySelectorAll('[data-open-ticket]').forEach(tr=>{
        tr.addEventListener('click', ()=>location.hash = '#/tickets/'+tr.getAttribute('data-open-ticket'));
      });
    }

    document.querySelector('[data-ticket-filter]').addEventListener('input', apply);
    document.querySelector('[data-ticket-status]').addEventListener('change', apply);
    document.querySelector('[data-ticket-priority]').addEventListener('change', apply);
    $('ticketsNew').addEventListener('click', ()=>openTicketCreateModal(user));
    apply();
  }

  // ---------- Ticket detail ----------
  function renderTicketDetail(user, ticketId){
    const t = Alpha.Tickets.getTicket(ticketId);
    if(!t){ $('view').innerHTML = `<div class="notice">Ticket not found.</div>`; return; }

    const canAssign = Alpha.Auth.roleAtLeast(user.role,'Supervisor');
    const canAgent = Alpha.Auth.roleAtLeast(user.role,'Agent');
    const canEdit = canAgent || t.requesterId===user.id;

    const users = Alpha.DB.getAll(Alpha.DB.keys.users).filter(u=>u.active);
    const agentPool = users.filter(u=>Alpha.Auth.roleAtLeast(u.role,'Agent'));

    const worklogs = Alpha.DB.getAll(Alpha.DB.keys.worklogs).filter(w=>w.ticketId===t.id);

    $('view').innerHTML = `
      <div class="panel">
        <div class="panelHeader">
          <h3>${Alpha.UI.esc(t.humanId)} · ${Alpha.UI.esc(t.subject)}</h3>
          <div class="flex">
            <a class="btn secondary small" href="#/tickets">Back</a>
            ${canAgent ? `<button class="btn secondary small" id="btnAddWorklog" type="button">+ Worklog</button>`:''}
            <button class="btn small" id="btnEditTicket" type="button">Edit</button>
          </div>
        </div>
        <div class="panelBody">
          <div class="split">
            <div>
              <div class="notice">
                <div class="flex">
                  ${Alpha.UI.statusChip(t.status)} ${Alpha.UI.priorityChip(t.priority)} ${slaBadge(t)}
                  <span class="chip"><span class="dot primary"></span>${Alpha.UI.esc(t.type)}</span>
                  <span class="chip"><span class="dot primary"></span>${Alpha.UI.esc(t.category)} / ${Alpha.UI.esc(t.subcategory)}</span>
                </div>
                <div style="margin-top:10px" class="smallMuted">Requester: <b>${Alpha.UI.esc(t.requesterName)}</b> · Assigned: <b>${Alpha.UI.esc(t.assignedToName||'—')}</b></div>
                <div class="smallMuted" style="margin-top:6px">
                  Created: ${Alpha.UI.fmtDate(t.createdAt)} · Updated: ${Alpha.UI.fmtDate(t.updatedAt)}
                </div>
                <hr class="sep">
                <div style="white-space:pre-wrap;line-height:1.55">${Alpha.UI.esc(t.description || '—')}</div>
                ${t.tags && t.tags.length ? `<div style="margin-top:10px" class="pills">${t.tags.map(x=>`<span class="pill active">${Alpha.UI.esc(x)}</span>`).join('')}</div>`:''}
              </div>

              <div class="panel" style="margin-top:12px">
                <div class="panelHeader">
                  <h3>Conversation</h3>
                  <div class="smallMuted">Public replies</div>
                </div>
                <div class="panelBody">
                  <div id="commentsList">
                    ${(t.comments||[]).map(c=>timelineCard(`${c.byName}`, c.at, c.body, 'primary')).join('') || `<div class="smallMuted">No public replies yet.</div>`}
                  </div>
                  <hr class="sep">
                  <div class="field">
                    <label>Add public reply</label>
                    <textarea id="replyBody" placeholder="Type response…"></textarea>
                  </div>
                  <div class="flex">
                    <button class="btn" id="btnReply" type="button">Send reply</button>
                    ${canAgent ? `<button class="btn secondary" id="btnInternalNote" type="button">Add internal note</button>`:''}
                  </div>
                </div>
              </div>

              ${canAgent ? `
              <div class="panel" style="margin-top:12px">
                <div class="panelHeader">
                  <h3>Internal notes</h3>
                  <div class="smallMuted">Agent/Supervisor/Admin only</div>
                </div>
                <div class="panelBody">
                  ${(t.internalNotes||[]).map(n=>timelineCard(`${n.byName}`, n.at, n.body, 'warn')).join('') || `<div class="smallMuted">No internal notes.</div>`}
                </div>
              </div>
              `:''}
            </div>

            <div>
              <div class="panel">
                <div class="panelHeader"><h3>Assignment & Status</h3></div>
                <div class="panelBody">
                  ${canAssign ? `
                    <div class="field">
                      <label>Assign to</label>
                      <select id="assignTo">
                        <option value="">— Unassigned —</option>
                        ${agentPool.map(a=>`<option value="${a.id}" ${t.assignedToId===a.id?'selected':''}>${Alpha.UI.esc(a.name)} (${a.role})</option>`).join('')}
                      </select>
                    </div>
                  ` : `<div class="smallMuted">Assigned to: <b>${Alpha.UI.esc(t.assignedToName||'—')}</b></div>`}

                  <div class="field">
                    <label>Status</label>
                    <select id="statusSel" ${(!canAgent && !(t.requesterId===user.id))?'disabled':''}>
                      ${Alpha.Tickets.STATUS.map(s=>`<option value="${Alpha.UI.esc(s)}" ${t.status===s?'selected':''}>${Alpha.UI.esc(s)}</option>`).join('')}
                    </select>
                  </div>

                  <div class="notice">
                    <div class="smallMuted">First response due: <b>${Alpha.UI.fmtDate(t.firstResponseDueAt)}</b> (${Alpha.UI.relativeFromNow(t.firstResponseDueAt)})</div>
                    <div class="smallMuted">Resolution due: <b>${Alpha.UI.fmtDate(t.resolutionDueAt)}</b> (${Alpha.UI.relativeFromNow(t.resolutionDueAt)})</div>
                    <div class="smallMuted">First response at: <b>${Alpha.UI.fmtDate(t.firstResponseAt)}</b></div>
                    <div class="smallMuted">Resolved at: <b>${Alpha.UI.fmtDate(t.resolvedAt)}</b></div>
                    <div class="smallMuted">Closed at: <b>${Alpha.UI.fmtDate(t.closedAt)}</b></div>
                  </div>

                  <div class="flex">
                    <button class="btn secondary" id="btnSaveAssign" type="button">Save</button>
                    ${canAgent ? `<button class="btn danger" id="btnCancel" type="button">Cancel ticket</button>`:''}
                  </div>
                </div>
              </div>

              <div class="panel">
                <div class="panelHeader"><h3>Attachments</h3></div>
                <div class="panelBody">
                  <input type="file" id="attFile" />
                  <div class="helper">Files are stored in your browser (IndexedDB) and linked to this ticket.</div>
                  <hr class="sep">
                  <div id="attList">
                    ${(t.attachments||[]).map(a=>`
                      <div class="timelineItem">
                        <div class="meta">
                          <span class="chip"><span class="dot primary"></span>${Alpha.UI.esc(a.name)}</span>
                          <span class="smallMuted">${Math.round((a.size||0)/1024)} KB · ${Alpha.UI.fmtDate(a.at)}</span>
                        </div>
                        <div class="flex" style="margin-top:8px">
                          <button class="btn secondary small" data-att-dl="${a.id}" type="button">Download</button>
                          ${canAgent ? `<button class="btn danger small" data-att-del="${a.id}" type="button">Delete</button>`:''}
                        </div>
                      </div>
                    `).join('') || `<div class="smallMuted">No attachments.</div>`}
                  </div>
                </div>
              </div>

              <div class="panel">
                <div class="panelHeader"><h3>Worklogs</h3></div>
                <div class="panelBody">
                  ${(worklogs||[]).map(w=>timelineCard(`${w.byName} · ${w.minutes}m`, w.at, w.note||'(no note)', 'success')).join('') || `<div class="smallMuted">No worklogs.</div>`}
                </div>
              </div>

              <div class="panel">
                <div class="panelHeader"><h3>Timeline</h3></div>
                <div class="panelBody">
                  ${(t.timeline||[]).slice(0, 30).map(ev=>timelineCard(ev.byName, ev.at, ev.action, 'primary')).join('') || `<div class="smallMuted">No timeline entries.</div>`}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    `;

    // Wire actions
    const btnReply = $('btnReply');
    btnReply.addEventListener('click', ()=>{
      const body = $('replyBody').value;
      try{
        Alpha.Tickets.addComment(t.id, { body, kind:'public' }, user);
        Alpha.UI.toast('Sent', 'Public reply added.', 'success');
        render();
      }catch(err){ Alpha.UI.toast('Error', err.message || String(err), 'danger'); }
    });

    const btnInternal = $('btnInternalNote');
    if(btnInternal){
      btnInternal.addEventListener('click', ()=>{
        Alpha.UI.modal({
          title:'Add internal note',
          bodyHtml: `
            <div class="field">
              <label>Note</label>
              <textarea id="internalNoteBody" placeholder="Internal note (agents only)…"></textarea>
            </div>
          `,
          footerHtml: `
            <button class="btn secondary" data-close="1" type="button">Cancel</button>
            <button class="btn" id="saveInternalNote" type="button">Save</button>
          `
        });
        setTimeout(()=>{
          document.getElementById('saveInternalNote').addEventListener('click', ()=>{
            const body = document.getElementById('internalNoteBody').value;
            try{
              Alpha.Tickets.addComment(t.id, { body, kind:'internal' }, user);
              Alpha.UI.toast('Saved', 'Internal note added.', 'success');
              document.querySelector('.modalOverlay').remove();
              render();
            }catch(err){ Alpha.UI.toast('Error', err.message || String(err), 'danger'); }
          });
        }, 0);
      });
    }

    const btnSaveAssign = $('btnSaveAssign');
    btnSaveAssign.addEventListener('click', ()=>{
      const patch = {
        status: $('statusSel').value,
        assignedToId: canAssign ? $('assignTo').value || null : undefined
      };
      try{
        Alpha.Tickets.updateTicket(t.id, patch, user);
        Alpha.UI.toast('Saved', 'Ticket updated.', 'success');
        render();
      }catch(err){ Alpha.UI.toast('Error', err.message || String(err), 'danger'); }
    });

    const btnCancel = $('btnCancel');
    if(btnCancel){
      btnCancel.addEventListener('click', ()=>{
        const ok = confirm('Cancel this ticket?');
        if(!ok) return;
        try{
          Alpha.Tickets.updateTicket(t.id, { status:'Cancelled' }, user);
          Alpha.UI.toast('Cancelled', 'Ticket marked as Cancelled.', 'warn');
          render();
        }catch(err){ Alpha.UI.toast('Error', err.message || String(err), 'danger'); }
      });
    }

    $('btnEditTicket').addEventListener('click', ()=>openTicketEditModal(user, t));

    const btnAddWorklog = $('btnAddWorklog');
    if(btnAddWorklog){
      btnAddWorklog.addEventListener('click', ()=>openWorklogModal(user, t));
    }

    // Attachments
    $('attFile').addEventListener('change', async (e)=>{
      const file = e.target.files && e.target.files[0];
      if(!file) return;
      try{
        await Alpha.Tickets.addAttachment(t.id, file, user);
        Alpha.UI.toast('Uploaded', 'Attachment added.', 'success');
        render();
      }catch(err){ Alpha.UI.toast('Error', err.message || String(err), 'danger'); }
      e.target.value = '';
    });
    document.querySelectorAll('[data-att-dl]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const id = btn.getAttribute('data-att-dl');
        try{ await Alpha.Tickets.downloadAttachment(id); }
        catch(err){ Alpha.UI.toast('Error', err.message || String(err), 'danger'); }
      });
    });
    document.querySelectorAll('[data-att-del]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const id = btn.getAttribute('data-att-del');
        const ok = confirm('Delete attachment?');
        if(!ok) return;
        try{
          await Alpha.Tickets.deleteAttachment(t.id, id, user);
          Alpha.UI.toast('Deleted', 'Attachment removed.', 'warn');
          render();
        }catch(err){ Alpha.UI.toast('Error', err.message || String(err), 'danger'); }
      });
    });
  }

  function timelineCard(title, at, body, dot){
    return `
      <div class="timelineItem">
        <div class="meta">
          <span class="chip"><span class="dot ${dot}"></span>${Alpha.UI.esc(title)}</span>
          <span class="smallMuted">${Alpha.UI.fmtDate(at)}</span>
        </div>
        <div class="body">${Alpha.UI.esc(body)}</div>
      </div>
    `;
  }

  // ---------- Ticket modals ----------
  function openTicketCreateModal(user){
    const cats = Alpha.Tickets.CATS;
    const bodyHtml = `
      <div class="row">
        <div class="field">
          <label>Type</label>
          <select id="tType">${Alpha.Tickets.TYPES.map(x=>`<option>${Alpha.UI.esc(x)}</option>`).join('')}</select>
        </div>
        <div class="field">
          <label>Category</label>
          <select id="tCat">${cats.map(c=>`<option value="${Alpha.UI.esc(c.cat)}">${Alpha.UI.esc(c.cat)}</option>`).join('')}</select>
        </div>
      </div>
      <div class="row">
        <div class="field">
          <label>Subcategory</label>
          <select id="tSub"></select>
        </div>
        <div class="field">
          <label>Impact (1-3)</label>
          <select id="tImpact">
            <option value="1">1 (Low)</option>
            <option value="2" selected>2 (Medium)</option>
            <option value="3">3 (High)</option>
          </select>
        </div>
      </div>
      <div class="row">
        <div class="field">
          <label>Urgency (1-3)</label>
          <select id="tUrgency">
            <option value="1">1 (Low)</option>
            <option value="2" selected>2 (Medium)</option>
            <option value="3">3 (High)</option>
          </select>
        </div>
        <div class="field">
          <label>Tags (comma separated)</label>
          <input id="tTags" type="text" placeholder="e.g., vpn, laptop, access" />
        </div>
      </div>
      <div class="field">
        <label>Subject</label>
        <input id="tSubject" type="text" placeholder="Short summary" />
      </div>
      <div class="field">
        <label>Description</label>
        <textarea id="tDesc" placeholder="Detailed description…"></textarea>
      </div>
      <div class="notice" id="prioPreview">Priority: —</div>
    `;

    const ov = Alpha.UI.modal({
      title: 'Create ticket',
      bodyHtml,
      footerHtml: `
        <button class="btn secondary" data-close="1" type="button">Cancel</button>
        <button class="btn" id="createTicketBtn" type="button">Create</button>
      `
    });

    function setSubs(){
      const cat = document.getElementById('tCat').value;
      const c = cats.find(x=>x.cat===cat) || cats[cats.length-1];
      document.getElementById('tSub').innerHTML = c.subs.map(s=>`<option value="${Alpha.UI.esc(s)}">${Alpha.UI.esc(s)}</option>`).join('');
    }
    function setPrio(){
      const i = document.getElementById('tImpact').value;
      const u = document.getElementById('tUrgency').value;
      const p = Alpha.Tickets.priorityFromImpactUrgency(i,u);
      document.getElementById('prioPreview').innerHTML = `Priority: ${Alpha.UI.priorityChip(p)} <span class="smallMuted"> (computed from Impact/Urgency)</span>`;
    }
    setSubs(); setPrio();
    document.getElementById('tCat').addEventListener('change', setSubs);
    document.getElementById('tImpact').addEventListener('change', setPrio);
    document.getElementById('tUrgency').addEventListener('change', setPrio);

    document.getElementById('createTicketBtn').addEventListener('click', ()=>{
      try{
        const payload = {
          type: document.getElementById('tType').value,
          category: document.getElementById('tCat').value,
          subcategory: document.getElementById('tSub').value,
          impact: Number(document.getElementById('tImpact').value),
          urgency: Number(document.getElementById('tUrgency').value),
          tags: (document.getElementById('tTags').value||'').split(',').map(s=>s.trim()).filter(Boolean),
          subject: document.getElementById('tSubject').value,
          description: document.getElementById('tDesc').value
        };
        if(!payload.subject.trim()) throw new Error('Subject is required.');
        const t = Alpha.Tickets.createTicket(payload, user);
        Alpha.UI.toast('Created', `${t.humanId} created.`, 'success');
        ov.remove();
        location.hash = '#/tickets/'+t.id;
      }catch(err){ Alpha.UI.toast('Error', err.message || String(err), 'danger'); }
    });
  }

  function openTicketEditModal(user, t){
    const canEdit = Alpha.Auth.roleAtLeast(user.role,'Agent') || t.requesterId===user.id;
    if(!canEdit){ Alpha.UI.toast('Not permitted','You cannot edit this ticket.', 'danger'); return; }

    const cats = Alpha.Tickets.CATS;
    const bodyHtml = `
      <div class="row">
        <div class="field">
          <label>Type</label>
          <select id="eType">${Alpha.Tickets.TYPES.map(x=>`<option ${t.type===x?'selected':''}>${Alpha.UI.esc(x)}</option>`).join('')}</select>
        </div>
        <div class="field">
          <label>Category</label>
          <select id="eCat">${cats.map(c=>`<option value="${Alpha.UI.esc(c.cat)}" ${t.category===c.cat?'selected':''}>${Alpha.UI.esc(c.cat)}</option>`).join('')}</select>
        </div>
      </div>
      <div class="row">
        <div class="field">
          <label>Subcategory</label>
          <select id="eSub"></select>
        </div>
        <div class="field">
          <label>Impact (1-3)</label>
          <select id="eImpact">
            <option value="1" ${t.impact===1?'selected':''}>1 (Low)</option>
            <option value="2" ${t.impact===2?'selected':''}>2 (Medium)</option>
            <option value="3" ${t.impact===3?'selected':''}>3 (High)</option>
          </select>
        </div>
      </div>
      <div class="row">
        <div class="field">
          <label>Urgency (1-3)</label>
          <select id="eUrgency">
            <option value="1" ${t.urgency===1?'selected':''}>1 (Low)</option>
            <option value="2" ${t.urgency===2?'selected':''}>2 (Medium)</option>
            <option value="3" ${t.urgency===3?'selected':''}>3 (High)</option>
          </select>
        </div>
        <div class="field">
          <label>Tags (comma separated)</label>
          <input id="eTags" type="text" value="${Alpha.UI.esc((t.tags||[]).join(', '))}" />
        </div>
      </div>
      <div class="field">
        <label>Subject</label>
        <input id="eSubject" type="text" value="${Alpha.UI.esc(t.subject)}" />
      </div>
      <div class="field">
        <label>Description</label>
        <textarea id="eDesc">${Alpha.UI.esc(t.description||'')}</textarea>
      </div>
      <div class="notice" id="ePrioPreview">Priority: —</div>
    `;

    const ov = Alpha.UI.modal({
      title: `Edit ${t.humanId}`,
      bodyHtml,
      footerHtml: `
        <button class="btn secondary" data-close="1" type="button">Cancel</button>
        <button class="btn" id="saveEditBtn" type="button">Save</button>
      `
    });

    function setSubs(){
      const cat = document.getElementById('eCat').value;
      const c = cats.find(x=>x.cat===cat) || cats[cats.length-1];
      const sub = document.getElementById('eSub');
      sub.innerHTML = c.subs.map(s=>`<option value="${Alpha.UI.esc(s)}">${Alpha.UI.esc(s)}</option>`).join('');
      const want = (c.subs.includes(t.subcategory) ? t.subcategory : c.subs[0]);
      sub.value = want;
    }
    function setPrio(){
      const i = document.getElementById('eImpact').value;
      const u = document.getElementById('eUrgency').value;
      const p = Alpha.Tickets.priorityFromImpactUrgency(i,u);
      document.getElementById('ePrioPreview').innerHTML = `Priority (computed): ${Alpha.UI.priorityChip(p)}`;
    }
    setSubs(); setPrio();
    document.getElementById('eCat').addEventListener('change', setSubs);
    document.getElementById('eImpact').addEventListener('change', setPrio);
    document.getElementById('eUrgency').addEventListener('change', setPrio);

    document.getElementById('saveEditBtn').addEventListener('click', ()=>{
      try{
        const patch = {
          type: document.getElementById('eType').value,
          category: document.getElementById('eCat').value,
          subcategory: document.getElementById('eSub').value,
          impact: Number(document.getElementById('eImpact').value),
          urgency: Number(document.getElementById('eUrgency').value),
          tags: (document.getElementById('eTags').value||'').split(',').map(s=>s.trim()).filter(Boolean),
          subject: document.getElementById('eSubject').value,
          description: document.getElementById('eDesc').value
        };
        if(!patch.subject.trim()) throw new Error('Subject is required.');
        Alpha.Tickets.updateTicket(t.id, patch, user);
        Alpha.UI.toast('Saved','Ticket updated.', 'success');
        ov.remove();
        render();
      }catch(err){ Alpha.UI.toast('Error', err.message || String(err), 'danger'); }
    });
  }

  function openWorklogModal(user, t){
    Alpha.UI.modal({
      title:`Worklog · ${t.humanId}`,
      bodyHtml: `
        <div class="row">
          <div class="field">
            <label>Minutes</label>
            <input id="wlMin" type="number" min="1" value="15" />
          </div>
          <div class="field">
            <label>Note</label>
            <input id="wlNote" type="text" placeholder="What was done?" />
          </div>
        </div>
      `,
      footerHtml: `
        <button class="btn secondary" data-close="1" type="button">Cancel</button>
        <button class="btn" id="wlSave" type="button">Save</button>
      `
    });
    setTimeout(()=>{
      document.getElementById('wlSave').addEventListener('click', ()=>{
        try{
          Alpha.Tickets.addWorklog(t.id, { minutes: document.getElementById('wlMin').value, note: document.getElementById('wlNote').value }, user);
          Alpha.UI.toast('Saved', 'Worklog added.', 'success');
          document.querySelector('.modalOverlay').remove();
          render();
        }catch(err){ Alpha.UI.toast('Error', err.message || String(err), 'danger'); }
      });
    },0);
  }

  // ---------- KB ----------
  function renderKB(user){
    const items = Alpha.KB.listPublished();
    const canManage = Alpha.Auth.roleAtLeast(user.role,'Agent');

    $('view').innerHTML = `
      <div class="panel">
        <div class="panelHeader">
          <h3>Knowledge Base</h3>
          <div class="flex">
            <input id="kbFilter" type="text" placeholder="Search KB…" style="min-width:260px" />
            ${canManage ? `<button class="btn small" id="kbNew" type="button">+ New Article</button>`:''}
          </div>
        </div>
        <div class="panelBody">
          <div id="kbList"></div>
        </div>
      </div>
    `;

    const list = document.getElementById('kbList');
    function draw(filter){
      const q = (filter||'').trim().toLowerCase();
      const filtered = items.filter(a=>{
        const hay = [a.title,a.category,(a.tags||[]).join(' '),a.body].join(' ').toLowerCase();
        return !q || hay.includes(q);
      });
      list.innerHTML = filtered.map(a=>`
        <div class="timelineItem" data-kb-open="${a.id}" style="cursor:pointer">
          <div class="meta">
            <span class="chip"><span class="dot primary"></span>${Alpha.UI.esc(a.title)}</span>
            <span class="smallMuted">${Alpha.UI.esc(a.category)} · Updated ${Alpha.UI.fmtShort(a.updatedAt)}</span>
          </div>
          <div class="body">${Alpha.UI.esc((a.body||'').slice(0,180))}${(a.body||'').length>180?'…':''}</div>
          <div class="smallMuted">Tags: ${(a.tags||[]).map(t=>`<span class="pill active">${Alpha.UI.esc(t)}</span>`).join(' ') || '—'}</div>
        </div>
      `).join('') || `<div class="smallMuted">No KB results.</div>`;

      document.querySelectorAll('[data-kb-open]').forEach(el=>{
        el.addEventListener('click', ()=>location.hash = '#/kb/'+el.getAttribute('data-kb-open'));
      });
    }
    draw('');

    document.getElementById('kbFilter').addEventListener('input', (e)=>draw(e.target.value));
    const kbNew = document.getElementById('kbNew');
    if(kbNew) kbNew.addEventListener('click', ()=>openKBEditModal(user, null));
  }

  function renderKBDetail(user, kbId){
    const a = Alpha.KB.get(kbId);
    if(!a){ $('view').innerHTML = `<div class="notice">Article not found.</div>`; return; }
    const canManage = Alpha.Auth.roleAtLeast(user.role,'Agent');

    $('view').innerHTML = `
      <div class="panel">
        <div class="panelHeader">
          <h3>${Alpha.UI.esc(a.title)}</h3>
          <div class="flex">
            <a class="btn secondary small" href="#/kb">Back</a>
            ${canManage ? `<button class="btn secondary small" id="kbEdit" type="button">Edit</button>`:''}
          </div>
        </div>
        <div class="panelBody">
          <div class="notice">
            <div class="flex">
              <span class="chip"><span class="dot primary"></span>${Alpha.UI.esc(a.category)}</span>
              <span class="chip"><span class="dot ${a.published?'success':'warn'}"></span>${a.published?'Published':'Draft'}</span>
              <span class="smallMuted">Author: <b>${Alpha.UI.esc(a.author||'—')}</b></span>
              <span class="smallMuted">Updated: <b>${Alpha.UI.fmtDate(a.updatedAt)}</b></span>
            </div>
            <hr class="sep">
            <div style="white-space:pre-wrap;line-height:1.55">${Alpha.UI.esc(a.body||'')}</div>
            ${a.tags && a.tags.length ? `<div style="margin-top:10px" class="pills">${a.tags.map(x=>`<span class="pill active">${Alpha.UI.esc(x)}</span>`).join('')}</div>`:''}
          </div>
        </div>
      </div>
    `;

    const kbEdit = document.getElementById('kbEdit');
    if(kbEdit) kbEdit.addEventListener('click', ()=>openKBEditModal(user, a));
  }

  function openKBEditModal(user, article){
    const a = article || { title:'', category:'General', tags:[], body:'', published:false };
    const isNew = !article;

    Alpha.UI.modal({
      title: isNew ? 'New KB Article' : `Edit KB: ${a.title}`,
      bodyHtml: `
        <div class="row">
          <div class="field">
            <label>Title</label>
            <input id="kTitle" type="text" value="${Alpha.UI.esc(a.title||'')}" />
          </div>
          <div class="field">
            <label>Category</label>
            <input id="kCat" type="text" value="${Alpha.UI.esc(a.category||'General')}" />
          </div>
        </div>
        <div class="row">
          <div class="field">
            <label>Tags (comma separated)</label>
            <input id="kTags" type="text" value="${Alpha.UI.esc((a.tags||[]).join(', '))}" />
          </div>
          <div class="field">
            <label>Published</label>
            <select id="kPub">
              <option value="0" ${a.published?'' : 'selected'}>Draft</option>
              <option value="1" ${a.published?'selected' : ''}>Published</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label>Body</label>
          <textarea id="kBody">${Alpha.UI.esc(a.body||'')}</textarea>
        </div>
        <div class="notice">Only Agent+ can create KB. Editing requires Supervisor+, or the original author (Agent).</div>
      `,
      footerHtml: `
        <button class="btn secondary" data-close="1" type="button">Cancel</button>
        ${!isNew ? `<button class="btn danger" id="kDel" type="button">Delete</button>` : ''}
        <button class="btn" id="kSave" type="button">Save</button>
      `
    });

    setTimeout(()=>{
      const save = document.getElementById('kSave');
      save.addEventListener('click', ()=>{
        try{
          const out = {
            id: a.id,
            title: document.getElementById('kTitle').value,
            category: document.getElementById('kCat').value,
            tags: (document.getElementById('kTags').value||'').split(',').map(s=>s.trim()).filter(Boolean),
            published: document.getElementById('kPub').value==='1',
            body: document.getElementById('kBody').value
          };
          const saved = Alpha.KB.upsert(out, user);
          Alpha.UI.toast('Saved', 'KB article saved.', 'success');
          document.querySelector('.modalOverlay').remove();
          location.hash = '#/kb/'+saved.id;
        }catch(err){ Alpha.UI.toast('Error', err.message || String(err), 'danger'); }
      });

      const del = document.getElementById('kDel');
      if(del){
        del.addEventListener('click', ()=>{
          const ok = confirm('Delete this article?');
          if(!ok) return;
          try{
            Alpha.KB.remove(a.id, user);
            Alpha.UI.toast('Deleted','KB removed.', 'warn');
            document.querySelector('.modalOverlay').remove();
            location.hash = '#/kb';
          }catch(err){ Alpha.UI.toast('Error', err.message || String(err), 'danger'); }
        });
      }
    },0);
  }

  // ---------- Reports ----------
  function renderReports(user){
    if(!Alpha.Auth.roleAtLeast(user.role,'Agent')){
      $('view').innerHTML = `<div class="notice">Agent+ required.</div>`;
      return;
    }

    const startDefault = new Date(); startDefault.setDate(startDefault.getDate()-7);
    const fmt = (d)=>d.toISOString().slice(0,10);

    $('view').innerHTML = `
      <div class="panel">
        <div class="panelHeader">
          <h3>Reports</h3>
          <div class="flex">
            <div class="field" style="margin:0">
              <label style="margin-bottom:4px">Start</label>
              <input id="rStart" type="date" value="${fmt(startDefault)}" />
            </div>
            <div class="field" style="margin:0">
              <label style="margin-bottom:4px">End</label>
              <input id="rEnd" type="date" value="${fmt(new Date())}" />
            </div>
            <button class="btn secondary small" id="rRun" type="button">Run</button>
            <button class="btn small" id="rExportTickets" type="button">Export Tickets CSV</button>
            <button class="btn small" id="rExportWorklogs" type="button">Export Worklogs CSV</button>
          </div>
        </div>
        <div class="panelBody">
          <div id="rKPIs" class="grid"></div>
          <div class="split">
            <div class="panel">
              <div class="panelHeader"><h3>By Status</h3></div>
              <div class="panelBody" id="rStatus"></div>
            </div>
            <div class="panel">
              <div class="panelHeader"><h3>By Priority</h3></div>
              <div class="panelBody" id="rPriority"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    function run(){
      const start = document.getElementById('rStart').value;
      const end = document.getElementById('rEnd').value;
      const endIso = end ? new Date(end+'T23:59:59').toISOString() : null;
      const startIso = start ? new Date(start+'T00:00:00').toISOString() : null;

      const tickets = Alpha.Reports.ticketsInRange(startIso, endIso, user);
      const ids = tickets.map(t=>t.id);
      const wl = Alpha.Reports.sumWorklogs(ids, startIso, endIso);
      const avgRes = Alpha.Reports.avgResolutionMinutes(tickets);
      const breaches = Alpha.Reports.breachCounts(tickets);

      document.getElementById('rKPIs').innerHTML = `
        <div class="kpi"><div class="k">Tickets created</div><div class="v">${tickets.length}</div><div class="s">${start} → ${end}</div></div>
        <div class="kpi"><div class="k">Worklog minutes</div><div class="v">${wl.totalMin}</div><div class="s">${Math.round(wl.totalMin/60)} hours</div></div>
        <div class="kpi"><div class="k">Avg resolution</div><div class="v">${avgRes}</div><div class="s">minutes</div></div>
        <div class="kpi"><div class="k">Breaches</div><div class="v">${breaches.firstResponseBreaches + breaches.resolutionBreaches}</div><div class="s">FR: ${breaches.firstResponseBreaches} · RES: ${breaches.resolutionBreaches}</div></div>
      `;

      document.getElementById('rStatus').innerHTML = renderKeyValue(Alpha.Reports.byStatus(tickets));
      document.getElementById('rPriority').innerHTML = renderKeyValue(Alpha.Reports.byPriority(tickets));

      window.__reportCache = { tickets, worklogs: wl.logs, start, end };
    }

    function renderKeyValue(map){
      const keys = Object.keys(map);
      if(keys.length===0) return `<div class="smallMuted">No data in range.</div>`;
      return keys.sort((a,b)=>map[b]-map[a]).map(k=>`
        <div class="timelineItem">
          <div class="meta">
            <span class="chip"><span class="dot primary"></span>${Alpha.UI.esc(k)}</span>
            <span class="smallMuted">${map[k]} items</span>
          </div>
        </div>
      `).join('');
    }

    document.getElementById('rRun').addEventListener('click', run);
    document.getElementById('rExportTickets').addEventListener('click', ()=>{
      if(!window.__reportCache) run();
      const rows = Alpha.Reports.ticketRowsForCSV(window.__reportCache.tickets);
      const csv = Alpha.UI.toCSV(rows);
      Alpha.UI.download(`tickets_${window.__reportCache.start}_${window.__reportCache.end}.csv`, csv, 'text/csv');
    });
    document.getElementById('rExportWorklogs').addEventListener('click', ()=>{
      if(!window.__reportCache) run();
      const rows = Alpha.Reports.worklogRowsForCSV(window.__reportCache.worklogs);
      const csv = Alpha.UI.toCSV(rows);
      Alpha.UI.download(`worklogs_${window.__reportCache.start}_${window.__reportCache.end}.csv`, csv, 'text/csv');
    });

    run();
  }

  // ---------- Admin ----------
  function renderAdmin(user){
    if(!Alpha.Auth.roleAtLeast(user.role,'Admin')){
      $('view').innerHTML = `<div class="notice">Admin access required.</div>`;
      return;
    }
    const users = Alpha.DB.getAll(Alpha.DB.keys.users);

    $('view').innerHTML = `
      <div class="split">
        <div class="panel">
          <div class="panelHeader">
            <h3>Users</h3>
            <button class="btn small" id="uNew" type="button">+ New User</button>
          </div>
          <div class="panelBody">
            <div class="tableWrap desktopOnly">
              <table style="min-width:720px">
                <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  ${users.map(u=>`
                    <tr>
                      <td><b>${Alpha.UI.esc(u.name)}</b><span class="sub">${Alpha.UI.esc(u.email||'')}</span></td>
                      <td>${Alpha.UI.esc(u.username)}</td>
                      <td>${Alpha.UI.esc(u.role)}</td>
                      <td>${u.active ? `<span class="chip"><span class="dot success"></span>Active</span>` : `<span class="chip"><span class="dot danger"></span>Disabled</span>`}</td>
                      <td class="flex">
                        <button class="btn secondary small" data-u-edit="${u.id}" type="button">Edit</button>
                        <button class="btn secondary small" data-u-pass="${u.id}" type="button">Reset PW</button>
                        <button class="btn ${u.active?'danger':'secondary'} small" data-u-toggle="${u.id}" type="button">${u.active?'Disable':'Enable'}</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
<div class="cardsList mobileOnly" id="usersCards">
  ${users.length ? users.map(u=>`
    <div class="listCard">
      <div class="listCardTop">
        <div>
          <div class="listCardSubject">${Alpha.UI.esc(u.name)}</div>
          <div class="sub">${Alpha.UI.esc(u.email||'')}</div>
          <div class="listCardId">@${Alpha.UI.esc(u.username)}</div>
        </div>
        <div class="stack">
          <span class="chip"><span class="dot primary"></span>${Alpha.UI.esc(u.role)}</span>
          ${u.active ? `<span class="chip"><span class="dot success"></span>Active</span>` : `<span class="chip"><span class="dot danger"></span>Disabled</span>`}
        </div>
      </div>
      <div class="listCardFoot">
        <span></span>
        <span class="flex" style="justify-content:flex-end">
          <button class="btn secondary small" data-u-edit="${u.id}">Edit</button>
          <button class="btn secondary small" data-u-toggle="${u.id}">${u.active?'Disable':'Enable'}</button>
          <button class="btn secondary small" data-u-pass="${u.id}">Reset password</button>
        </span>
      </div>
    </div>
  `).join('') : `<div class="notice">No users.</div>`}
</div>
          </div
        </div>

        <div>
          <div class="panel">
            <div class="panelHeader"><h3>Branding</h3></div>
            <div class="panelBody">
              <div class="row">
                <div class="field">
                  <label>App name</label>
                  <input id="bName" type="text" value="${Alpha.UI.esc(Alpha.DB.getSettings().appName)}" />
                </div>
                <div class="field">
                  <label>Primary color</label>
                  <input id="bColor" type="text" value="${Alpha.UI.esc(Alpha.DB.getSettings().primary)}" placeholder="#3b82f6" />
                </div>
              </div>
              <div class="field">
                <label>Tag line</label>
                <input id="bTag" type="text" value="${Alpha.UI.esc(Alpha.DB.getSettings().tagLine||'')}" />
              </div>
              <div class="field">
                <label>Logo (optional)</label>
                <input id="bLogo" type="file" accept="image/*" />
                <div class="helper">Upload a PNG/JPG/SVG and it will be stored locally.</div>
              </div>
              <div class="flex">
                <button class="btn" id="bSave" type="button">Save Branding</button>
                <button class="btn secondary" id="bClearLogo" type="button">Clear Logo</button>
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="panelHeader"><h3>Backup / Restore</h3></div>
            <div class="panelBody">
              <div class="notice">Export a JSON backup for local migration. Restore requires Admin.</div>
              <div class="flex" style="margin-top:10px">
                <button class="btn secondary" id="bkExport" type="button">Export JSON</button>
                <input id="bkImport" type="file" accept="application/json" />
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="panelHeader"><h3>Audit trail</h3></div>
            <div class="panelBody" id="auditList"></div>
          </div>
        </div>
      </div>
    `;

    // Audit list
    const audit = Alpha.DB.getAll(Alpha.DB.keys.audit).slice(0, 20);
    document.getElementById('auditList').innerHTML = audit.map(a=>timelineCard(a.actor, a.at, a.action, 'primary')).join('') || `<div class="smallMuted">No audit events.</div>`;

    // Branding
    document.getElementById('bSave').addEventListener('click', async ()=>{
      try{
        let logoDataUrl = undefined;
        const f = document.getElementById('bLogo').files[0];
        if(f){
          logoDataUrl = await fileToDataUrl(f);
        }
        Alpha.Admin.setBranding({
          appName: document.getElementById('bName').value,
          tagLine: document.getElementById('bTag').value,
          primary: document.getElementById('bColor').value,
          logoDataUrl
        }, user);
        Alpha.UI.applyBranding();
        Alpha.UI.toast('Saved','Branding updated.', 'success');
        location.reload();
      }catch(err){ Alpha.UI.toast('Error', err.message || String(err), 'danger'); }
    });
    document.getElementById('bClearLogo').addEventListener('click', ()=>{
      try{
        Alpha.Admin.setBranding({ logoDataUrl: null }, user);
        Alpha.UI.toast('Saved','Logo cleared.', 'warn');
        location.reload();
      }catch(err){ Alpha.UI.toast('Error', err.message || String(err), 'danger'); }
    });

    // Backup/Restore
    document.getElementById('bkExport').addEventListener('click', ()=>{
      try{
        const data = Alpha.Admin.backupAll(user);
        Alpha.UI.download(`alpha-berthaphil_backup_${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(data, null, 2), 'application/json');
      }catch(err){ Alpha.UI.toast('Error', err.message || String(err), 'danger'); }
    });
    document.getElementById('bkImport').addEventListener('change', async (e)=>{
      const f = e.target.files && e.target.files[0];
      if(!f) return;
      const ok = confirm('Restore from this backup JSON? This overwrites local data.');
      if(!ok){ e.target.value=''; return; }
      try{
        const text = await f.text();
        const data = JSON.parse(text);
        Alpha.Admin.restoreAll(data, user);
        Alpha.UI.toast('Restored','Backup restored. Reloading…', 'success');
        setTimeout(()=>location.reload(), 600);
      }catch(err){ Alpha.UI.toast('Error', err.message || String(err), 'danger'); }
      e.target.value='';
    });

    // User actions
    document.getElementById('uNew').addEventListener('click', ()=>openUserModal(user, null));
    document.querySelectorAll('[data-u-edit]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = btn.getAttribute('data-u-edit');
        const u = users.find(x=>x.id===id);
        openUserModal(user, u);
      });
    });
    document.querySelectorAll('[data-u-toggle]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = btn.getAttribute('data-u-toggle');
        const u = users.find(x=>x.id===id);
        const ok = confirm(`${u.active?'Disable':'Enable'} user ${u.username}?`);
        if(!ok) return;
        try{
          Alpha.Admin.deactivateUser(id, !u.active, user);
          Alpha.UI.toast('Saved', 'User status updated.', 'success');
          render();
        }catch(err){ Alpha.UI.toast('Error', err.message || String(err), 'danger'); }
      });
    });
    document.querySelectorAll('[data-u-pass]').forEach(btn=>{
      btn.addEventListener('click', ()=>openResetPasswordModal(user, btn.getAttribute('data-u-pass')));
    });
  }

  async function fileToDataUrl(file){
    const buf = await file.arrayBuffer();
    const b = new Uint8Array(buf);
    let bin='';
    for(let i=0;i<b.length;i++) bin += String.fromCharCode(b[i]);
    return `data:${file.type};base64,${btoa(bin)}`;
  }

  function openUserModal(actor, user){
    const isNew = !user;
    const u = user || { username:'', email:'', name:'', role:'Requester', active:true, tempPassword:'changeme' };
    Alpha.UI.modal({
      title: isNew ? 'New user' : `Edit user: ${u.username}`,
      bodyHtml: `
        <div class="row">
          <div class="field"><label>Name</label><input id="uName" type="text" value="${Alpha.UI.esc(u.name||'')}" /></div>
          <div class="field"><label>Username</label><input id="uUser" type="text" value="${Alpha.UI.esc(u.username||'')}" /></div>
        </div>
        <div class="row">
          <div class="field"><label>Email</label><input id="uEmail" type="email" value="${Alpha.UI.esc(u.email||'')}" /></div>
          <div class="field"><label>Role</label>
            <select id="uRole">
              ${Alpha.Auth.ROLE_ORDER.map(r=>`<option value="${r}" ${(u.role===r)?'selected':''}>${r}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="row">
          <div class="field"><label>Status</label>
            <select id="uActive">
              <option value="1" ${u.active?'selected':''}>Active</option>
              <option value="0" ${!u.active?'selected':''}>Disabled</option>
            </select>
          </div>
          <div class="field">
            <label>${isNew?'Temp password':'(Optional) Temp password'}</label>
            <input id="uTempPw" type="text" value="${Alpha.UI.esc(isNew ? u.tempPassword : '')}" placeholder="${isNew?'changeme':'leave blank'}" />
            <div class="helper">For new users this will be hashed on next login.</div>
          </div>
        </div>
      `,
      footerHtml: `
        <button class="btn secondary" data-close="1" type="button">Cancel</button>
        <button class="btn" id="uSaveBtn" type="button">Save</button>
      `
    });

    setTimeout(()=>{
      document.getElementById('uSaveBtn').addEventListener('click', ()=>{
        try{
          const out = {
            id: u.id,
            name: document.getElementById('uName').value,
            username: document.getElementById('uUser').value,
            email: document.getElementById('uEmail').value,
            role: document.getElementById('uRole').value,
            active: document.getElementById('uActive').value==='1',
            tempPassword: document.getElementById('uTempPw').value
          };
          Alpha.Admin.upsertUser(out, actor);
          Alpha.UI.toast('Saved','User saved.', 'success');
          document.querySelector('.modalOverlay').remove();
          render();
        }catch(err){ Alpha.UI.toast('Error', err.message || String(err), 'danger'); }
      });
    },0);
  }

  function openResetPasswordModal(actor, userId){
    const users = Alpha.DB.getAll(Alpha.DB.keys.users);
    const u = users.find(x=>x.id===userId);
    if(!u){ Alpha.UI.toast('Error','User not found.', 'danger'); return; }

    Alpha.UI.modal({
      title:`Reset password: ${u.username}`,
      bodyHtml: `
        <div class="field">
          <label>New password</label>
          <input id="rpw" type="text" value="changeme123" />
          <div class="helper">User should change password after login.</div>
        </div>
      `,
      footerHtml: `
        <button class="btn secondary" data-close="1" type="button">Cancel</button>
        <button class="btn" id="rpwSave" type="button">Reset</button>
      `
    });

    setTimeout(()=>{
      document.getElementById('rpwSave').addEventListener('click', async ()=>{
        try{
          const pw = document.getElementById('rpw').value;
          await Alpha.Auth.adminSetPassword(u.id, pw, actor);
          Alpha.UI.toast('Done','Password reset.', 'success');
          document.querySelector('.modalOverlay').remove();
        }catch(err){ Alpha.UI.toast('Error', err.message || String(err), 'danger'); }
      });
    },0);
  }

  // ---------- Settings ----------
  function renderSettings(user){
    $('view').innerHTML = `
      <div class="panel">
        <div class="panelHeader"><h3>Settings</h3></div>
        <div class="panelBody">
          <div class="notice">
            <div class="smallMuted">Signed in as <b>${Alpha.UI.esc(user.name)}</b> (${Alpha.UI.esc(user.role)}).</div>
          </div>
          <div class="panel" style="margin-top:12px">
            <div class="panelHeader"><h3>Change password</h3></div>
            <div class="panelBody">
              <div class="row">
                <div class="field"><label>Old password</label><input id="pwOld" type="password" /></div>
                <div class="field"><label>New password</label><input id="pwNew" type="password" /></div>
              </div>
              <div class="flex">
                <button class="btn" id="pwSave" type="button">Update password</button>
              </div>
            </div>
          </div>

          <div class="panel" style="margin-top:12px">
            <div class="panelHeader"><h3>Local data</h3></div>
            <div class="panelBody">
              <div class="notice">This will remove all LocalStorage data for this app in this browser (attachments in IndexedDB remain).</div>
              <div class="flex" style="margin-top:10px">
                <button class="btn danger" id="wipeData" type="button">Wipe Local Data</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('pwSave').addEventListener('click', async ()=>{
      try{
        await Alpha.Auth.changePassword(user.id, document.getElementById('pwOld').value, document.getElementById('pwNew').value);
        Alpha.UI.toast('Saved','Password updated.', 'success');
        document.getElementById('pwOld').value='';
        document.getElementById('pwNew').value='';
      }catch(err){ Alpha.UI.toast('Error', err.message || String(err), 'danger'); }
    });

    document.getElementById('wipeData').addEventListener('click', ()=>{
      const ok = confirm('Wipe local data? You will be logged out.');
      if(!ok) return;
      Alpha.Auth.logout();
      Alpha.DB.resetAll();
      Alpha.DB.ensureSeed(true);
      Alpha.UI.toast('Done','Local data wiped and demo reseeded.', 'warn');
      setTimeout(()=>window.location.href='./index.html', 600);
    });
  }

  // ---------- Init ----------
  (async function init(){
    Alpha.DB.ensureSeed();
    await Alpha.Auth.ensureUserHashes();
    const user = mustAuth(); if(!user) return;

    $('logoutBtn').addEventListener('click', ()=>{
      Alpha.Auth.logout();
      window.location.href = './index.html';
    });

    wireGlobalSearch();
    wireTopNewTicket();

    window.addEventListener('hashchange', render);
    render();

    // keep SLA indicators fresh
    setInterval(()=>{ const { route } = parseHash(); if(route==='dashboard' || route==='tickets') render(); }, 60000);
  })();
})();