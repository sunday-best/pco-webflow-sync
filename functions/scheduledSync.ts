import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// This function is called by the scheduler every hour
// It finds all active connections and triggers a sync for each one

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // This is a system function - only allow admin or scheduled calls
  let user = null;
  try { user = await base44.auth.me(); } catch (_) {}

  if (user && user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch all active connections
  const connections = await base44.asServiceRole.entities.Connection.filter({ status: 'active' });

  if (!connections || connections.length === 0) {
    return Response.json({ message: 'No active connections to sync', synced: 0 });
  }

  const results = [];

  const { forceFullSync = false } = await req.json().catch(() => ({}));

  // Run syncs sequentially to avoid rate limit issues
  for (const conn of connections) {
    try {
      const res = await base44.asServiceRole.functions.invoke('runSync', {
        connectionId: conn.id,
        trigger: 'scheduled',
        forceFullSync
      });
      results.push({ connectionId: conn.id, name: conn.name, status: 'triggered', result: res });
    } catch (err) {
      results.push({ connectionId: conn.id, name: conn.name, status: 'error', error: err.message });
    }
  }

  return Response.json({
    message: `Triggered sync for ${connections.length} connection(s)`,
    synced: connections.length,
    results
  });
});