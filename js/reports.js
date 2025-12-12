(function(){
  const Alpha = window.Alpha = window.Alpha || {};

  function inRange(iso, start, end){
    if(!iso) return false;
    const t = new Date(iso).getTime();
    const s = start ? new Date(start).getTime() : -Infinity;
    const e = end ? new Date(end).getTime() : Infinity;
    return t>=s && t<=e;
  }

  function ticketsInRange(start, end, user){
    return Alpha.Tickets.listTicketsForUser(user).filter(t=>inRange(t.createdAt, start, end));
  }

  function sumWorklogs(ticketIds, start, end){
    const logs = Alpha.DB.getAll(Alpha.DB.keys.worklogs).filter(wl=>{
      return ticketIds.includes(wl.ticketId) && inRange(wl.at, start, end);
    });
    const totalMin = logs.reduce((a,b)=>a+(Number(b.minutes)||0),0);
    return { logs, totalMin };
  }

  function avgResolutionMinutes(tickets){
    const done = tickets.filter(t=>t.resolvedAt || t.closedAt);
    if(done.length===0) return 0;
    const ms = done.reduce((acc,t)=>{
      const end = new Date(t.closedAt||t.resolvedAt).getTime();
      const start = new Date(t.createdAt).getTime();
      return acc + Math.max(0, end-start);
    },0);
    return Math.round((ms/done.length)/60000);
  }

  function breachCounts(tickets){
    let fr=0, res=0;
    for(const t of tickets){
      const b = Alpha.Tickets.breachInfo(t);
      if(b.frBreached) fr++;
      if(b.resBreached) res++;
    }
    return { firstResponseBreaches: fr, resolutionBreaches: res };
  }

  function byStatus(tickets){
    const map = {};
    for(const t of tickets){
      map[t.status] = (map[t.status]||0)+1;
    }
    return map;
  }

  function byPriority(tickets){
    const map = {};
    for(const t of tickets){
      map[t.priority] = (map[t.priority]||0)+1;
    }
    return map;
  }

  function ticketRowsForCSV(tickets){
    return tickets.map(t=>({
      humanId: t.humanId,
      status: t.status,
      priority: t.priority,
      type: t.type,
      category: t.category,
      subcategory: t.subcategory,
      subject: t.subject,
      requester: t.requesterName,
      assignedTo: t.assignedToName || '',
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      firstResponseDueAt: t.firstResponseDueAt || '',
      firstResponseAt: t.firstResponseAt || '',
      resolutionDueAt: t.resolutionDueAt || '',
      resolvedAt: t.resolvedAt || '',
      closedAt: t.closedAt || '',
      tags: (t.tags||[]).join('|')
    }));
  }

  function worklogRowsForCSV(logs){
    return logs.map(w=>({
      ticketId: w.ticketId,
      minutes: w.minutes,
      by: w.byName,
      at: w.at,
      note: w.note || ''
    }));
  }

  Alpha.Reports = {
    ticketsInRange,
    sumWorklogs,
    avgResolutionMinutes,
    breachCounts,
    byStatus,
    byPriority,
    ticketRowsForCSV,
    worklogRowsForCSV
  };
})();