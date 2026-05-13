/* ================================================================
   firebase.js  —  Data load & app launch
   ✏️  Edit query paths here if Firebase structure changes.
================================================================ */
import { S, db, ref, get, showLoad, hideLoad } from './config.js';

export async function loadAll(){
  showLoad('Syncing…');
  try{
    const [eS,mS,sS,gS] = await Promise.all([
      get(ref(db,'smartsplit/expenses')),
      get(ref(db,'smartsplit/members')),
      get(ref(db,`smartsplit/settlements/${S.gid}`)),
      get(ref(db,`smartsplit/groups/${S.gid}`))
    ]);
    const ae=eS.exists()?eS.val():{};
    S.expenses    = Object.fromEntries(Object.entries(ae).filter(([,e])=>e.groupId===S.gid));
    const am=mS.exists()?mS.val():{};
    S.members     = Object.fromEntries(Object.entries(am).filter(([,m])=>m.groupId===S.gid));
    S.settlements = sS.exists()?sS.val():{};
    if(gS.exists()) Object.assign(S.group,gS.val());
  }finally{ hideLoad(); }
}

export function launch(){
  document.querySelectorAll('.scr').forEach(s=>s.classList.add('hidden'));
  document.getElementById('app').style.display='flex';
  window.renderUI();
}
