import {initializeApp} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithPopup,signInWithRedirect,GoogleAuthProvider,signOut} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {getFirestore,doc,setDoc,deleteDoc,onSnapshot} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {getMessaging,getToken,isSupported} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js";

const cfg={apiKey:"AIzaSyDTz8l4FtNpyjx_ZWo19MqZ2EJygiexM2w",authDomain:"task-tracker-49b82.firebaseapp.com",projectId:"task-tracker-49b82",messagingSenderId:"636251916106",appId:"1:636251916106:web:ce75d6ead2a74aac1ca3b3"};
const VAPID="BOdMVWnMN0kvB4p2QxnARr5mmgGnzI5bSz-b6CPDA3_KqQQvt47m48Eb9xcosIVISCqVcfvHKpR6rR2N9UlriZA";
const app=initializeApp(cfg),auth=getAuth(app),db=getFirestore(app);
const $=s=>document.querySelector(s),T=()=>window.TT;
let uid=null,unsub=null,timer=null,first=true,tok=localStorage.getItem('tt_tok');

function gate(on){let g=$('#gate');
 if(!g){g=document.createElement('div');g.id='gate';
  g.style.cssText='position:fixed;inset:0;z-index:20;background:var(--bg);display:none;place-content:center;justify-items:center;text-align:center;padding:24px;gap:14px';
  g.innerHTML='<div style="font-size:56px">✅</div><h1 style="margin:0">Task Tracker</h1><p style="color:var(--mut);margin:0 0 8px;max-width:300px">Sign in to sync your tasks and get reminders on this device.</p><button id="gIn" class="sav" style="font-size:18px;padding:14px 26px;min-height:48px">Sign in with Google</button><button id="gLoc" style="color:var(--mut);padding:12px;min-height:44px">Use on this device only</button><p id="gErr" style="color:var(--red);margin:0"></p>';
  document.body.appendChild(g);$('#gIn').onclick=login;$('#gLoc').onclick=()=>{localStorage.setItem('tt_local','1');gate(false)}}
 g.style.display=on?'grid':'none'}

async function login(){localStorage.removeItem('tt_local');const p=new GoogleAuthProvider();
 try{await signInWithPopup(auth,p)}
 catch(e){if(e.code==='auth/popup-blocked'||e.code==='auth/operation-not-supported-in-this-environment'){try{await signInWithRedirect(auth,p)}catch(x){}}
  else if(e.code!=='auth/popup-closed-by-user')$('#gErr').textContent='Sign-in failed ('+(e.code||'error')+')'}}

function save(S){if(!uid)return;clearTimeout(timer);timer=setTimeout(async()=>{
 try{await setDoc(doc(db,'users',uid),{json:JSON.stringify({tasks:S.tasks,theme:S.theme,sound:S.sound,upd:S.upd}),upd:S.upd,tz:Intl.DateTimeFormat().resolvedOptions().timeZone},{merge:true});T().sync('Synced to your account')}
 catch(e){T().sync('Sync paused, saved on this device')}},500)}

async function push(){
 if(!uid||tok||!('Notification' in window)||Notification.permission!=='granted'||!(await isSupported()))return;
 try{const reg=await navigator.serviceWorker.register('firebase-messaging-sw.js');await navigator.serviceWorker.ready;
  const k=await getToken(getMessaging(app),{vapidKey:VAPID,serviceWorkerRegistration:reg});
  if(k){await setDoc(doc(db,'users',uid,'devices',k),{token:k,updated:Date.now()});tok=k;localStorage.setItem('tt_tok',k)}}
 catch(e){T().toast('Push setup failed: '+(e.code||e.message||'error'))}}

async function unpush(){if(tok&&uid){try{await deleteDoc(doc(db,'users',uid,'devices',tok))}catch(e){}}tok=null;localStorage.removeItem('tt_tok')}

window.TT_save=S=>{save(S);S.notif?push():unpush()};

onAuthStateChanged(auth,u=>{
 if(unsub){unsub();unsub=null}
 if(!u){uid=null;T().sync('Not signed in. Tap here to sign in');if(!localStorage.getItem('tt_local'))gate(true);return}
 uid=u.uid;gate(false);first=true;T().sync('Connecting...');
 unsub=onSnapshot(doc(db,'users',uid),s=>{
  if(s.metadata.hasPendingWrites)return;
  let r=null;try{r=s.exists()?JSON.parse(s.data().json):null}catch(e){}
  const S=T().S();
  if(r&&r.upd>S.upd)T().apply(r);else if(first&&(!r||r.upd<S.upd))save(S);
  first=false;T().sync('Synced to your account')},()=>T().sync('Sync paused, saved on this device'));
 if(T().S().notif)push()});

$('#sy').closest('.li').onclick=()=>{if(!uid){localStorage.removeItem('tt_local');gate(true)}};
$('#lo').onclick=()=>T().confirm('Log out?','Your tasks stay saved to your account. This clears the copy on this device.',async()=>{await unpush();T().reset();await signOut(auth)},'Log Out');
