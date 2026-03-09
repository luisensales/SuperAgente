import Database from 'better-sqlite3';
import { env } from '../config.js';
import admin from 'firebase-admin';
import { existsSync } from 'fs';
import { resolve } from 'path';

export interface ChatMessage {
    id?: number;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    name?: string;
    timestamp?: string | number; // Firebase uses strings or timestamps, SQLite uses strings
}

class MemoryDB {
    private db: Database.Database;
    private firestore?: FirebaseFirestore.Firestore;
    private initializedFirestore: boolean = false;

    constructor() {
        this.db = new Database(env.DB_PATH);
        this.initSQLite();
        this.initFirestore();
    }

    private initSQLite() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        name TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    }

    private initFirestore() {
        const keyJson = env.FIREBASE_SERVICE_ACCOUNT_JSON;
        const keyPath = resolve(process.cwd(), env.FIREBASE_SERVICE_ACCOUNT_PATH);

        let credential;

        if (keyJson) {
            try {
                credential = admin.credential.cert(JSON.parse(keyJson));
            } catch (error) {
                console.error("❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", error);
            }
        } else if (env.FIREBASE_PROJECT_ID && existsSync(keyPath)) {
            credential = admin.credential.cert(keyPath);
        }

        if (credential) {
            try {
                if (admin.apps.length === 0) {
                    admin.initializeApp({
                        credential,
                        projectId: env.FIREBASE_PROJECT_ID,
                    });
                }
                this.firestore = admin.firestore();
                this.initializedFirestore = true;
                console.log("🔥 Firestore initialized successfully!");
            } catch (error) {
                console.error("❌ Failed to initialize Firestore:", error);
            }
        } else {
            console.warn("⚠️ Firebase configuration missing (check FIREBASE_SERVICE_ACCOUNT_JSON or key file). Firestore will be disabled.");
        }
    }

    public async addMessage(message: ChatMessage) {
        // 1. Save to local SQLite (always)
        const stmt = this.db.prepare(
            `INSERT INTO messages (role, content, name) VALUES (?, ?, ?)`
        );
        stmt.run(message.role, message.content, message.name || null);

        // 2. Save to Firestore if available
        if (this.initializedFirestore && this.firestore) {
            try {
                await this.firestore.collection('messages').add({
                    role: message.role,
                    content: message.content,
                    name: message.name || null,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                });
            } catch (error) {
                console.error("Error saving message to Firestore:", error);
            }
        }
    }

    public async getMessages(limit: number = 20): Promise<ChatMessage[]> {
        // We primarily return messages from SQLite for speed, 
        // assuming it's kept in sync with Firestore.
        const stmt = this.db.prepare(
            `SELECT * FROM (
        SELECT * FROM messages ORDER BY timestamp DESC LIMIT ?
      ) ORDER BY timestamp ASC`
        );
        return stmt.all(limit) as ChatMessage[];
    }

    public async clearMemory() {
        // 1. Clear local SQLite
        this.db.exec(`DELETE FROM messages`);

        // 2. Clear Firestore collection if initialized
        if (this.initializedFirestore && this.firestore) {
            try {
                const batch = this.firestore.batch();
                const snapshot = await this.firestore.collection('messages').get();
                snapshot.docs.forEach((doc) => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
            } catch (error) {
                console.error("Error clearing Firestore collection:", error);
            }
        }
    }
}

export const memory = new MemoryDB();
