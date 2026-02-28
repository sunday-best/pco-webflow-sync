import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const WEBFLOW_CLIENT_ID = Deno.env.get('WEBFLOW_CLIENT_ID');
const WEBFLOW_CLIENT_SECRET = Deno.env.get('WEBFLOW_CLIENT_SECRET');
const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY');
const APP_BASE_URL = Deno.env.get('APP_BASE_URL') || 'https://app.base44.com';

async function encrypt(text) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(ENCRYPTION_KEY.padEnd(32).slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(text)
  );
  const combined = new Uint8Array(iv.byteLength + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(encryptedText) {
  const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(ENCRYPTION_KEY.padEnd(32).slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action, connectionId, code } = body;

  const redirectUri = `${APP_BASE_URL}/functions/webflowAuth`;

  if (action === 'getAuthUrl') {
    const params = new URLSearchParams({
      client_id: WEBFLOW_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'cms:read cms:write sites:read',
      state: connectionId
    });
    return Response.json({
      url: `https://webflow.com/oauth/authorize?${params}`
    });
  }

  if (action === 'callback') {
    const tokenRes = await fetch('https://api.webflow.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: WEBFLOW_CLIENT_ID,
        client_secret: WEBFLOW_CLIENT_SECRET,
        redirect_uri: redirectUri
      })
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return Response.json({ error: 'Token exchange failed', details: err }, { status: 400 });
    }

    const tokens = await tokenRes.json();
    const encryptedAccess = await encrypt(tokens.access_token);

    await base44.asServiceRole.entities.Connection.update(connectionId, {
      webflow_access_token: encryptedAccess
    });

    return Response.json({ success: true });
  }

  if (action === 'getDecryptedToken') {
    const connections = await base44.asServiceRole.entities.Connection.filter({ id: connectionId });
    const conn = connections?.[0];
    if (!conn?.webflow_access_token) return Response.json({ error: 'No token' }, { status: 404 });
    const token = await decrypt(conn.webflow_access_token);
    return Response.json({ token });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
});