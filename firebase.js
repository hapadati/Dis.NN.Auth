// 📂 firestore.js
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Render の secret file を利用する場合
const serviceAccount = JSON.parse(
  readFileSync('/etc/secrets/firebase-account.json', 'utf8')
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
console.log("Connected to Firestore project:", serviceAccount.project_id);

// 👇 これを追加するのを忘れない！
export { db };
