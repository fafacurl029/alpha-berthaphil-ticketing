(function(){
  const Alpha = window.Alpha = window.Alpha || {};
  const PREFIX = 'ab:';
  const KEYS = {
    settings: 'settings',
    users: 'users',
    tickets: 'tickets',
    kb: 'kb',
    worklogs: 'worklogs',
    audit: 'audit',
    session: 'session'
  };

  function nowISO(){ return new Date().toISOString(); }
  function safeParse(s, fallback){ try { return JSON.parse(s); } catch { return fallback; } }
  function lsKey(k){ return PREFIX + k; }
  function lsGet(k, fallback){
    const raw = localStorage.getItem(lsKey(k));
    if(raw === null || raw === undefined) return fallback;
    return safeParse(raw, fallback);
  }
  function lsSet(k, v){ localStorage.setItem(lsKey(k), JSON.stringify(v)); }
  function lsDel(k){ localStorage.removeItem(lsKey(k)); }

  function uid(prefix){
    const t = Date.now().toString(36);
    const r = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${t}_${r}`;
  }

  // IndexedDB (attachments)
  const IDB_NAME = 'alpha-berthaphil';
  const IDB_VER = 1;

  function idbOpen(){
    return new Promise((resolve, reject)=>{
      const req = indexedDB.open(IDB_NAME, IDB_VER);
      req.onupgradeneeded = (e)=>{
        const db = req.result;
        if(!db.objectStoreNames.contains('attachments')){
          const st = db.createObjectStore('attachments', { keyPath: 'id' });
          st.createIndex('ticketId', 'ticketId', { unique:false });
        }
      };
      req.onerror = ()=>reject(req.error);
      req.onsuccess = ()=>resolve(req.result);
    });
  }

  async function idbPut(store, value){
    const db = await idbOpen();
    return new Promise((resolve, reject)=>{
      const tx = db.transaction([store], 'readwrite');
      tx.onerror = ()=>reject(tx.error);
      const st = tx.objectStore(store);
      const req = st.put(value);
      req.onsuccess = ()=>resolve(true);
    });
  }
  async function idbGet(store, id){
    const db = await idbOpen();
    return new Promise((resolve, reject)=>{
      const tx = db.transaction([store], 'readonly');
      tx.onerror = ()=>reject(tx.error);
      const st = tx.objectStore(store);
      const req = st.get(id);
      req.onsuccess = ()=>resolve(req.result || null);
    });
  }
  async function idbDelete(store, id){
    const db = await idbOpen();
    return new Promise((resolve, reject)=>{
      const tx = db.transaction([store], 'readwrite');
      tx.onerror = ()=>reject(tx.error);
      const st = tx.objectStore(store);
      const req = st.delete(id);
      req.onsuccess = ()=>resolve(true);
    });
  }
  async function idbListByIndex(store, index, value){
    const db = await idbOpen();
    return new Promise((resolve, reject)=>{
      const tx = db.transaction([store], 'readonly');
      tx.onerror = ()=>reject(tx.error);
      const st = tx.objectStore(store);
      const idx = st.index(index);
      const req = idx.getAll(value);
      req.onsuccess = ()=>resolve(req.result || []);
    });
  }

  function getAll(k){ return lsGet(k, []); }
  function setAll(k, arr){ lsSet(k, arr); return arr; }
  function pushAudit(entry){
    const audit = lsGet(KEYS.audit, []);
    audit.unshift(entry);
    lsSet(KEYS.audit, audit.slice(0, 2000));
  }

  function getSettings(){
    return lsGet(KEYS.settings, {
      appName: 'Alpha berthaphil',
      tagLine: 'IT Ticketing System',
      primary: '#3b82f6',
      logoDataUrl: null,
      counters: { ticket: 1040 } // used for human-friendly IDs
    });
  }
  function setSettings(s){ lsSet(KEYS.settings, s); return s; }

  function nextTicketHumanId(){
    const s = getSettings();
    const c = s.counters || { ticket: 1000 };
    c.ticket = (c.ticket || 1000) + 1;
    s.counters = c;
    setSettings(s);
    return `AB-${c.ticket}`;
  }

  function resetAll(){
    Object.values(KEYS).forEach(k=>lsDel(k));
    // keep IDB, but we can wipe attachments by bumping db version; not necessary for demo.
  }

  // Seed demo data (idempotent)
  function ensureSeed(force){
    const users = lsGet(KEYS.users, null);
    const settings = lsGet(KEYS.settings, null);

    if(force || !settings){
      setSettings(getSettings());
    }
    if(force || !Array.isArray(users) || users.length === 0){
      // Auth hashes are created by Auth.ensureUserHashes() on first load (webcrypto).
      const seedUsers = [
        { id: uid('u'), username:'admin', email:'admin@alpha.local', name:'Admin User', role:'Admin', active:true, auth:{passwordPlain:'admin123'} },
        { id: uid('u'), username:'supervisor', email:'supervisor@alpha.local', name:'Supervisor User', role:'Supervisor', active:true, auth:{passwordPlain:'super123'} },
        { id: uid('u'), username:'agent', email:'agent@alpha.local', name:'Agent User', role:'Agent', active:true, auth:{passwordPlain:'agent123'} },
        { id: uid('u'), username:'requester', email:'requester@alpha.local', name:'Requester User', role:'Requester', active:true, auth:{passwordPlain:'req123'} },
      ];
      setAll(KEYS.users, seedUsers);

      const demoTickets = [
        {
          id: uid('t'), humanId: 'AB-1001',
          type:'Incident', category:'Hardware', subcategory:'Laptop', impact:2, urgency:2, priority:'P3',
          subject:'Laptop overheating and shutting down',
          description:'User reports frequent shutdowns after 10–15 minutes of use.\nRequested: check fan, thermal paste, and BIOS updates.',
          requesterId: seedUsers[3].id, requesterName: seedUsers[3].name,
          status:'Assigned', assignedToId: seedUsers[2].id, assignedToName: seedUsers[2].name,
          createdAt: nowISO(), updatedAt: nowISO(),
          firstResponseDueAt: addMinutes(nowISO(), 30),
          resolutionDueAt: addHours(nowISO(), 8),
          tags:['laptop','urgent-ish'],
          comments:[
            { id: uid('c'), at: nowISO(), byId: seedUsers[2].id, byName: seedUsers[2].name, kind:'public', body:'Acknowledged. I will schedule pickup and run diagnostics.' }
          ],
          internalNotes:[
            { id: uid('n'), at: nowISO(), byId: seedUsers[1].id, byName: seedUsers[1].name, body:'Please check if this unit is still under warranty.' }
          ],
          timeline:[
            { id: uid('a'), at: nowISO(), byId: seedUsers[3].id, byName: seedUsers[3].name, action:'Created ticket' },
            { id: uid('a'), at: nowISO(), byId: seedUsers[1].id, byName: seedUsers[1].name, action:'Assigned to Agent User' }
          ],
          attachments:[]
        }
      ];
      setAll(KEYS.tickets, demoTickets);

      setAll(KEYS.kb, [
        {
          id: uid('kb'),
          title:'How to reset a user password (local build)',
          category:'Process',
          tags:['password','account'],
          published:true,
          body:'1) Admin → Users\n2) Edit user → set temporary password\n3) Ask user to login and change it in Settings.',
          createdAt: nowISO(),
          updatedAt: nowISO(),
          author:'Admin User'
        },
        {
          id: uid('kb'),
          title:'VPN troubleshooting checklist',
          category:'Network',
          tags:['vpn','network'],
          published:true,
          body:'- Verify internet connectivity\n- Check DNS resolution\n- Validate VPN client version\n- Confirm user group permissions\n- Try alternate gateway',
          createdAt: nowISO(),
          updatedAt: nowISO(),
          author:'Supervisor User'
        }
      ]);

      setAll(KEYS.worklogs, []);
      setAll(KEYS.audit, [
        { id: uid('audit'), at: nowISO(), actor:'System', action:'Seeded demo data' }
      ]);
    }

    // Ensure settings counters are consistent
    const s = getSettings();
    if(!s.counters) s.counters = { ticket: 1040 };
    setSettings(s);
  }

  function addMinutes(iso, mins){
    const d = new Date(iso); d.setMinutes(d.getMinutes()+mins); return d.toISOString();
  }
  function addHours(iso, hrs){
    const d = new Date(iso); d.setHours(d.getHours()+hrs); return d.toISOString();
  }

  Alpha.DB = {
    keys: KEYS,
    nowISO,
    uid,
    getAll, setAll,
    lsGet, lsSet,
    resetAll,
    ensureSeed,
    getSettings, setSettings,
    nextTicketHumanId,
    audit: pushAudit,
    idbPut, idbGet, idbDelete, idbListByIndex
  };
})();