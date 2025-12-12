(function(){
  const Alpha = window.Alpha = window.Alpha || {};

  const ROLE_ORDER = ['Requester','Agent','Supervisor','Admin'];

  function roleAtLeast(role, minRole){
    return ROLE_ORDER.indexOf(role) >= ROLE_ORDER.indexOf(minRole);
  }

  function normalizeIdentifier(id){
    return String(id || '').trim().toLowerCase();
  }

  function bufToB64(buf){
    const b = new Uint8Array(buf);
    let s = '';
    for(let i=0;i<b.length;i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  }
  function b64ToBuf(b64){
    const bin = atob(b64);
    const b = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) b[i] = bin.charCodeAt(i);
    return b.buffer;
  }

  async function deriveKey(password, saltBuf, iterations){
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      'raw', enc.encode(password),
      { name:'PBKDF2' }, false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name:'PBKDF2', hash:'SHA-256', salt: saltBuf, iterations },
      baseKey,
      256
    );
    return bufToB64(bits);
  }

  async function ensureUserHashes(){
    const users = Alpha.DB.getAll(Alpha.DB.keys.users);
    let changed = false;

    for(const u of users){
      u.auth = u.auth || {};
      // If legacy plaintext is present, convert to PBKDF2
      if(u.auth && u.auth.passwordPlain){
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iterations = 120000;
        const hash = await deriveKey(u.auth.passwordPlain, salt.buffer, iterations);
        u.auth = { salt: bufToB64(salt.buffer), iterations, hash };
        changed = true;
      }
      // If no auth, assign a random one (inactive user)
      if(!u.auth || !u.auth.hash){
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iterations = 120000;
        const hash = await deriveKey('changeme', salt.buffer, iterations);
        u.auth = { salt: bufToB64(salt.buffer), iterations, hash };
        changed = true;
      }
    }
    if(changed){
      Alpha.DB.setAll(Alpha.DB.keys.users, users);
      Alpha.DB.audit({ id: Alpha.DB.uid('audit'), at: Alpha.DB.nowISO(), actor:'System', action:'Upgraded user password storage' });
    }
  }

  function findUser(identifier){
    const id = normalizeIdentifier(identifier);
    const users = Alpha.DB.getAll(Alpha.DB.keys.users);
    return users.find(u => normalizeIdentifier(u.username) === id || normalizeIdentifier(u.email) === id) || null;
  }

  function currentUser(){
    const sess = Alpha.DB.lsGet(Alpha.DB.keys.session, null);
    if(!sess || !sess.userId) return null;
    const users = Alpha.DB.getAll(Alpha.DB.keys.users);
    return users.find(u=>u.id===sess.userId) || null;
  }

  function setSession(user){
    Alpha.DB.lsSet(Alpha.DB.keys.session, { userId:user.id, at: Alpha.DB.nowISO() });
  }
  function clearSession(){
    Alpha.DB.lsSet(Alpha.DB.keys.session, null);
  }

  async function login(identifier, password){
    await ensureUserHashes();
    const user = findUser(identifier);
    if(!user) throw new Error('Invalid credentials.');
    if(!user.active) throw new Error('Account is disabled.');
    const salt = b64ToBuf(user.auth.salt);
    const iterations = user.auth.iterations || 120000;
    const computed = await deriveKey(password, salt, iterations);
    if(computed !== user.auth.hash) throw new Error('Invalid credentials.');

    setSession(user);
    Alpha.DB.audit({ id: Alpha.DB.uid('audit'), at: Alpha.DB.nowISO(), actor:`${user.name} (${user.role})`, action:'Logged in' });
    return user;
  }

  async function changePassword(userId, oldPassword, newPassword){
    await ensureUserHashes();
    const users = Alpha.DB.getAll(Alpha.DB.keys.users);
    const u = users.find(x=>x.id===userId);
    if(!u) throw new Error('User not found.');
    if(!u.active) throw new Error('Account is disabled.');
    const computed = await deriveKey(oldPassword, b64ToBuf(u.auth.salt), u.auth.iterations || 120000);
    if(computed !== u.auth.hash) throw new Error('Old password is incorrect.');

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iterations = 120000;
    const hash = await deriveKey(newPassword, salt.buffer, iterations);
    u.auth = { salt: bufToB64(salt.buffer), iterations, hash };
    Alpha.DB.setAll(Alpha.DB.keys.users, users);

    const actor = currentUser();
    Alpha.DB.audit({ id: Alpha.DB.uid('audit'), at: Alpha.DB.nowISO(), actor: actor?`${actor.name} (${actor.role})`:'System', action:`Changed password for ${u.name}` });
    return true;
  }

  async function adminSetPassword(userId, newPassword, actor){
    if(!actor || !roleAtLeast(actor.role,'Admin')) throw new Error('Admin access required.');
    await ensureUserHashes();
    const users = Alpha.DB.getAll(Alpha.DB.keys.users);
    const u = users.find(x=>x.id===userId);
    if(!u) throw new Error('User not found.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iterations = 120000;
    const hash = await deriveKey(newPassword, salt.buffer, iterations);
    u.auth = { salt: bufToB64(salt.buffer), iterations, hash };
    Alpha.DB.setAll(Alpha.DB.keys.users, users);
    Alpha.DB.audit({ id: Alpha.DB.uid('audit'), at: Alpha.DB.nowISO(), actor:`${actor.name} (${actor.role})`, action:`Reset password for ${u.name}` });
    return true;
  }

  Alpha.Auth = {
    ROLE_ORDER,
    roleAtLeast,
    currentUser,
    login,
    logout: ()=>{ const u=currentUser(); clearSession(); if(u) Alpha.DB.audit({ id: Alpha.DB.uid('audit'), at: Alpha.DB.nowISO(), actor:`${u.name} (${u.role})`, action:'Logged out' }); },
    changePassword,
    adminSetPassword,
    ensureUserHashes
  };
})();