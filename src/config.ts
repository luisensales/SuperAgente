import { config } from 'dotenv';
import { resolve } from 'path';

// Load variables from .env
config({ path: resolve(process.cwd(), '.env') });

const requireEnv = (key: string): string => {
    const value = process.env[key];
    if (!value) {
        console.error(`Missing required environment variable: ${key}`);
        process.exit(1);
    }
    return value;
};

export const env = {
    TELEGRAM_BOT_TOKEN: requireEnv('TELEGRAM_BOT_TOKEN'),
    TELEGRAM_ALLOWED_USER_IDS: requireEnv('TELEGRAM_ALLOWED_USER_IDS')
        .split(',')
        .map(id => parseInt(id.trim(), 10))
        .filter(id => !isNaN(id)),
    GROQ_API_KEY: requireEnv('GROQ_API_KEY'),
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
    OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || 'openrouter/free',
    DB_PATH: process.env.DB_PATH || './memory.db',
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
    FIREBASE_SERVICE_ACCOUNT_PATH: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-key.json',
    FIREBASE_SERVICE_ACCOUNT_JSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || '',
};

if (env.TELEGRAM_ALLOWED_USER_IDS.length === 0) {
    console.error("TELEGRAM_ALLOWED_USER_IDS must contain at least one valid numeric ID.");
    process.exit(1);
}
