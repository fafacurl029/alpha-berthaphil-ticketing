(function(){
  const Alpha = window.Alpha = window.Alpha || {};

  function requireRole(actor, minRole){
    if(!actor || !Alpha.Auth.roleAtLeast(actor.role, minRole)) throw new Error(`${minRole}+ required.`);
  }

  function listUsers(actor){
    requireRole(actor,'Supervisor');
    return Alpha.DB.getAll(Alpha.DB.keys.users);
  }

  function upsertUser(user, actor){
    requireRole(actor,'Admin');
    const users = Alpha.DB.getAll(Alpha.DB.keys.users);
    const now = Alpha.DB.nowISO();

    if(!user.username || !String(user.username).trim()) throw new Error('Username is required.');
    const uname = String(user.username).trim().toLowerCase();
    const email = String(user.email||'').trim().toLowerCase();

    const dup = users.find(u => u.id !== user.id && (u.username||'').toLowerCase()===uname);
    if(dup) throw new Error('Username already exists.');

    if(!user.id){
      const u = {
        id: Alpha.DB.uid('u'),
        username: uname,
        email: email || `${uname}@alpha.local`,
        name: String(user.name||uname),
        role: user.role || 'Requester',
        active: user.active !== false,
        auth: { passwordPlain: user.tempPassword || 'changeme' },
        createdAt: now
      };
      users.unshift(u);
      Alpha.DB.setAll(Alpha.DB.keys.users, users);
      Alpha.DB.audit({ id: Alpha.DB.uid('audit'), at: now, actor:`${actor.name} (${actor.role})`, action:`Created user ${u.username} (${u.role})` });
      return u;
    } else {
      const idx = users.findIndex(u=>u.id===user.id);
      if(idx<0) throw new Error('User not found.');
      const cur = users[idx];

      cur.username = uname;
      cur.email = email || cur.email;
      cur.name = String(user.name||cur.name);
      cur.role = user.role || cur.role;
      cur.active = user.active !== false;

      users[idx]=cur;
      Alpha.DB.setAll(Alpha.DB.keys.users, users);
      Alpha.DB.audit({ id: Alpha.DB.uid('audit'), at: now, actor:`${actor.name} (${actor.role})`, action:`Updated user ${cur.username}` });
      return cur;
    }
  }

  function deactivateUser(userId, active, actor){
    requireRole(actor,'Admin');
    const users = Alpha.DB.getAll(Alpha.DB.keys.users);
    const u = users.find(x=>x.id===userId);
    if(!u) throw new Error('User not found.');
    u.active = !!active;
    Alpha.DB.setAll(Alpha.DB.keys.users, users);
    Alpha.DB.audit({ id: Alpha.DB.uid('audit'), at: Alpha.DB.nowISO(), actor:`${actor.name} (${actor.role})`, action:`Set ${u.username} active=${u.active}` });
    return u;
  }

  function setBranding({ appName, tagLine, primary, logoDataUrl }, actor){
    requireRole(actor,'Admin');
    const s = Alpha.DB.getSettings();
    if(appName !== undefined) s.appName = String(appName||'').trim() || s.appName;
    if(tagLine !== undefined) s.tagLine = String(tagLine||'').trim() || s.tagLine;
    if(primary !== undefined) s.primary = String(primary||s.primary);
    if(logoDataUrl !== undefined) s.logoDataUrl = logoDataUrl || null;
    Alpha.DB.setSettings(s);
    Alpha.DB.audit({ id: Alpha.DB.uid('audit'), at: Alpha.DB.nowISO(), actor:`${actor.name} (${actor.role})`, action:`Updated branding` });
    return s;
  }

  function backupAll(actor){
    requireRole(actor,'Supervisor');
    const data = {
      version: 1,
      exportedAt: Alpha.DB.nowISO(),
      settings: Alpha.DB.getSettings(),
      users: Alpha.DB.getAll(Alpha.DB.keys.users),
      tickets: Alpha.DB.getAll(Alpha.DB.keys.tickets),
      kb: Alpha.DB.getAll(Alpha.DB.keys.kb),
      worklogs: Alpha.DB.getAll(Alpha.DB.keys.worklogs),
      audit: Alpha.DB.getAll(Alpha.DB.keys.audit)
    };
    Alpha.DB.audit({ id: Alpha.DB.uid('audit'), at: Alpha.DB.nowISO(), actor:`${actor.name} (${actor.role})`, action:'Exported backup JSON' });
    return data;
  }

  function restoreAll(data, actor){
    requireRole(actor,'Admin');
    if(!data || typeof data !== 'object') throw new Error('Invalid backup file.');
    Alpha.DB.setSettings(data.settings || Alpha.DB.getSettings());
    Alpha.DB.setAll(Alpha.DB.keys.users, data.users || []);
    Alpha.DB.setAll(Alpha.DB.keys.tickets, data.tickets || []);
    Alpha.DB.setAll(Alpha.DB.keys.kb, data.kb || []);
    Alpha.DB.setAll(Alpha.DB.keys.worklogs, data.worklogs || []);
    Alpha.DB.setAll(Alpha.DB.keys.audit, data.audit || []);
    Alpha.DB.audit({ id: Alpha.DB.uid('audit'), at: Alpha.DB.nowISO(), actor:`${actor.name} (${actor.role})`, action:'Restored from backup JSON' });
    return true;
  }

  Alpha.Admin = { listUsers, upsertUser, deactivateUser, setBranding, backupAll, restoreAll };
})();