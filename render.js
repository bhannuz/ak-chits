/* ================================================================
   render.js  —  All UI rendering functions
   ✏️  renderUI        — master render, call after any data change
   ✏️  renderExpList   — day-grouped collapsible expense list
   ✏️  renderCatList   — category bars (Expenses tab sidebar)
   ✏️  renderMemSide   — member balance sidebar (Expenses tab)
   ✏️  renderPeopleTab — members list + who-paid ranking
   ✏️  renderSettleTab — settle cards + balance sheet
================================================================ */
import { S, db, ref, set, $, setT, ns, col, fmt, fmtDate, today, toast } from './config.js';
import { loadAll } from './firebase.js';

/* ══════════════ MAIN RENDER ══════════════ */
window.renderUI = () => {
  const exps=Object.values(S.expenses);
  const total=exps.reduce((s,e)=>s+(e.amount||0),0);
  const mc=Math.max(ns().length,1);
  const todayStr=today();
  const todayAmt=exps.filter(e=>e.date===todayStr).reduce((s,e)=>s+(e.amount||0),0);
  const txns=calcSettle();
  const pend=txns.filter(t=>!S.settlements[`${t.from}_${t.to}`.replace(/\s/g,'_')]?.settled).length;

  setT('pg-title',S.group.name||'Trip');
  setT('pg-meta',`${mc} member${mc!==1?'s':''} · ${exps.length} expense${exps.length!==1?'s':''}`);

  // Today card
  const todayCount = exps.filter(e=>e.date===todayStr).length;
  setT('sv-today', fmt(todayAmt));
  setT('sv-txns',  todayCount + ' expense' + (todayCount!==1?'s':'') + ' today');

  // Total card + budget progress
  setT('sv-total', fmt(total));
  const budget=S.group.budget||0;
  if(budget>0){
    const pct=Math.min(100,Math.round((total/budget)*100));
    const left=budget-total;
    const bcolor=pct>85?'var(--rose)':pct>60?'var(--amber)':'var(--sky)';
    setT('sv-bleft', left>=0 ? fmt(left)+' left of '+fmt(budget) : 'Over by '+fmt(-left));
    const f=$('sv-bfill'); f.style.width=pct+'%'; f.style.background=bcolor;
    $('sv-total').style.color=bcolor;
  } else {
    setT('sv-bleft','no budget set');
    $('sv-total').style.color='var(--sky)';
    $('sv-bfill').style.width='0%';
  }

  // Per-person inline row
  setT('sv-per', fmt(total/mc));

  // Repopulate member filter but preserve current selection
  const _fpaid=$('fpaid'), _prev=_fpaid.value;
  _fpaid.innerHTML='<option value="">All Members</option>'+ns().map(n=>`<option>${n}</option>`).join('');
  if(_prev) _fpaid.value=_prev;   // restore selection after repopulate
  setT('mem-ct-s',mc+' people');

  // Render ALL content before any visibility toggling
  renderExpList(exps, total);
  renderCatList(exps, total);
  renderMemSide(exps);
  renderPeopleTab(exps, total);
  renderSettleTab();
  // Ensure only active tab is visible
  ['t-exp','t-people'].forEach(t => $(t).classList.add('hidden'));
  $(S.activeTab).classList.remove('hidden');
};

function renderExpList(exps,total){
  const filter = $('fcat').value, paidF = $('fpaid').value;
  const search = ($('esearch').value||'').toLowerCase();
  const el     = $('exp-list');
  const todayStr = today();

  // Apply filters
  let list = [...exps];
  if(filter) list = list.filter(e=>e.category===filter);
  if(paidF)  list = list.filter(e=>e.paidBy===paidF);
  if(search) list = list.filter(e=>[(e.name||''),(e.notes||''),(e.paidBy||'')].some(f=>f.toLowerCase().includes(search)));

  if(!list.length){
    el.innerHTML='<div class="empty"><div class="ei-ico">💸</div><p>No expenses found</p></div>';
    return;
  }

  // Sort by date descending, then by firebase key (insertion order) descending within same day
  list.sort((a,b) => {
    const dc = (b.date||'').localeCompare(a.date||'');
    return dc !== 0 ? dc : 0; // same date keeps original order
  });

  // Group by date
  const groups = {};
  list.forEach(e => {
    const d = e.date || 'Unknown';
    if(!groups[d]) groups[d] = [];
    groups[d].push(e);
  });

  // Build day label helper
  const dayLabel = d => {
    if(d === 'Unknown') return 'Unknown Date';
    if(d === todayStr) return '📅 Today';
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
    if(d === yesterday.toISOString().split('T')[0]) return '⏪ Yesterday';
    return fmtDate(d);
  };

  el.innerHTML = Object.entries(groups).map(([date, items]) => {
    const dayTotal = items.reduce((s,e)=>s+(e.amount||0),0);
    const isToday  = date === todayStr;
    const label    = dayLabel(date);
    const count    = items.length;

    const rows = items.map(e => {
      const id  = Object.keys(S.expenses).find(k=>S.expenses[k]===e)||'';
      const perP= e.splitBetween?.length ? fmt(e.amount/e.splitBetween.length)+'/person' : '';
      return `<div class="ei" style="padding-left:14px;padding-right:14px">
        <div class="eico">${e.category?.split(' ')[0]||'📦'}</div>
        <div style="flex:1;min-width:0">
          <div class="en" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.name}</div>
          <div class="em">
            ${e.category?.split(' ')[1]||''}
            · <strong style="color:var(--txt)">${e.paidBy||'?'}</strong>
            ${perP?`· <span style="color:#b8a8ff">${perP}</span>`:''}
          </div>
          ${e.notes?`<div class="em" style="font-style:italic;opacity:.7">${e.notes}</div>`:''}
        </div>
        <div style="flex-shrink:0;text-align:right;min-width:60px">
          <div class="ea">${fmt(e.amount)}</div>
          <div class="ebtns">
            <button class="btn bg bxs" onclick="editExp('${id}')">✏️</button>
            <button class="btn bg bxs" style="color:var(--rose)" onclick="delExp('${id}')">🗑️</button>
          </div>
        </div>
      </div>`;
    }).join('');

    return `<div class="day-group">
      <div class="day-header" onclick="toggleDayGroup(this)">
        <div class="day-header-left">
          <span class="day-label">${label}</span>
          <span class="day-badge">${count} item${count!==1?'s':''}</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <span class="day-total">${fmt(dayTotal)}</span>
          <span class="day-chevron ${isToday?'open':''}">▾</span>
        </div>
      </div>
      <div class="day-body ${isToday?'':'collapsed'}">${rows}</div>
    </div>`;
  }).join('');
}

window.toggleDayGroup = el => {
  const body    = el.nextElementSibling;
  const chevron = el.querySelector('.day-chevron');
  body.classList.toggle('collapsed');
  chevron.classList.toggle('open');
};

function renderCatList(exps,total){
  const cats={}; exps.forEach(e=>cats[e.category]=(cats[e.category]||0)+(e.amount||0));
  $('cat-list').innerHTML=Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([c,v])=>`
    <div class="catrow">
      <div class="cattop"><span>${c}</span><b>${fmt(v)} <span style="color:var(--sub);font-size:10px">${total?Math.round(v/total*100):0}%</span></b></div>
      <div class="catbar"><div class="catfill" style="width:${total?Math.min(100,(v/total)*100):0}%"></div></div>
    </div>`).join('')||'<div class="empty" style="padding:16px"><p>No data yet</p></div>';
}

function renderMemSide(exps){
  const names=ns(); const paid={},owes={};
  names.forEach(n=>{ paid[n]=0; owes[n]=0; });
  exps.forEach(e=>{
    if(e.paidBy) paid[e.paidBy]=(paid[e.paidBy]||0)+(e.amount||0);
    if(e.splits) Object.values(e.splits).forEach(s=>owes[s.name]=(owes[s.name]||0)+(s.share||0));
    else if(e.splitBetween?.length){ const sh=(e.amount||0)/e.splitBetween.length; e.splitBetween.forEach(n=>owes[n]=(owes[n]||0)+sh); }
  });
  $('mem-side').innerHTML=names.map(n=>{
    const net=(paid[n]||0)-(owes[n]||0);
    return `<div class="mr">
      <div class="mav" style="background:${col(n)};width:32px;height:32px;font-size:12px">${n[0].toUpperCase()}</div>
      <div style="flex:1"><div class="mname">${n}</div><div class="msub">paid ${fmt(paid[n]||0)}</div></div>
      <div class="${net>=0?'pos':'neg'}" style="font-size:13px">${net>=0?'+':'-'}${fmt(net)}</div>
    </div>`;
  }).join('')||'<div class="empty" style="padding:16px"><p>No members</p></div>';
}

function renderPeopleTab(exps,total){
  const names=ns(); const paid={},owes={},cnt={};
  names.forEach(n=>{ paid[n]=0; owes[n]=0; cnt[n]=0; });
  exps.forEach(e=>{
    if(e.paidBy){ paid[e.paidBy]=(paid[e.paidBy]||0)+(e.amount||0); cnt[e.paidBy]=(cnt[e.paidBy]||0)+1; }
    if(e.splits) Object.values(e.splits).forEach(s=>owes[s.name]=(owes[s.name]||0)+(s.share||0));
    else if(e.splitBetween?.length){ const sh=(e.amount||0)/e.splitBetween.length; e.splitBetween.forEach(n=>owes[n]=(owes[n]||0)+sh); }
  });

  // Member list with net balance
  setT('mem-full-ct', names.length+' people');
  $('mem-full-list').innerHTML = Object.entries(S.members).map(([id,m])=>{
    const net=(paid[m.name]||0)-(owes[m.name]||0);
    return `<div class="mr">
      <div class="mav" style="background:${col(m.name)};width:34px;height:34px;font-size:13px">${m.name[0].toUpperCase()}</div>
      <div style="flex:1">
        <div class="mname">${m.name}</div>
        <div class="msub">Paid ${fmt(paid[m.name]||0)} · ${cnt[m.name]||0} expense${cnt[m.name]!==1?'s':''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <span class="badge ${net>=0?'bg-g':'bg-r'}">${net>=0?'+':'-'}${fmt(net)}</span>
        <button class="btn bg bxs" style="color:var(--rose)" onclick="removeMem('${id}')">✕</button>
      </div>
    </div>`;
  }).join('')||'<div class="empty"><p>No members yet. Add members above.</p></div>';

  // Who paid most ranking
  const el=$('mem-rank');
  if(el) el.innerHTML = [...names].sort((a,b)=>(paid[b]||0)-(paid[a]||0)).map((n,i)=>{
    const pct=total?Math.round((paid[n]||0)/total*100):0;
    return `<div style="margin-bottom:11px">
      <div class="cattop">
        <span style="display:flex;align-items:center;gap:7px">
          <span>${['🥇','🥈','🥉'][i]||'•'}</span>
          <span class="mav" style="background:${col(n)};width:22px;height:22px;font-size:10px">${n[0].toUpperCase()}</span>
          <span>${n}</span>
        </span>
        <b style="color:var(--lime)">${fmt(paid[n]||0)} <span style="color:var(--sub);font-size:10px">${pct}%</span></b>
      </div>
      <div class="catbar" style="margin-top:4px"><div class="catfill" style="width:${pct}%"></div></div>
    </div>`;
  }).join('')||'<div class="empty" style="padding:16px"><p>No expenses yet</p></div>';
}

function renderSettleTab(){
  const txns = calcSettle();
  const done_count = txns.filter(t => S.settlements[`${t.from}_${t.to}`.replace(/\s/g,'_')]?.settled).length;
  const pend = txns.length - done_count;

  // Summary header
  setT('settle-sum', pend > 0
    ? `${pend} payment${pend!==1?'s':''} pending`
    : txns.length ? '🎉 All settled!' : 'No settlements needed'
  );

  const el = $('settle-list');
  if(!txns.length){
    el.innerHTML = `<div class="empty"><div class="ei-ico">🎉</div>
      <p style="font-weight:700;font-size:14px;color:var(--txt);margin-bottom:4px">All Settled Up!</p>
      <p style="font-size:12px">No payments needed between members.</p></div>`;
  } else {
    // Separate pending vs done
    const pending = txns.filter(t => !S.settlements[`${t.from}_${t.to}`.replace(/\s/g,'_')]?.settled);
    const settled = txns.filter(t =>  S.settlements[`${t.from}_${t.to}`.replace(/\s/g,'_')]?.settled);

    const card = (t, done) => {
      const key = `${t.from}_${t.to}`.replace(/\s/g,'_');
      return `<div class="stlc ${done?'done':''}" style="${done?'':'border-color:rgba(124,95,255,.25);'}">
        <div class="stlarr">
          <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
            <div class="mav" style="background:${col(t.from)};width:32px;height:32px;font-size:13px">${t.from[0].toUpperCase()}</div>
            <div style="font-size:10px;font-weight:700;color:var(--txt);max-width:56px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center">${t.from}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;padding:0 6px">
            <div style="font-size:10px;color:var(--sub)">pays</div>
            <div style="display:flex;align-items:center;gap:0;width:100%">
              <div style="flex:1;height:2px;background:linear-gradient(90deg,var(--violet),var(--lime));border-radius:2px;"></div>
              <span style="font-size:9px;color:var(--lime)">▶</span>
            </div>
            <div class="stlamt" style="font-size:16px">${fmt(t.amount)}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
            <div class="mav" style="background:${col(t.to)};width:32px;height:32px;font-size:13px">${t.to[0].toUpperCase()}</div>
            <div style="font-size:10px;font-weight:700;color:var(--txt);max-width:56px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center">${t.to}</div>
          </div>
        </div>
        <button class="btn bsm ${done?'bg':'bl'}" style="flex-shrink:0;min-width:56px" onclick="markSettled('${key}')">
          ${done ? '↩ Undo' : '✓ Done'}
        </button>
      </div>`;
    };

    el.innerHTML =
      (pending.length ? pending.map(t=>card(t,false)).join('') : '') +
      (settled.length ? `
        <div style="font-size:10px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:1.2px;margin:14px 0 8px;padding-top:10px;border-top:1px solid var(--rim)">
          ✓ Settled (${settled.length})
        </div>
        ${settled.map(t=>card(t,true)).join('')}` : '');
  }

  // Balance sheet
  const bal = calcBal();
  const bsEl = $('balance-sheet');
  if(bsEl) bsEl.innerHTML = Object.entries(bal)
    .sort((a,b) => b[1]-a[1])
    .map(([n,v]) => `
      <div class="row">
        <span class="rl" style="display:flex;align-items:center;gap:8px">
          <span class="mav" style="background:${col(n)};width:26px;height:26px;font-size:10px">${n[0].toUpperCase()}</span>
          <span style="font-weight:600">${n}</span>
        </span>
        <span class="${v>=0?'pos':'neg'}" style="font-size:14px;font-family:'Bricolage Grotesque',sans-serif">
          ${v>=0?'+':'-'}${fmt(v)}
        </span>
      </div>`
    ).join('') || '<div class="empty" style="padding:16px"><p>No data</p></div>';
}
