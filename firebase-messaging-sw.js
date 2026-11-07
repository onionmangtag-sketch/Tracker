importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js','https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
firebase.initializeApp({apiKey:"AIzaSyDTz8l4FtNpyjx_ZWo19MqZ2EJygiexM2w",projectId:"task-tracker-49b82",messagingSenderId:"636251916106",appId:"1:636251916106:web:ce75d6ead2a74aac1ca3b3"});
firebase.messaging().onBackgroundMessage(p=>{const d=p.data||{};
 return self.registration.showNotification(d.title||'Task Tracker',{body:d.body||'',icon:'icon-192.png',tag:d.tag||undefined})});
self.addEventListener('notificationclick',e=>{e.notification.close();
 e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>l.length?l[0].focus():clients.openWindow('./')))});
