/* ================================================================
   config.js  —  Firebase, State, Utilities, Session, Navigation
   ✏️  ADMIN_CODE   — change the admin login code here
   ✏️  SESSION_DAYS — days before re-login is required
   ✏️  Firebase     — update firebaseConfig if project changes
================================================================ */
import { initializeApp }  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, get, push, set, update, remove }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

/* ── Firebase ── */
export const db = getDatabase(initializeApp({
  apiKey:"AIzaSyCqb7gAbpa3UabPU3g_YhNITuPWtWPY4KU",
  authDomain:"ak-events-2016.firebaseapp.com",
  databaseURL:"https://ak-events-2016-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:"ak-events-2016"
}));
export { ref, get, push, set, update, remove };

/* ── Constants  ✏️ edit here ── */
export const ADMIN_CODE   = '1AKU';   // admin login code
export const SESSION_DAYS = 5;        // days before re-login
export const SESSION_KEY  = 'ss_session';

/* ── App State (single source of truth) ── */
export const S = {
  gid:'', group:{}, expenses:{}, members:{}, settlements:{},
  splitType:'equal', sel:[], pendCode:'', activeTab:'t-exp'
};

/* ── Utilities ── */
export const fmt     = n => '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN');
export const fmtDate = d => { if(!d) return ''; const [y,m,day]=d.split('-'); return `${day}-${m}-${y}`; };
export const today   = () => new Date().toISOString().split('T')[0];
export const PAL     = ['#7c5fff','#22d07a','#ff5273','#b8f724','#2dd4d4','#f7a825','#f97316','#e879f9'];
export const col     = n => { let h=0; for(const c of(n||'?'))h+=c.charCodeAt(0); return PAL[h%PAL.length]; };
export const ns      = () => Object.values(S.members).map(m=>m.name);
export const $       = id => document.getElementById(id);
export const setT    = (id,t) => { const e=$(id); if(e) e.textContent=t; };

export function toast(msg, dur=2600){
  const t=$('toast'); t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), dur);
}
export function setErr(id,m){ const e=$(id); if(e) e.textContent=m; }
export function showLoad(msg=''){
  if($('__ld')) return;
  const d=document.createElement('div'); d.id='__ld'; d.className='ldw';
  d.innerHTML=`<div class="ld"></div>${msg?`<div class="ld-t">${msg}</div>`:''}`;
  document.body.appendChild(d);
}
export function hideLoad(){ $('__ld')?.remove(); }

/* ── Session ── */
export function saveSession(code,gid){
  localStorage.setItem(SESSION_KEY,JSON.stringify({code,gid,ts:Date.now()}));
}
export function clearSession(){ localStorage.removeItem(SESSION_KEY); }
export function loadSession(){
  try{
    const raw=localStorage.getItem(SESSION_KEY); if(!raw) return null;
    const s=JSON.parse(raw);
    if((Date.now()-s.ts)/864e5 > SESSION_DAYS){ clearSession(); return null; }
    return s;
  }catch{ clearSession(); return null; }
}

/* ── Global navigation (called from HTML onclick) ── */
window.go    = id => {
  document.querySelectorAll('.scr').forEach(s=>s.classList.add('hidden'));
  $(id)?.classList.remove('hidden');
};
window.closeM = id => $(id)?.classList.remove('on');
