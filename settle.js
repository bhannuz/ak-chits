/* ================================================================
   settle.js  —  Settlement calculations: markSettled, calcBal, calcSettle
   ✏️  Settlement algorithm (greedy min-transactions) is in calcSettle().
================================================================ */
import { S, db, ref, set, $, ns, col, fmt, toast } from './config.js';
import { loadAll } from './firebase.js';

/* SETTLE */
window.markSettled = async key => {
  const done=S.settlements[key]?.settled;
  await set(ref(db,`smartsplit/settlements/${S.gid}/${key}`),{ settled:!done });
  await loadAll(); renderUI();
};
function calcBal(){
  const exps=Object.values(S.expenses), bal={};
  ns().forEach(n=>bal[n]=0);
  exps.forEach(e=>{
    if(e.paidBy) bal[e.paidBy]=(bal[e.paidBy]||0)+(e.amount||0);
    if(e.splits) Object.values(e.splits).forEach(s=>bal[s.name]=(bal[s.name]||0)-(s.share||0));
    else if(e.splitBetween?.length){ const sh=(e.amount||0)/e.splitBetween.length; e.splitBetween.forEach(n=>bal[n]=(bal[n]||0)-sh); }
  });
  return bal;
}
function calcSettle(){
  const bal=calcBal();
  const cred=[],debt=[];
  Object.entries(bal).forEach(([n,v])=>{ if(v>0.5)cred.push({name:n,amt:v}); else if(v<-0.5)debt.push({name:n,amt:-v}); });
  cred.sort((a,b)=>b.amt-a.amt); debt.sort((a,b)=>b.amt-a.amt);
  const txns=[]; let ci=0,di=0;
  while(ci<cred.length&&di<debt.length){
    const c=cred[ci],d=debt[di],pay=Math.min(c.amt,d.amt);
    txns.push({from:d.name,to:c.name,amount:pay});
    c.amt-=pay; d.amt-=pay; if(c.amt<0.5)ci++; if(d.amt<0.5)di++;
  }
  return txns;
}
