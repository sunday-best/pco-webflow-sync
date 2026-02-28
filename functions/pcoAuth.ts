import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY');

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
  const { action, connectionId } = body;

  if (action === 'connectPersonalToken') {
    // PCO Personal Access Token - uses HTTP Basic auth (appId:secret)
    const { appId, secret } = body;
    if (!appId || !secret) return Response.json({ error: 'appId and secret required' }, { status: 400 });

    const basicAuth = btoa(`${appId}:${secret}`);

    // Verify token works and get org info
    const orgRes = await fetch('https://api.planningcenteronline.com/people/v2/me', {
      headers: { Authorization: `Basic ${basicAuth}` }
    });

    if (!orgRes.ok) {
      return Response.json({ error: 'Invalid credentials - could not authenticate with Planning Center' }, { status: 401 });
    }

    const orgData = await orgRes.json();
    const orgName = orgData?.data?.attributes?.name || 'Unknown Org';

    // Encrypt and store - we store the basic auth string as the "access token"
    const encryptedAccess = await encrypt(basicAuth);

    await base44.asServiceRole.entities.Connection.update(connectionId, {
      pco_access_token: encryptedAccess,
      pco_organization_name: orgName
    });

    return Response.json({ success: true, org_name: orgName });
  }

  if (action === 'getAuthUrl') {
    const params = new URLSearchParams({
      client_id: PCO_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'registrations',
      state: connectionId
    });
    return Response.json({
      url: `https://api.planningcenteronline.com/oauth/authorize?${params}`
    });
  }

  if (action === 'getDecryptedToken') {
    // Internal use only - get decrypted access token
    const connections = await base44.asServiceRole.entities.Connection.filter({ id: connectionId });
    const conn = connections?.[0];
    if (!conn?.pco_access_token) return Response.json({ error: 'No token' }, { status: 404 });

    const token = await decrypt(conn.pco_access_token);
    return Response.json({ token });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
});