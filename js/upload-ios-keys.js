/**
 * upload-ios-keys.js
 * ──────────────────
 * iOS panel keys গুলো keys/ios/*.txt থেকে পড়ে Firestore এ upload করে।
 * 
 * RUN (একবার করলেই হবে, নতুন keys যোগ করতে আবার run করো):
 *   node upload-ios-keys.js
 *
 * REQUIREMENTS:
 *   npm install firebase-admin
 *
 * আপনার Firebase service account key (JSON) download করুন:
 *   Firebase Console → Project Settings → Service Accounts → Generate new private key
 *   → save as: serviceAccountKey.json (এই script এর পাশে রাখুন)
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────
const SERVICE_ACCOUNT_PATH = './serviceAccountKey.json'; // আপনার service account key
const KEY_FILES = {
  '1d':  './keys/ios/1d.txt',
  '7d':  './keys/ios/7d.txt',
  '31d': './keys/ios/31d.txt',
};
// ─────────────────────────────────────────────────────────────────

// Initialize Firebase Admin
const serviceAccount = require(SERVICE_ACCOUNT_PATH);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

async function uploadKeys() {
  console.log('🔑 iOS Key Upload শুরু হচ্ছে...\n');
  let totalUploaded = 0;
  let totalSkipped = 0;

  for (const [variant, filePath] of Object.entries(KEY_FILES)) {
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) {
      console.warn(`⚠️  File নেই: ${filePath} — skip করা হলো`);
      continue;
    }

    const rawKeys = fs.readFileSync(absPath, 'utf-8')
      .split('\n')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    console.log(`📂 ${variant}: ${rawKeys.length} টি key পাওয়া গেছে`);

    for (const key of rawKeys) {
      // Check if this exact key already exists (duplicate হলে skip)
      const existing = await db.collection('iosKeys')
        .where('key', '==', key)
        .limit(1)
        .get();

      if (!existing.empty) {
        console.log(`   ⏭  Already exists, skip: ${key.substring(0, 12)}...`);
        totalSkipped++;
        continue;
      }

      // Add new key
      await db.collection('iosKeys').add({
        variant: variant,       // "1d" | "7d" | "31d"
        key: key,               // actual key string
        sold: false,            // unsold
        soldTo: null,
        soldEmail: null,
        orderId: null,
        soldAt: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`   ✅ Uploaded (${variant}): ${key.substring(0, 12)}...`);
      totalUploaded++;
    }
    console.log('');
  }

  console.log('════════════════════════════════');
  console.log(`✅ সম্পন্ন! Upload: ${totalUploaded} | Skip (duplicate): ${totalSkipped}`);
  console.log('════════════════════════════════');
  process.exit(0);
}

uploadKeys().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
