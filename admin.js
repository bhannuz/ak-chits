/* ================================================================
   admin.js  —  Admin dashboard: view all trips, delete trips
   ✏️  Admin code: edit ADMIN_CODE in config.js.
   ✏️  Add new admin features (e.g. edit budget) in this file.
================================================================ */
import { db, ref, get, remove, $, setT, fmt, col, toast, showLoad, hideLoad } from './config.js';

/* ─── ADMIN ─────────────────────────────────────────────── */
let adminData = { groups:{}, members:{}, expenses:{} };

async function launchAdmin(){
  showLoad('Loading admin…');
  try {
    const [gS,mS,eS] = await Promise.all([
      get(ref(db,'smartsplit/groups')),
      get(ref(db,'smartsplit/members')),
      get(ref(db,'smartsplit/expenses'))
    ]);
    hideLoad();
    adminData.groups   = gS.exists()  ? gS.val()  : {};
    adminData.members  = mS.exists()  ? mS.val()  : {};
    adminData.expenses = eS.exists()  ? eS.val()  : {};
    go('s-admin');
    renderAdmin();
  } catch(e){ hideLoad(); setErr('l-err','Admin error: '+e.message); }
}

window.renderAdmin = () => {
  const q = ($('adm-search')?.value||'').toLowerCase();
  const groups   = adminData.groups;
  const members  = adminData.members;
  const expenses = adminData.expenses;

  // Summary stats
  const allMembers = Object.values(members);
  const allExps    = Object.values(expenses);
  const totalSpend = allExps.reduce((s,e)=>s+(e.amount||0),0);
  setT('adm-trips',   Object.keys(groups).length);
  setT('adm-members', allMembers.length);
  setT('adm-spend',   fmt(totalSpend));

  // Filter
  let groupEntries = Object.entries(groups);
  if(q){
    groupEntries = groupEntries.filter(([gid,g])=>{
      const nameMatch = (g.name||'').toLowerCase().includes(q);
      const codeMatch = String(g.loginCode).includes(q);
      const memMatch  = allMembers.filter(m=>m.groupId===gid).some(m=>(m.name||'').toLowerCase().includes(q));
      return nameMatch||codeMatch||memMatch;
    });
  }

  if(!groupEntries.length){
    $('adm-trips-list').innerHTML='<div class="empty"><div class="ei-ico">🔍</div><p>No trips found</p></div>';
    return;
  }

  $('adm-trips-list').innerHTML = groupEntries
    .sort((a,b)=>(a[1].name||'').localeCompare(b[1].name||''))
    .map(([gid,g])=>{
      const tripMembers = allMembers.filter(m=>m.groupId===gid);
      const tripExps    = allExps.filter(e=>e.groupId===gid);
      const tripSpend   = tripExps.reduce((s,e)=>s+(e.amount||0),0);
      const mc          = tripMembers.length;
      const budget      = g.budget||0;
      const pct         = budget>0?Math.min(100,Math.round((tripSpend/budget)*100)):0;
      const bcolor      = pct>85?'var(--rose)':pct>60?'var(--amber)':'var(--sky)';

      const memRows = tripMembers.length ? tripMembers.map(m=>{
        // per-member spend
        const memPaid = tripExps.filter(e=>e.paidBy===m.name).reduce((s,e)=>s+(e.amount||0),0);
        const memExps = tripExps.filter(e=>e.paidBy===m.name).length;
        const c = ['#7c5fff','#22d07a','#ff5273','#b8f724','#2dd4d4','#f7a825','#f97316','#e879f9'];
        const col = n => { let h=0; for(const ch of(n||'?'))h+=ch.charCodeAt(0); return c[h%c.length]; };
        return `<div class="adm-mem-row">
          <div style="width:30px;height:30px;border-radius:50%;background:${col(m.name)};display:flex;align-items:center;justify-content:center;font-family:'Bricolage Grotesque',sans-serif;font-size:12px;font-weight:800;color:#000;flex-shrink:0">${m.name[0].toUpperCase()}</div>
          <div style="flex:1"><div style="font-weight:700;font-size:13px">${m.name}</div><div style="font-size:10px;color:var(--sub2)">${memExps} expense${memExps!==1?'s':''}</div></div>
          <div style="font-family:'Bricolage Grotesque',sans-serif;font-size:13px;font-weight:800;color:var(--lime)">${fmt(memPaid)}</div>
        </div>`;
      }).join('') : '<div style="padding:12px 0;font-size:12px;color:var(--sub2)">No members yet</div>';

      return `<div class="trip-card">
        <div class="trip-card-head" onclick="toggleTripCard(this)">
          <div style="min-width:0;flex:1">
            <div class="trip-card-title">${g.name||'Unnamed Trip'}</div>
            <div class="trip-card-meta">${mc} member${mc!==1?'s':''} · ${tripExps.length} expense${tripExps.length!==1?'s':''}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
            <div class="trip-code-tag" onclick="event.stopPropagation();copyAdminCode('${g.loginCode}')" title="Click to copy">${g.loginCode}</div>
            <button class="btn bg bxs" style="color:var(--rose);padding:5px 9px;font-size:12px" onclick="event.stopPropagation();deleteTrip('${gid}','${(g.name||'').replace(/'/g,"&#39;")}')" title="Delete trip">🗑️</button>
            <span class="adm-chevron">▾</span>
          </div>
        </div>
        <div class="trip-card-body hidden">
          <!-- Stats row -->
          <div class="adm-stat-row">
            <div class="adm-stat">
              <div class="adm-stat-l">Total Spend</div>
              <div class="adm-stat-v" style="color:var(--lime)">${fmt(tripSpend)}</div>
            </div>
            ${budget>0?`<div class="adm-stat">
              <div class="adm-stat-l">Budget</div>
              <div class="adm-stat-v" style="color:${bcolor}">${pct}% of ${fmt(budget)}</div>
            </div>`:''}
            <div class="adm-stat">
              <div class="adm-stat-l">Per Person</div>
              <div class="adm-stat-v" style="color:#c0b0ff">${mc?fmt(tripSpend/mc):'—'}</div>
            </div>
          </div>
          <!-- Members -->
          <div style="font-size:10px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:1.2px;margin:10px 0 4px">Members</div>
          ${memRows}
        </div>
      </div>`;
    }).join('');
};

window.toggleTripCard = el => {
  const body    = el.nextElementSibling;
  const chevron = el.querySelector('.adm-chevron');
  body.classList.toggle('hidden');
  chevron.classList.toggle('open');
};

window.copyAdminCode = code => {
  navigator.clipboard?.writeText(String(code)).then(()=>toast('Code '+code+' copied! 📋'));
};

window.deleteTrip = async (gid, name) => {
  if(!confirm(`Delete trip "${name}"?\n\nThis will permanently delete the trip, all its expenses, members, and settlements. This cannot be undone.`)) return;
  showLoad('Deleting trip…');
  try {
    // Delete group
    await remove(ref(db, `smartsplit/groups/${gid}`));
    // Delete all expenses for this group
    const eSnap = await get(ref(db, 'smartsplit/expenses'));
    if(eSnap.exists()){
      const toDelete = Object.entries(eSnap.val()).filter(([,e])=>e.groupId===gid);
      await Promise.all(toDelete.map(([id])=>remove(ref(db,`smartsplit/expenses/${id}`))));
    }
    // Delete all members for this group
    const mSnap = await get(ref(db, 'smartsplit/members'));
    if(mSnap.exists()){
      const toDelete = Object.entries(mSnap.val()).filter(([,m])=>m.groupId===gid);
      await Promise.all(toDelete.map(([id])=>remove(ref(db,`smartsplit/members/${id}`))));
    }
    // Delete settlements
    await remove(ref(db, `smartsplit/settlements/${gid}`));
    // Reload admin data
    const [gS,mS,eS] = await Promise.all([
      get(ref(db,'smartsplit/groups')),
      get(ref(db,'smartsplit/members')),
      get(ref(db,'smartsplit/expenses'))
    ]);
    adminData.groups   = gS.exists() ? gS.val() : {};
    adminData.members  = mS.exists() ? mS.val() : {};
    adminData.expenses = eS.exists() ? eS.val() : {};
    hideLoad();
    renderAdmin();
    toast(`"${name}" deleted ✓`);
  } catch(e){ hideLoad(); toast('Error: '+e.message); }
};

$('btn-reg').onclick = async () => {
  const code=$('r-code').value.trim(); setErr('r-err','');
  if(code.length!==4||isNaN(code)){ setErr('r-err','Must be 4 digits'); return; }
  showLoad();
  try {
    const snap=await get(ref(db,'smartsplit/groups')); hideLoad();
    const taken=snap.exists()&&Object.values(snap.val()).some(g=>String(g.loginCode)===code);
    if(taken){ setErr('r-err','Code taken — try another'); return; }
    S.pendCode=code; go('s-setup');
  } catch(e){ hideLoad(); setErr('r-err','Error: '+e.message); }
};

$('btn-setup').onclick = async () => {
  const name=$('sn').value.trim(), budget=parseFloat($('sb').value)||0;
  setErr('se-err',''); if(!name){ setErr('se-err','Enter a trip name'); return; }
  showLoad();
  try {
    const gr=push(ref(db,'smartsplit/groups'));
    S.gid=gr.key; S.group={ name, loginCode:S.pendCode, budget };
    await set(gr, S.group);
    S.expenses={}; S.members={}; S.settlements={};
    saveSession(S.pendCode, S.gid);   // ← persist session
    hideLoad(); launch();
    toast('Trip created! Share code '+S.pendCode+' 🎉',3500);
    openMem();
  } catch(e){ hideLoad(); setErr('se-err','Error: '+e.message); }
};

async function loadAll(){
  showLoad('Syncing…');
  try {
    const [eS,mS,sS,gS]=await Promise.all([
      get(ref(db,'smartsplit/expenses')),
      get(ref(db,'smartsplit/members')),
      get(ref(db,`smartsplit/settlements/${S.gid}`)),
      get(ref(db,`smartsplit/groups/${S.gid}`))
    ]);
    const ae=eS.exists()?eS.val():{};
    S.expenses=Object.fromEntries(Object.entries(ae).filter(([,e])=>e.groupId===S.gid));
    const am=mS.exists()?mS.val():{};
    S.members=Object.fromEntries(Object.entries(am).filter(([,m])=>m.groupId===S.gid));
    S.settlements=sS.exists()?sS.val():{};
    if(gS.exists()) S.group=gS.val();
  } finally { hideLoad(); }
}

function launch(){
  document.querySelectorAll('.scr').forEach(s=>s.classList.add('hidden'));
  $('app').style.display='flex'; renderUI();
}
