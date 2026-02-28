import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

async function webflowRequest(token, path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'accept-version': '2.0.0',
      'Content-Type': 'application/json'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`https://api.webflow.com/v2${path}`, opts);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Webflow API ${method} ${path} failed (${res.status}): ${err}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action, connectionId, siteId, collectionId, itemId, data } = body;

  // Load and decrypt token
  const connections = await base44.asServiceRole.entities.Connection.filter({ id: connectionId });
  const conn = connections?.[0];
  if (!conn?.webflow_access_token) {
    return Response.json({ error: 'Webflow not connected' }, { status: 400 });
  }
  const token = await decrypt(conn.webflow_access_token);

  try {
    if (action === 'listSites') {
      const result = await webflowRequest(token, '/sites');
      return Response.json({ sites: result.sites || [] });
    }

    if (action === 'listCollections') {
      const result = await webflowRequest(token, `/sites/${siteId}/collections`);
      return Response.json({ collections: result.collections || [] });
    }

    if (action === 'getCollectionFields') {
      const result = await webflowRequest(token, `/collections/${collectionId}`);
      const fields = (result.fields || []).filter(f => !f.isEditable === false || f.isEditable);
      return Response.json({ fields });
    }

    if (action === 'listItems') {
      // Paginate through all items
      let allItems = [];
      let offset = 0;
      const limit = 100;
      while (true) {
        const result = await webflowRequest(token, `/collections/${collectionId}/items?limit=${limit}&offset=${offset}`);
        const items = result.items || [];
        allItems = allItems.concat(items);
        if (items.length < limit) break;
        offset += limit;
      }
      return Response.json({ items: allItems });
    }

    if (action === 'createItem') {
      const result = await webflowRequest(token, `/collections/${collectionId}/items`, 'POST', {
        fieldData: data
      });
      // Publish the item
      if (result.id) {
        await webflowRequest(token, `/collections/${collectionId}/items/publish`, 'POST', {
          itemIds: [result.id]
        });
      }
      return Response.json({ item: result });
    }

    if (action === 'updateItem') {
      const result = await webflowRequest(token, `/collections/${collectionId}/items/${itemId}`, 'PATCH', {
        fieldData: data
      });
      // Publish the item
      await webflowRequest(token, `/collections/${collectionId}/items/publish`, 'POST', {
        itemIds: [itemId]
      });
      return Response.json({ item: result });
    }

    if (action === 'archiveItem') {
      const result = await webflowRequest(token, `/collections/${collectionId}/items/${itemId}`, 'PATCH', {
        fieldData: { _archived: true }
      });
      return Response.json({ item: result });
    }

    if (action === 'deleteItem') {
      await webflowRequest(token, `/collections/${collectionId}/items/${itemId}`, 'DELETE');
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});