(function(){
  const Alpha = window.Alpha = window.Alpha || {};

  function listAll(){ return Alpha.DB.getAll(Alpha.DB.keys.kb); }
  function listPublished(){
    return listAll().filter(a=>a.published);
  }
  function get(id){
    return listAll().find(a=>a.id===id) || null;
  }

  function upsert(article, actor){
    const kb = listAll();
    const now = Alpha.DB.nowISO();
    if(!article.title || !String(article.title).trim()) throw new Error('Title is required.');

    if(!article.id){
      if(!Alpha.Auth.roleAtLeast(actor.role,'Agent')) throw new Error('Agent+ required to create KB.');
      const a = {
        id: Alpha.DB.uid('kb'),
        title: String(article.title).trim(),
        category: String(article.category||'General'),
        tags: (article.tags||[]).filter(Boolean),
        published: !!article.published,
        body: String(article.body||'').trim(),
        createdAt: now,
        updatedAt: now,
        author: actor.name
      };
      kb.unshift(a);
      Alpha.DB.setAll(Alpha.DB.keys.kb, kb);
      Alpha.DB.audit({ id: Alpha.DB.uid('audit'), at: now, actor:`${actor.name} (${actor.role})`, action:`Created KB "${a.title}"` });
      return a;
    } else {
      const idx = kb.findIndex(x=>x.id===article.id);
      if(idx<0) throw new Error('KB article not found.');
      const cur = kb[idx];
      const canEdit = Alpha.Auth.roleAtLeast(actor.role,'Supervisor') || (Alpha.Auth.roleAtLeast(actor.role,'Agent') && cur.author===actor.name);
      if(!canEdit) throw new Error('Not permitted to edit this article.');

      cur.title = String(article.title).trim();
      cur.category = String(article.category||'General');
      cur.tags = (article.tags||[]).filter(Boolean);
      cur.published = !!article.published;
      cur.body = String(article.body||'').trim();
      cur.updatedAt = now;

      kb[idx]=cur;
      Alpha.DB.setAll(Alpha.DB.keys.kb, kb);
      Alpha.DB.audit({ id: Alpha.DB.uid('audit'), at: now, actor:`${actor.name} (${actor.role})`, action:`Updated KB "${cur.title}"` });
      return cur;
    }
  }

  function remove(id, actor){
    if(!Alpha.Auth.roleAtLeast(actor.role,'Supervisor')) throw new Error('Supervisor+ required.');
    const kb = listAll();
    const idx = kb.findIndex(a=>a.id===id);
    if(idx<0) throw new Error('KB article not found.');
    const title = kb[idx].title;
    kb.splice(idx,1);
    Alpha.DB.setAll(Alpha.DB.keys.kb, kb);
    Alpha.DB.audit({ id: Alpha.DB.uid('audit'), at: Alpha.DB.nowISO(), actor:`${actor.name} (${actor.role})`, action:`Deleted KB "${title}"` });
    return true;
  }

  Alpha.KB = { listAll, listPublished, get, upsert, remove };
})();