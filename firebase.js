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

// 👇 これを追加するのを忘れない！
export { db };
