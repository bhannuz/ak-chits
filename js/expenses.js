/* ================================================================
   expenses.js  —  Add / edit / delete expenses + split logic
   ✏️  Split types: 'equal' | 'custom' | 'percent'
   ✏️  Category list: edit <select id="e-cat"> in views/app.html
================================================================ */
import { S, db, ref, push, set, update, remove, $, ns, col, today,
         fmt, toast, showLoad, hideLoad } from './config.js';
import { loadAll } from './firebase.js';

/* EXPENSE FORM */
function resetForm(){
  $('eid').value=''; $('e-name').value=''; $('e-amt').value='';
  $('e-cat').value='🍔 Food'; $('e-date').value=today(); $('e-notes').value='';
  $('m-exp-title').textContent='💸 Add Expense'; $('btn-save').textContent='Save';
  fillPaidBy(''); S.splitType='equal'; S.sel=[...ns()];
  renderSplitList(); setSplit('equal');
}
function fillPaidBy(sel){
  $('e-paid').innerHTML=ns().map(n=>`<option ${n===sel?'selected':''}>${n}</option>`).join('');
  if(!ns().length) $('e-paid').innerHTML='<option>— add members first —</option>';
}
window.selAll = () => { S.sel=[...ns()]; renderSplitList(); };
window.onAmtChg = () => { if(S.splitType!=='equal') renderCustomArea(); };
function renderSplitList(){
  $('split-list').innerHTML=ns().map(n=>`
    <div class="mck ${S.sel.includes(n)?'on':''}" onclick="togMem('${n}',this)">
      <div class="mck-cb"></div>
      <div class="mck-av" style="background:${col(n)}">${n[0].toUpperCase()}</div>
      <span style="font-size:13px;font-weight:600">${n}</span>
    </div>`).join('')||'<div style="padding:12px;color:var(--sub2);font-size:13px">Add members first</div>';
}
window.togMem = (name,el) => {
  if(S.sel.includes(name)){
    if(S.sel.length<=1){ toast('Need at least 1'); return; }
    S.sel=S.sel.filter(n=>n!==name); el.classList.remove('on');
  } else { S.sel.push(name); el.classList.add('on'); }
  if(S.splitType!=='equal') renderCustomArea();
};
window.setSplit = type => {
  S.splitType=type;
  ['eq','cu','pc'].forEach((k,i)=>{ const t=['equal','custom','percent'][i]; $('sp-'+k).classList.toggle('on',t===type); });
  const ca=$('custom-area');
  type==='equal'?ca.classList.add('hidden'):(ca.classList.remove('hidden'),renderCustomArea());
};
function renderCustomArea(){
  const amt=parseFloat($('e-amt').value)||0;
  if(S.splitType==='custom'){
    const sh=S.sel.length?Math.round(amt/S.sel.length):0;
    $('custom-area').innerHTML=S.sel.map(n=>`
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
        <div style="flex:1;font-size:13px;font-weight:600">${n}</div>
        <input type="number" id="cs-${n.replace(/\s/g,'_')}" class="fi" value="${sh}" inputmode="numeric" style="margin:0;width:95px;padding:7px 10px;font-size:13px">
      </div>`).join('')+'<p style="font-size:10px;color:var(--sub);margin-top:3px">Must total the amount</p>';
  } else {
    const pct=S.sel.length?Math.round(100/S.sel.length):0;
    $('custom-area').innerHTML=S.sel.map((n,i)=>`
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
        <div style="flex:1;font-size:13px;font-weight:600">${n}</div>
        <input type="number" id="cs-${n.replace(/\s/g,'_')}" class="fi" value="${i===S.sel.length-1?100-(pct*(S.sel.length-1)):pct}" inputmode="numeric" max="100" style="margin:0;width:70px;padding:7px 10px;font-size:13px">
        <span style="font-size:12px;color:var(--sub2)">%</span>
      </div>`).join('')+'<p style="font-size:10px;color:var(--sub);margin-top:3px">Must total 100%</p>';
  }
}

/* SAVE EXPENSE */
$('btn-save').onclick = async () => {
  const editId=$('eid').value;
  const name=$('e-name').value.trim(), amt=parseFloat($('e-amt').value);
  const cat=$('e-cat').value, paidBy=$('e-paid').value;
  const date=$('e-date').value||today(), notes=$('e-notes').value.trim();
  if(!name)        return toast('Add a description');
  if(!amt||amt<=0) return toast('Enter a valid amount');
  if(!paidBy)      return toast('Select who paid');
  if(!S.sel.length)return toast('Select at least one member');

  let splits={};
  if(S.splitType==='equal'){
    const sh=amt/S.sel.length;
    S.sel.forEach(n=>splits[n.replace(/\s/g,'_')]={ name:n, share:+sh.toFixed(2) });
  } else if(S.splitType==='custom'){
    let tot=0;
    for(const n of S.sel){ const v=parseFloat($('cs-'+n.replace(/\s/g,'_'))?.value)||0; splits[n.replace(/\s/g,'_')]={ name:n, share:v }; tot+=v; }
    if(Math.abs(tot-amt)>1) return toast(`Total ₹${Math.round(tot)} ≠ ₹${amt}`);
  } else {
    let tot=0;
    for(const n of S.sel){ const p=parseFloat($('cs-'+n.replace(/\s/g,'_'))?.value)||0; splits[n.replace(/\s/g,'_')]={ name:n, share:+(amt*p/100).toFixed(2) }; tot+=p; }
    if(Math.abs(tot-100)>0.5) return toast(`Percentages = ${Math.round(tot)}%, need 100%`);
  }

  const data={ name, amount:amt, category:cat, paidBy, date, notes, splits, splitType:S.splitType, splitBetween:S.sel, groupId:S.gid };
  showLoad();
  try {
    editId ? await update(ref(db,`smartsplit/expenses/${editId}`),data) : await set(push(ref(db,'smartsplit/expenses')),data);
    toast(editId?'Updated ✓':'Added ✓'); closeM('m-exp'); await loadAll(); renderUI();
  } catch(e){ toast('Error: '+e.message); }
  finally { hideLoad(); }
};

window.openAdd = () => { resetForm(); $('m-exp').classList.add('on'); };

window.editExp = async id => {
  const e=S.expenses[id]; if(!e) return;
  resetForm(); $('eid').value=id; $('e-name').value=e.name; $('e-amt').value=e.amount;
  $('e-cat').value=e.category; $('e-date').value=e.date||today(); $('e-notes').value=e.notes||'';
  fillPaidBy(e.paidBy); S.sel=e.splitBetween||[...ns()]; renderSplitList();
  setSplit(e.splitType||'equal'); $('m-exp-title').textContent='✏️ Edit Expense'; $('btn-save').textContent='Update';
  $('m-exp').classList.add('on');
};
window.delExp = async id => {
  if(!confirm('Delete?')) return;
  showLoad(); await remove(ref(db,`smartsplit/expenses/${id}`));
  await loadAll(); renderUI(); hideLoad(); toast('Deleted');
};
