fetch('https://api.telegram.org/bot8581865451:AAGu-28cZ-F2uOCmY0hR0qhM5gPl2doTyMg/deleteWebhook')
.then(r=>r.json())
.then(data => {
   console.log('Webhook deleted result:', data);
}).catch(e => console.error(e));
