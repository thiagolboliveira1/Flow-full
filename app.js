import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, addDoc, onSnapshot, query, where, orderBy, serverTimestamp, doc, deleteDoc, setDoc, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig); const auth = getAuth(app); const db = getFirestore(app);
const $=(s)=>document.querySelector(s); const fmt=(n)=> (n??0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

// Tabs
document.querySelectorAll('.tabs [data-tab]').forEach(b=> b.addEventListener('click', ()=>{
  document.querySelectorAll('section').forEach(s=> s.classList.add('hide'));
  document.getElementById(b.dataset.tab).classList.remove('hide');
}));

let deferredPrompt; window.addEventListener('beforeinstallprompt', e=>{e.preventDefault(); deferredPrompt=e;});
$('#btnInstall')?.addEventListener('click', async ()=>{ if(deferredPrompt){deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null;} else alert('No iOS: Compartilhar → Adicionar à Tela de Início.'); });

// Auth
$('#btnLogin')?.addEventListener('click',()=>signInWithEmailAndPassword(auth,$('#loginEmail').value,$('#loginPass').value).catch(e=>alert(e.message)));
$('#btnRegister')?.addEventListener('click',()=>createUserWithEmailAndPassword(auth,$('#regEmail').value,$('#regPass').value).catch(e=>alert(e.message)));
$('#btnAnon')?.addEventListener('click',()=>signInAnonymously(auth).catch(e=>alert(e.message)));
$('#btnLogout')?.addEventListener('click',()=>signOut(auth));

const col = (name)=> collection(db, `users/${auth.currentUser.uid}/${name}`);

function listenTransactions(){
  const tbody=$('#txTable'); const month=new Date().toISOString().slice(0,7);
  onSnapshot(query(col('transactions'), orderBy('date','desc')), snap=>{
    tbody.innerHTML=''; let inc=0,exp=0;
    snap.forEach(d=>{ const x=d.data(); const tr=document.createElement('tr');
      tr.innerHTML=`<td>${x.date||''}</td><td>${x.type==='income'?'Receita':'Despesa'}</td><td>${x.category||''}</td><td>${x.desc||''}</td><td class="${x.type==='income'?'ok':'bad'}">${fmt(x.amount)}</td><td><button class="ghost del" data-id="${d.id}">Excluir</button></td>`;
      tbody.appendChild(tr); if((x.date||'').startsWith(month)){ if(x.type==='income') inc+=x.amount; else exp+=x.amount; }
    });
    $('#kpiIncome').textContent=fmt(inc); $('#kpiExpense').textContent=fmt(exp); $('#kpiBalance').textContent=fmt(inc-exp);
    tbody.querySelectorAll('.del').forEach(b=> b.addEventListener('click', e=> deleteDoc(doc(col('transactions'), e.target.dataset.id)) ));
    renderBudgets(); renderAnnual();
  });
}
function listenBudgets(){ onSnapshot(col('budgets'), snap=>{ const data=snap.docs.map(d=>d.data()); const el=$('#budgets'); el.dataset.rows=JSON.stringify(data); renderBudgets(); }); }
async function renderBudgets(){
  const el=$('#budgets'); const budgets=JSON.parse(el.dataset.rows||'[]'); const month=new Date().toISOString().slice(0,7);
  const qsnap=await getDocs(query(col('transactions'), where('type','==','expense'))); const spent={};
  qsnap.forEach(d=>{ const x=d.data(); if((x.date||'').startsWith(month)) spent[x.category]=(spent[x.category]||0)+x.amount; });
  el.innerHTML=''; budgets.forEach(b=>{ const s=spent[b.category]||0; const rest=(b.limit||0)-s; const bar=Math.max(0,Math.min(100,Math.round((s/(b.limit||1))*100)));
    const div=document.createElement('div'); div.className='card'; div.style.marginBottom='8px';
    div.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center"><div><b>${b.category}</b><div class="muted">Limite: ${fmt(b.limit)} • Gasto: ${fmt(s)}</div></div><div class="${rest<0?'bad':'ok'}">${rest<0?'Estouro: ':'Saldo: '}${fmt(Math.abs(rest))}</div></div><div style="margin-top:8px;background:#0b1220;border:1px solid #1f2937;border-radius:8px;height:10px;overflow:hidden"><div style="height:100%;width:${bar}%;background:linear-gradient(90deg,#22c55e,#ef4444)"></div></div>`;
    el.appendChild(div);
  });
}
// Add transaction
$('#addTx')?.addEventListener('click', async ()=>{
  const amount=Number($('#amount').value); if(!amount) return alert('Informe valor');
  await addDoc(col('transactions'), {type:$('#type').value, amount, category:$('#category').value||'Outros', date: $('#date').value || new Date().toISOString().slice(0,10), desc: $('#desc').value||'', createdAt: serverTimestamp()});
  $('#amount').value=''; $('#desc').value=''; $('#msg').textContent='Adicionado ✅';
});
$('#saveBudget')?.addEventListener('click', ()=>{
  const cat=$('#bCat').value.trim(), lim=Number($('#bLimit').value); if(!cat||!lim) return alert('Informe categoria e limite');
  setDoc(doc(col('budgets'), cat), {category:cat, limit:lim}); $('#bCat').value=''; $('#bLimit').value='';
});

// Instalments
$('#addParc')?.addEventListener('click', async ()=>{
  const total=Number($('#pTotal').value), qty=Number($('#pQtd').value); if(!total||!qty) return alert('Informe total e parcelas');
  const valuePer=Math.round((total/qty)*100)/100;
  await addDoc(col('instalments'), {desc:$('#pDesc').value||'Compra', total, qty, valuePer, first: $('#pPrimeira').value||'', paid: Array(qty).fill(false), card: $('#pCartao').value||''});
  $('#pDesc').value=''; $('#pTotal').value=''; $('#pQtd').value='';
});
function listenParc(){
  onSnapshot(col('instalments'), async (snap)=>{
    const box=$('#parcs'); box.innerHTML='';
    snap.forEach(d=>{ const x=d.data(); const paid=(x.paid||[]).filter(Boolean).length; const restante = x.total - paid*(x.valuePer||0);
      const checks=Array.from({length:x.qty},(_,i)=>`<label style="margin-right:6px"><input type="checkbox" data-id="${d.id}" data-p="${i+1}" ${x.paid?.[i]?'checked':''}/> ${i+1}</label>`).join('');
      const div=document.createElement('div'); div.className='card'; div.style.marginBottom='8px';
      div.innerHTML=`<b>${x.desc}</b> • ${x.card||'-'}<div class="muted">Total: ${fmt(x.total)} • Parcela: ${fmt(x.valuePer)} • ${paid}/${x.qty}</div><div style="margin-top:8px">${checks}</div><div style="margin-top:8px" class="${restante<=0?'ok':'muted'}">${restante<=0?'Quitado ✅':'Restante: '+fmt(restante)}</div>`;
      box.appendChild(div);
    });
  });
}
document.addEventListener('change', async (e)=>{
  const t=e.target; if(!t.matches('#parcs input[type=checkbox]')) return;
  const id=t.dataset.id; const p=Number(t.dataset.p)-1;
  const docs=await getDocs(col('instalments')); let paid=[], meta;
  docs.forEach(d=>{ if(d.id===id){ paid=(d.data().paid||[]).slice(); meta=d.data(); } });
  paid[p]=t.checked; await setDoc(doc(col('instalments'), id), {...meta, paid}, {merge:true});
});

// Goals
$('#addMeta')?.addEventListener('click', async ()=>{
  const alvo=Number($('#mValor').value); if(!alvo) return alert('Informe o valor alvo');
  await addDoc(col('goals'), {title:$('#mTitulo').value||'Nova meta', target:alvo, deadline:$('#mPrazo').value||'', image:$('#mImagem').value||'', saved:0, createdAt:serverTimestamp()});
  $('#mTitulo').value=''; $('#mValor').value='';
});
function listenGoals(){
  onSnapshot(col('goals'), (snap)=>{
    const box=$('#metasBox'); box.innerHTML='';
    snap.forEach(d=>{ const x=d.data(); const p=Math.max(0,Math.min(100,Math.round(((x.saved||0)/(x.target||1))*100)));
      const div=document.createElement('div'); div.className='card'; div.style.marginBottom='8px';
      div.innerHTML=`${x.image?'<img src="'+x.image+'" style="width:120px;height:70px;object-fit:cover;border-radius:8px;border:1px solid #1f2937" />':''}
      <b style="margin-left:10px">${x.title}</b><div class="muted">Alvo: ${fmt(x.target)} • Guardado: ${fmt(x.saved||0)} • Prazo: ${x.deadline||'-'}</div>
      <div style="margin-top:8px;background:#0b1220;border:1px solid #1f2937;border-radius:8px;height:10px;overflow:hidden"><div style="height:100%;width:${p}%;background:linear-gradient(90deg,#22c55e,#3b82f6)"></div></div>
      <div class="grid" style="margin-top:8px;grid-template-columns:1fr 120px"><input type="number" step="0.01" placeholder="Valor para guardar"/><button class="ghost dep" data-id="${d.id}">Guardar</button></div>`;
      box.appendChild(div);
    });
    box.querySelectorAll('.dep').forEach(btn=> btn.addEventListener('click', async (e)=>{
      const id=e.target.dataset.id; const input=e.target.parentElement.querySelector('input'); const val=Number(input.value||0); if(!val) return;
      const docs=await getDocs(col('goals')); let saved=0;
      docs.forEach(d=>{ if(d.id===id){ saved=d.data().saved||0; } });
      await setDoc(doc(col('goals'), id), {saved: saved+val}, {merge:true}); input.value='';
    }));
  });
});

// Cards
$('#addCard')?.addEventListener('click', async ()=>{
  const lim=Number($('#cLimite').value); if(!lim) return alert('Informe o limite');
  await addDoc(col('cards'), {bank:$('#cBanco').value||'Cartão', limit:lim, due:Number($('#cVenc').value)||10, brand:$('#cBandeira').value||''});
  $('#cBanco').value=''; $('#cLimite').value='';
});
function listenCards(){ onSnapshot(col('cards'), (snap)=>{ const box=$('#cardsBox'); box.innerHTML=''; snap.forEach(d=>{ const x=d.data(); const div=document.createElement('div'); div.className='card'; div.style.marginBottom='8px'; div.innerHTML=`<b>${x.bank}</b> • ${x.brand||''}<div class="muted">Limite: ${fmt(x.limit)} • Venc: dia ${x.due}</div>`; box.appendChild(div); }); }); }

// Report
async function renderAnnual(){
  const tbody=$('#relTable'); tbody.innerHTML='';
  const snap=await getDocs(col('transactions')); const map={};
  snap.forEach(d=>{ const x=d.data(); if(!x.date) return; const k=x.date.slice(0,7); map[k]=map[k]||{inc:0,exp:0}; if(x.type==='income') map[k].inc+=x.amount; else map[k].exp+=x.amount; });
  Object.keys(map).sort().forEach(k=>{ const inc=map[k].inc, exp=map[k].exp; const tr=document.createElement('tr'); tr.innerHTML=`<td>${k}</td><td>${fmt(inc)}</td><td>${fmt(exp)}</td><td>${fmt(inc-exp)}</td>`; tbody.appendChild(tr); });
}

// Guard
onAuthStateChanged(auth, (user)=>{
  if(user){
    document.getElementById('auth').classList.add('hide');
    document.getElementById('dash').classList.remove('hide');
    if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
    listenTransactions(); listenBudgets(); listenParc(); listenGoals(); listenCards();
  }else{
    document.getElementById('auth').classList.remove('hide');
    document.querySelectorAll('section:not(#auth)').forEach(s=> s.classList.add('hide'));
  }
});