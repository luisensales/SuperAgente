import admin from 'firebase-admin';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

config();

const keyPath = resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-key.json');
const projectId = process.env.FIREBASE_PROJECT_ID;

async function test() {
    console.log("Checking Firebase setup...");
    console.log(`- Project ID: ${projectId || "MISSING"}`);
    console.log(`- Key file exists: ${existsSync(keyPath)} at ${keyPath}`);

    if (!projectId || !existsSync(keyPath)) {
        console.error("❌ Setup incomplete. Please fill .env and provide the key file.");
        return;
    }

    try {
        admin.initializeApp({
            credential: admin.credential.cert(keyPath),
            projectId: projectId,
        });

        const db = admin.firestore();
        console.log("🕒 Testing connection...");

        await db.collection('test').add({
            message: "Connection test",
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log("✅ Successfully wrote to Firestore!");
        process.exit(0);
    } catch (e: any) {
        console.error("❌ Failed to connect to Firebase:", e.message);
        process.exit(1);
    }
}

test();
