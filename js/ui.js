(function(){
  const Alpha = window.Alpha = window.Alpha || {};

  function esc(s){
    return (s==null?'':String(s))
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#039;");
  }

  function fmtDate(iso){
    if(!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString(undefined, { year:'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  }
  function fmtShort(iso){
    if(!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'2-digit' });
  }

  function relativeFromNow(iso){
    if(!iso) return '';
    const t = new Date(iso).getTime();
    const n = Date.now();
    const diff = t - n;
    const abs = Math.abs(diff);
    const mins = Math.round(abs / 60000);
    const hrs = Math.round(abs / 3600000);
    const days = Math.round(abs / 86400000);
    const suffix = diff >= 0 ? 'from now' : 'ago';
    if(mins < 60) return `${mins} min ${suffix}`;
    if(hrs < 48) return `${hrs} hr ${suffix}`;
    return `${days} d ${suffix}`;
  }

  function toast(title, message, kind){
    const host = document.getElementById('toastHost');
    if(!host) return;
    const t = document.createElement('div');
    t.className = 'toast';
    const dot = kind==='success'?'success':kind==='danger'?'danger':kind==='warn'?'warn':'primary';
    t.innerHTML = `
      <div class="flex">
        <span class="chip"><span class="dot ${dot}"></span>${esc(title)}</span>
      </div>
      <div class="m">${esc(message)}</div>
    `;
    host.appendChild(t);
    setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateY(6px)'; }, 3200);
    setTimeout(()=>{ t.remove(); }, 3700);
  }

  function modal({ title, bodyHtml, footerHtml, onClose }){
    const ov = document.createElement('div');
    ov.className = 'modalOverlay';
    ov.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="modalHeader">
          <h3>${esc(title)}</h3>
          <button class="btn secondary small" type="button" data-close="1">Close</button>
        </div>
        <div class="modalBody">${bodyHtml || ''}</div>
        <div class="modalFooter">${footerHtml || ''}</div>
      </div>
    `;
    ov.addEventListener('click', (e)=>{
      const btn = e.target.closest('[data-close]');
      if(btn || e.target === ov){
        ov.remove();
        if(onClose) onClose();
      }
    });
    document.body.appendChild(ov);
    return ov;
  }

  function download(filename, text, mime){
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  }

  function csvEscape(v){
    const s = (v==null?'':String(v));
    if(/[",\n]/.test(s)) return `"${s.replaceAll('"','""')}"`;
    return s;
  }
  function toCSV(rows){
    if(!rows || rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const lines = [headers.map(csvEscape).join(',')];
    for(const r of rows){
      lines.push(headers.map(h=>csvEscape(r[h])).join(','));
    }
    return lines.join('\n');
  }

  function applyBranding(){
    const s = Alpha.DB.getSettings();
    document.documentElement.style.setProperty('--primary', s.primary || '#3b82f6');
    const logo = document.getElementById('brandLogo');
    const name = document.getElementById('brandName');
    const meta = document.getElementById('brandMeta');
    if(name) name.textContent = s.appName || 'Alpha berthaphil';
    if(meta) meta.textContent = s.tagLine || 'IT Ticketing System';
    if(logo){
      logo.src = s.logoDataUrl || './assets/logo.svg';
    }
    document.title = `${s.appName || 'Alpha berthaphil'} — IT Ticketing`;
  }

  function applyBrandingToLogin(){
    const s = Alpha.DB.getSettings();
    document.documentElement.style.setProperty('--primary', s.primary || '#3b82f6');
    const appName = document.getElementById('appName');
    const foot = document.getElementById('footBrand');
    if(appName) appName.textContent = s.appName || 'Alpha berthaphil';
    if(foot) foot.textContent = s.appName || 'Alpha berthaphil';
    if(s.tagLine){
      const tag = document.getElementById('appTag');
      if(tag) tag.textContent = s.tagLine;
    }
    document.title = `${s.appName || 'Alpha berthaphil'} — Login`;
  }

  function statusChip(status){
    const map = {
      'New':'primary',
      'Assigned':'primary',
      'In Progress':'warn',
      'Pending Customer':'warn',
      'Pending Vendor':'warn',
      'Resolved':'success',
      'Closed':'success',
      'Reopened':'danger',
      'Cancelled':'danger'
    };
    const dot = map[status] || 'primary';
    return `<span class="chip"><span class="dot ${dot}"></span>${esc(status)}</span>`;
  }

  function priorityChip(p){
    const dot = p==='P1'?'danger':p==='P2'?'warn':p==='P3'?'primary':'success';
    return `<span class="chip"><span class="dot ${dot}"></span>${esc(p)}</span>`;
  }

  Alpha.UI = {
    esc,
    fmtDate,
    fmtShort,
    relativeFromNow,
    toast,
    modal,
    download,
    toCSV,
    applyBranding,
    applyBrandingToLogin,
    statusChip,
    priorityChip
  };
})();