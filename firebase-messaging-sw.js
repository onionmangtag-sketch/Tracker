importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js','https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
firebase.initializeApp({apiKey:"AIzaSyDTz8l4FtNpyjx_ZWo19MqZ2EJygiexM2w",projectId:"task-tracker-49b82",messagingSenderId:"636251916106",appId:"1:636251916106:web:ce75d6ead2a74aac1ca3b3"});
// Snooze / Done buttons show on Android and desktop; iOS ignores actions (a tap opens the app instead).
firebase.messaging().onBackgroundMessage(p=>{const d=p.data||{};
 return self.registration.showNotification(d.title||'Task Tracker',{body:d.body||'',icon:'icon-192.png',tag:d.tag||undefined,
  data:{id:d.id||'',d:d.d||''},actions:d.id?[{action:'snooze',title:'💤 Snooze 10 min'},{action:'done',title:'✓ Done'}]:[]})});
// The app does the work (it is signed in and syncs): tell an open window, or open one with the action in the URL.
self.addEventListener('notificationclick',e=>{e.notification.close();const x=e.notification.data||{},act=e.action||'open';
 e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>{
  if(l.length){if(x.id)l[0].postMessage({tt:1,act,id:x.id,d:x.d});return l[0].focus()}
  return clients.openWindow(x.id?'./?act='+act+'&id='+encodeURIComponent(x.id)+'&d='+encodeURIComponent(x.d):'./')}))});
