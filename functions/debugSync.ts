import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY');

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
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { connectionId } = body;

  const connections = await base44.asServiceRole.entities.Connection.filter({ id: connectionId });
  const conn = connections?.[0];
  if (!conn) return Response.json({ error: 'Connection not found' }, { status: 404 });

  const pcoToken = await decrypt(conn.pco_access_token);
  const authHeader = `Basic ${pcoToken}`;

  // 1. Fetch first page of PCO signups
  const pcoRes = await fetch(`https://api.planningcenteronline.com/registrations/v2/signups?where[archived]=false&per_page=10`, {
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' }
  });
  const pcoData = await pcoRes.json();
  const pcoIds = (pcoData.data || []).map(s => s.id);

  // 2. Fetch Church Center page
  const baseUrl = (conn.church_center_url || '').replace(/\/registrations.*$/, '').replace(/\/$/, '');
  const ccRes = await fetch(`${baseUrl}/registrations/events`, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' }
  });
  const html = await ccRes.text();
  const matches = [...html.matchAll(/\/registrations\/events\/(\d+)/g)];
  const ccIds = [...new Set(matches.map(m => m[1]))];

  // 3. Check overlap
  const overlap = pcoIds.filter(id => ccIds.includes(id));

  return Response.json({
    pco_signup_ids_sample: pcoIds,
    church_center_ids: ccIds,
    overlap,
    church_center_url_used: `${baseUrl}/registrations/events`,
    pco_total: pcoData.meta?.total_count,
    cc_total: ccIds.length
  });
});