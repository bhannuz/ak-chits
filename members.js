/* ================================================================
   members.js  —  Add / remove members, member modal
   ✏️  Avatar colour palette: PAL array in config.js.
================================================================ */
import { S, db, ref, push, set, remove, $, col, ns, toast, showLoad, hideLoad } from './config.js';
import { loadAll } from './firebase.js';

/* MEMBERS */
window.openMem = () => { renderMemModal(); $('m-mem').classList.add('on'); };
window.addMem  = () => doAddMem($('new-mem'));
window.addMem2 = () => doAddMem($('new-mem2'));
async function doAddMem(inp){
  const name=inp.value.trim(); if(!name){ toast('Enter a name'); return; }
  if(ns().some(n=>n.toLowerCase()===name.toLowerCase())){ toast('Already in group'); return; }
  await set(push(ref(db,'smartsplit/members')),{ name, groupId:S.gid });
  await loadAll(); inp.value=''; renderMemModal(); renderUI(); toast(name+' added 👋');
}
window.removeMem = async id => {
  if(!confirm('Remove member?')) return;
  await remove(ref(db,`smartsplit/members/${id}`));
  await loadAll(); renderMemModal(); renderUI(); toast('Removed');
};
function renderMemModal(){
  $('m-mem-list').innerHTML=Object.entries(S.members).map(([id,m])=>`
    <div class="mr">
      <div class="mav" style="background:${col(m.name)};width:32px;height:32px;font-size:12px">${m.name[0].toUpperCase()}</div>
      <div style="flex:1"><div class="mname">${m.name}</div></div>
      <button class="btn bg bxs" style="color:var(--rose)" onclick="removeMem('${id}')">✕</button>
    </div>`).join('')||'<div class="empty"><p>No members yet</p></div>';
}
