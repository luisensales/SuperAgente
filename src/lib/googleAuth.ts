import { google } from 'googleapis';
import { env } from '../config.js';
import { memory } from '../db/memory.js';

const SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly',
];

const TOKEN_KEY = 'google_tokens';

export async function getOAuth2Client() {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
        throw new Error("Mising Google Credentials (GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET).");
    }

    const oauth2Client = new google.auth.OAuth2(
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET,
        env.GOOGLE_REDIRECT_URI || `http://localhost:${process.env.PORT || 8080}/google/callback`
    );

    const tokens = await memory.get(TOKEN_KEY);
    if (tokens) {
        oauth2Client.setCredentials(tokens);
    }

    // Handle token refresh
    oauth2Client.on('tokens', async (newTokens) => {
        const currentTokens = await memory.get(TOKEN_KEY) || {};
        const mergedTokens = { ...currentTokens, ...newTokens };
        await memory.set(TOKEN_KEY, mergedTokens);
        console.log("🔄 Google tokens refreshed and saved.");
    });

    return oauth2Client;
}

export async function getAuthUrl() {
    const client = await getOAuth2Client();
    return client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent'
    });
}

export async function setTokensFromCode(code: string) {
    const client = await getOAuth2Client();
    const { tokens } = await client.getToken(code);
    await memory.set(TOKEN_KEY, tokens);
    return tokens;
}

export async function isAuthorized() {
    try {
        const tokens = await memory.get(TOKEN_KEY);
        return !!tokens && !!tokens.refresh_token;
    } catch {
        return false;
    }
}
