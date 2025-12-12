(function(){
  const Alpha = window.Alpha = window.Alpha || {};

  const STATUS = ['New','Assigned','In Progress','Pending Customer','Pending Vendor','Resolved','Closed','Reopened','Cancelled'];
  const TYPES = ['Incident','Service Request'];
  const CATS = [
    { cat:'Hardware', subs:['Desktop','Laptop','Printer','Monitor','Peripherals'] },
    { cat:'Software', subs:['OS','Office','Browser','Lob App','Licensing'] },
    { cat:'Network', subs:['VPN','WiFi','LAN','DNS','Firewall'] },
    { cat:'Access', subs:['Account','Permissions','MFA','Password Reset'] },
    { cat:'Other', subs:['General'] }
  ];

  function priorityFromImpactUrgency(impact, urgency){
    const i = Number(impact), u = Number(urgency);
    if(i===3 && u===3) return 'P1';
    if((i===3 && u===2) || (i===2 && u===3)) return 'P2';
    if((i===2 && u===2) || (i===3 && u===1) || (i===1 && u===3)) return 'P3';
    return 'P4';
  }

  function slaTargetsMinutes(priority){
    // Typical desk SLA defaults (can be changed later in settings)
    if(priority==='P1') return { firstResponse: 15, resolution: 240 };  // 4h
    if(priority==='P2') return { firstResponse: 30, resolution: 480 };  // 8h
    if(priority==='P3') return { firstResponse: 60, resolution: 1440 }; // 24h
    return { firstResponse: 120, resolution: 2880 }; // 48h
  }

  function addMinutes(iso, mins){
    const d = new Date(iso); d.setMinutes(d.getMinutes()+mins); return d.toISOString();
  }

  function computeSLA(ticket){
    const created = ticket.createdAt;
    const targets = slaTargetsMinutes(ticket.priority);
    ticket.firstResponseDueAt = ticket.firstResponseDueAt || addMinutes(created, targets.firstResponse);
    ticket.resolutionDueAt = ticket.resolutionDueAt || addMinutes(created, targets.resolution);
    ticket.firstResponseAt = ticket.firstResponseAt || null;
    ticket.resolvedAt = ticket.resolvedAt || null;
  }

  function breachInfo(ticket){
    const now = Date.now();
    const frDue = ticket.firstResponseDueAt ? new Date(ticket.firstResponseDueAt).getTime() : null;
    const resDue = ticket.resolutionDueAt ? new Date(ticket.resolutionDueAt).getTime() : null;

    const frDone = ticket.firstResponseAt ? true : false;
    const resDone = ticket.resolvedAt || ticket.closedAt ? true : false;

    const frBreached = frDue && !frDone && now > frDue;
    const resBreached = resDue && !resDone && now > resDue;

    return { frBreached, resBreached };
  }

  function listTickets(){
    return Alpha.DB.getAll(Alpha.DB.keys.tickets).map(t=>{
      computeSLA(t);
      const b = breachInfo(t);
      t._breach = b;
      return t;
    });
  }

  function getTicket(id){
    const t = Alpha.DB.getAll(Alpha.DB.keys.tickets).find(x=>x.id===id);
    if(!t) return null;
    computeSLA(t);
    t._breach = breachInfo(t);
    return t;
  }

  function saveTickets(arr){
    Alpha.DB.setAll(Alpha.DB.keys.tickets, arr);
    return arr;
  }

  function listTicketsForUser(user){
    const all = listTickets();
    if(!user) return [];
    if(Alpha.Auth.roleAtLeast(user.role,'Supervisor')) return all;
    if(user.role==='Agent'){
      return all.filter(t=>t.assignedToId===user.id || t.requesterId===user.id);
    }
    return all.filter(t=>t.requesterId===user.id);
  }

  function createTicket(payload, actor){
    const tickets = Alpha.DB.getAll(Alpha.DB.keys.tickets);
    const now = Alpha.DB.nowISO();
    const humanId = Alpha.DB.nextTicketHumanId();

    const requesterId = payload.requesterId || actor.id;
    const requesterName = payload.requesterName || actor.name;

    const t = {
      id: Alpha.DB.uid('t'),
      humanId,
      type: payload.type || 'Incident',
      category: payload.category || 'Other',
      subcategory: payload.subcategory || 'General',
      impact: Number(payload.impact || 2),
      urgency: Number(payload.urgency || 2),
      priority: priorityFromImpactUrgency(payload.impact || 2, payload.urgency || 2),
      subject: (payload.subject || '').trim(),
      description: (payload.description || '').trim(),
      requesterId, requesterName,
      status: 'New',
      assignedToId: null,
      assignedToName: null,
      tags: (payload.tags || []).filter(Boolean),
      createdAt: now,
      updatedAt: now,
      firstResponseDueAt: null,
      resolutionDueAt: null,
      firstResponseAt: null,
      resolvedAt: null,
      closedAt: null,
      comments: [],
      internalNotes: [],
      timeline: [
        { id: Alpha.DB.uid('a'), at: now, byId: actor.id, byName: actor.name, action: 'Created ticket' }
      ],
      attachments: []
    };
    computeSLA(t);

    tickets.unshift(t);
    saveTickets(tickets);
    Alpha.DB.audit({ id: Alpha.DB.uid('audit'), at: now, actor:`${actor.name} (${actor.role})`, action:`Created ticket ${t.humanId}` });
    return t;
  }

  function updateTicket(ticketId, patch, actor){
    const tickets = Alpha.DB.getAll(Alpha.DB.keys.tickets);
    const idx = tickets.findIndex(t=>t.id===ticketId);
    if(idx<0) throw new Error('Ticket not found.');

    const t = tickets[idx];
    const now = Alpha.DB.nowISO();

    const allowed = Alpha.Auth.roleAtLeast(actor.role,'Agent') ||
      (actor.role==='Requester' && t.requesterId===actor.id);

    if(!allowed) throw new Error('Not permitted.');

    // Basic patching
    const beforeStatus = t.status;

    const mutable = ['subject','description','type','category','subcategory','impact','urgency','tags'];
    for(const k of mutable){
      if(patch[k] !== undefined){
        t[k] = (k==='impact'||k==='urgency') ? Number(patch[k]) : patch[k];
      }
    }
    if(patch.impact !== undefined || patch.urgency !== undefined){
      t.priority = priorityFromImpactUrgency(t.impact, t.urgency);
      // recompute SLA only if not already met? For simplicity, recompute due dates from createdAt (classic SLA policy)
      t.firstResponseDueAt = null;
      t.resolutionDueAt = null;
      computeSLA(t);
    }

    if(patch.status && STATUS.includes(patch.status)){
      t.status = patch.status;
      if(patch.status==='Resolved' && !t.resolvedAt) t.resolvedAt = now;
      if(patch.status==='Closed' && !t.closedAt) t.closedAt = now;
      if(patch.status==='Reopened'){
        t.resolvedAt = null;
        t.closedAt = null;
      }
    }

    if(patch.assignedToId !== undefined){
      const users = Alpha.DB.getAll(Alpha.DB.keys.users);
      const u = users.find(x=>x.id===patch.assignedToId) || null;
      t.assignedToId = u ? u.id : null;
      t.assignedToName = u ? u.name : null;
      if(u && (t.status==='New')) t.status = 'Assigned';
    }

    t.updatedAt = now;
    t.timeline = t.timeline || [];
    const actions = [];
    if(beforeStatus !== t.status) actions.push(`Status: ${beforeStatus} → ${t.status}`);
    if(patch.assignedToId !== undefined) actions.push(`Assigned to ${t.assignedToName || '—'}`);
    if(patch.subject !== undefined) actions.push('Updated subject');
    if(patch.description !== undefined) actions.push('Updated description');
    if(patch.impact !== undefined || patch.urgency !== undefined) actions.push('Updated priority matrix');
    if(patch.tags !== undefined) actions.push('Updated tags');

    if(actions.length){
      t.timeline.unshift({ id: Alpha.DB.uid('a'), at: now, byId: actor.id, byName: actor.name, action: actions.join(' · ') });
    }

    tickets[idx] = t;
    saveTickets(tickets);
    Alpha.DB.audit({ id: Alpha.DB.uid('audit'), at: now, actor:`${actor.name} (${actor.role})`, action:`Updated ticket ${t.humanId}` });
    return t;
  }

  function addComment(ticketId, { body, kind }, actor){
    const tickets = Alpha.DB.getAll(Alpha.DB.keys.tickets);
    const idx = tickets.findIndex(t=>t.id===ticketId);
    if(idx<0) throw new Error('Ticket not found.');
    const t = tickets[idx];
    const now = Alpha.DB.nowISO();

    const isOwner = t.requesterId===actor.id;
    const can = Alpha.Auth.roleAtLeast(actor.role,'Agent') || isOwner;
    if(!can) throw new Error('Not permitted.');

    if(!body || !String(body).trim()) throw new Error('Comment body is required.');

    const entry = { id: Alpha.DB.uid(kind==='internal'?'n':'c'), at: now, byId: actor.id, byName: actor.name, body: String(body).trim() };
    if(kind==='internal'){
      t.internalNotes = t.internalNotes || [];
      t.internalNotes.unshift(entry);
    }else{
      t.comments = t.comments || [];
      t.comments.unshift({ ...entry, kind:'public' });
      if(!t.firstResponseAt && Alpha.Auth.roleAtLeast(actor.role,'Agent')){
        t.firstResponseAt = now;
      }
    }

    t.updatedAt = now;
    t.timeline = t.timeline || [];
    t.timeline.unshift({ id: Alpha.DB.uid('a'), at: now, byId: actor.id, byName: actor.name, action: kind==='internal' ? 'Added internal note' : 'Added public reply' });

    tickets[idx]=t;
    saveTickets(tickets);
    Alpha.DB.audit({ id: Alpha.DB.uid('audit'), at: now, actor:`${actor.name} (${actor.role})`, action:`Commented on ${t.humanId}` });
    return t;
  }

  function addWorklog(ticketId, { minutes, note }, actor){
    if(!Alpha.Auth.roleAtLeast(actor.role,'Agent')) throw new Error('Agent+ required.');
    const mins = Number(minutes||0);
    if(!mins || mins<=0) throw new Error('Minutes must be > 0.');
    const logs = Alpha.DB.getAll(Alpha.DB.keys.worklogs);
    const now = Alpha.DB.nowISO();
    const entry = { id: Alpha.DB.uid('wl'), ticketId, minutes: mins, note: String(note||'').trim(), byId: actor.id, byName: actor.name, at: now };
    logs.unshift(entry);
    Alpha.DB.setAll(Alpha.DB.keys.worklogs, logs);
    Alpha.DB.audit({ id: Alpha.DB.uid('audit'), at: now, actor:`${actor.name} (${actor.role})`, action:`Logged ${mins}m on ${ticketId}` });
    return entry;
  }

  async function addAttachment(ticketId, file, actor){
    if(!Alpha.Auth.roleAtLeast(actor.role,'Requester')) throw new Error('Not permitted.');
    const tickets = Alpha.DB.getAll(Alpha.DB.keys.tickets);
    const idx = tickets.findIndex(t=>t.id===ticketId);
    if(idx<0) throw new Error('Ticket not found.');
    const t = tickets[idx];

    const buf = await file.arrayBuffer();
    const id = Alpha.DB.uid('att');
    const rec = { id, ticketId, name:file.name, type:file.type || 'application/octet-stream', size:file.size, data: buf, at: Alpha.DB.nowISO(), byId: actor.id, byName: actor.name };
    await Alpha.DB.idbPut('attachments', rec);

    t.attachments = t.attachments || [];
    t.attachments.unshift({ id, name:file.name, type: rec.type, size:file.size, at: rec.at, byName: actor.name });

    t.updatedAt = Alpha.DB.nowISO();
    t.timeline = t.timeline || [];
    t.timeline.unshift({ id: Alpha.DB.uid('a'), at: t.updatedAt, byId: actor.id, byName: actor.name, action:`Added attachment: ${file.name}` });

    tickets[idx]=t;
    saveTickets(tickets);
    Alpha.DB.audit({ id: Alpha.DB.uid('audit'), at: t.updatedAt, actor:`${actor.name} (${actor.role})`, action:`Attachment added to ${t.humanId}` });
    return t;
  }

  async function downloadAttachment(attId){
    const rec = await Alpha.DB.idbGet('attachments', attId);
    if(!rec) throw new Error('Attachment not found.');
    const blob = new Blob([rec.data], { type: rec.type || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = rec.name || 'attachment';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  }

  async function deleteAttachment(ticketId, attId, actor){
    if(!Alpha.Auth.roleAtLeast(actor.role,'Agent')) throw new Error('Agent+ required to delete attachments.');
    const tickets = Alpha.DB.getAll(Alpha.DB.keys.tickets);
    const idx = tickets.findIndex(t=>t.id===ticketId);
    if(idx<0) throw new Error('Ticket not found.');
    const t = tickets[idx];

    await Alpha.DB.idbDelete('attachments', attId);
    t.attachments = (t.attachments || []).filter(a=>a.id!==attId);
    t.updatedAt = Alpha.DB.nowISO();
    t.timeline.unshift({ id: Alpha.DB.uid('a'), at: t.updatedAt, byId: actor.id, byName: actor.name, action:`Deleted attachment` });

    tickets[idx]=t;
    saveTickets(tickets);
    Alpha.DB.audit({ id: Alpha.DB.uid('audit'), at: t.updatedAt, actor:`${actor.name} (${actor.role})`, action:`Attachment deleted in ${t.humanId}` });
    return t;
  }

  Alpha.Tickets = {
    STATUS,
    TYPES,
    CATS,
    priorityFromImpactUrgency,
    slaTargetsMinutes,
    computeSLA,
    breachInfo,
    listTickets,
    listTicketsForUser,
    getTicket,
    createTicket,
    updateTicket,
    addComment,
    addWorklog,
    addAttachment,
    downloadAttachment,
    deleteAttachment
  };
})();