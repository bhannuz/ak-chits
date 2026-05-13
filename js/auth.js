/* ================================================================
   auth.js  —  Session restore, login, register, trip setup
   ✏️  ADMIN_CODE & SESSION_DAYS are in config.js.
================================================================ */
import { S, db, ref, get, push, set, $, setErr, toast, showLoad, hideLoad,
         ADMIN_CODE, saveSession, clearSession, loadSession } from './config.js';
import { loadAll, launch } from './firebase.js';
import { launchAdmin }     from './admin.js';

/* ── SESSION CACHE ─────────────────────────────────────────
   Saves trip code + gid to localStorage with a timestamp.
   On next open, if session is < SESSION_DAYS old, skip the
   login screen entirely and go straight into the app.
   To log out / switch trip: clear localStorage manually or
   use the ⚙️ settings modal "Switch Trip" button.
─────────────────────────────────────────────────────────── */
const SESSION_DAYS = 5;           // ← change to 2 for every-2-days
const SESSION_KEY  = 'ss_session';

function saveSession(code, gid){
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    code, gid, ts: Date.now()
  }));
}
function clearSession(){
  localStorage.removeItem(SESSION_KEY);
}
function loadSession(){
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if(!raw) return null;
    const s = JSON.parse(raw);
    const age = (Date.now() - s.ts) / (1000 * 60 * 60 * 24); // days
    if(age > SESSION_DAYS){ clearSession(); return null; }
    return s;
  } catch { clearSession(); return null; }
}

/* Auto-restore session on page load, or go straight to code entry for new users */
(async () => {
  const sess = loadSession();
  if(!sess) {
    go('s-login');   // first-time: show code entry immediately
    return;
  }
  // Has session — show nothing (blank) while we verify, then launch
  showLoad('Welcome back…');
  try {
    const snap = await get(ref(db,'smartsplit/groups'));
    hideLoad();
    if(!snap.exists()){ clearSession(); go('s-login'); return; }
    const entry = Object.entries(snap.val()).find(([,g])=>String(g.loginCode)===String(sess.code));
    if(!entry){ clearSession(); go('s-login'); return; }
    S.gid = entry[0]; S.group = entry[1];
    await loadAll();
    launch();
  } catch { hideLoad(); clearSession(); go('s-login'); }
})();

/* AUTH */
$('btn-login').onclick = doLogin;
$('l-code').onkeydown  = e => { if(e.key==='Enter') doLogin(); };

const ADMIN_CODE = '1AKU';   // ← alphanumeric admin code (case-insensitive)

async function doLogin(){
  const code=$('l-code').value.trim().toUpperCase(); setErr('l-err','');
  if(code.length<4){ setErr('l-err','Enter your trip code'); return; }

  // Admin access (case-insensitive)
  if(code === ADMIN_CODE.toUpperCase()){ await launchAdmin(); return; }

  showLoad('Loading trip…');
  try {
    const snap=await get(ref(db,'smartsplit/groups')); hideLoad();
    if(!snap.exists()){ setErr('l-err','No trips found.'); return; }
    const entry=Object.entries(snap.val()).find(([,g])=>String(g.loginCode)===String(code));
    if(!entry){ setErr('l-err','Invalid code. Try again.'); return; }
    S.gid=entry[0]; S.group=entry[1];
    saveSession(code, S.gid);
    await loadAll(); launch();
  } catch(e){ hideLoad(); setErr('l-err','Error: '+e.message); }
}
