/* ================================================================
   settings.js  —  Copy code, budget edit, CSV export, switch trip
   ✏️  Change CSV column order here if needed.
================================================================ */
import { S, db, ref, update, $, fmtDate, fmt, toast, showLoad, hideLoad, clearSession } from './config.js';

/* COPY CODE */
window.copyCode = () => {
  navigator.clipboard?.writeText(String(S.group.loginCode))
    .then(()=>toast('Code copied! 📋')).catch(()=>toast('Code: '+S.group.loginCode));
};

/* SETTINGS */
window.openBudgetEdit = () => {
  $('b-name').value=S.group.name||''; $('b-budget').value=S.group.budget||'';
  $('m-budget').classList.add('on');
};
window.saveBudget = async () => {
  const name=$('b-name').value.trim()||S.group.name;
  const budget=parseFloat($('b-budget').value)||0;
  await update(ref(db,`smartsplit/groups/${S.gid}`),{ name, budget });
  S.group.name=name; S.group.budget=budget;
  closeM('m-budget'); renderUI(); toast('Saved ✓');
};

window.switchTrip = () => {
  if(!confirm('Switch to a different trip? You can re-enter the code anytime.')) return;
  clearSession();
  closeM('m-budget');
  $('app').style.display='none';
  go('s-start');
  // Reset state
  S.gid=''; S.group={}; S.expenses={}; S.members={}; S.settlements={};
  S.activeTab='t-exp';
  $('l-code').value='';
};

/* EXPORT CSV */
window.exportCSV = () => {
  const rows=[['Date','Name','Category','Amount','Paid By','Notes','Split Between']];
  Object.values(S.expenses).sort((a,b)=>(a.date||'').localeCompare(b.date||'')).forEach(e=>{
    rows.push([fmtDate(e.date)||'',e.name||'',e.category||'',e.amount||0,e.paidBy||'',e.notes||'',(e.splitBetween||[]).join('|')]);
  });
  const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download=`${(S.group.name||'Trip').replace(/\s/g,'_')}_expenses.csv`;
  a.click(); toast('CSV exported 📄');
};
