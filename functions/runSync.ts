import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY');
const NOTIFICATION_EMAIL = Deno.env.get('NOTIFICATION_EMAIL');

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

// Retry with exponential backoff for transient errors
async function withRetry(fn, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isTransient = err.message?.includes('429') || 
                          err.message?.includes('timeout') || 
                          err.message?.includes('network') ||
                          err.message?.includes('502') ||
                          err.message?.includes('503');
      if (!isTransient || attempt === maxAttempts) throw err;
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}

async function pcoRequest(token, path) {
  // Decrypted value is always the Basic auth base64 string (from Personal Access Token)
  const authHeader = `Basic ${token}`;
  const res = await fetch(`https://api.planningcenteronline.com${path}`, {
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json'
    }
  });
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '5');
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    throw new Error('429 Rate limited - will retry');
  }
  if (!res.ok) throw new Error(`PCO request failed: ${res.status} ${path}`);
  return res.json();
}

async function fetchAllPcoEvents(pcoToken, updatedSince = null) {
  let allEvents = [];
  let baseUrl = `/registrations/v2/signups?where[archived]=false&per_page=100&include=signup_location,next_signup_time`;
  if (updatedSince) {
    baseUrl += `&where[updated_at][gte]=${encodeURIComponent(updatedSince)}`;
  }
  let nextUrl = baseUrl;

  while (nextUrl) {
    const data = await withRetry(() => pcoRequest(pcoToken, nextUrl));
    const signups = data.data || [];
    const included = data.included || [];

    for (const signup of signups) {
      const attrs = signup.attributes || {};

      // Skip archived
      if (attrs.archived) continue;

      // Skip "link only" events - only sync "listed" or "featured"
      const publicUrlType = attrs.public_url_type || attrs.listing_type || '';
      if (publicUrlType === 'link_only') continue;

      // Find location from included
      const locationRel = signup.relationships?.signup_location?.data;
      const location = locationRel
        ? included.find(i => i.type === 'SignupLocation' && i.id === locationRel.id)
        : null;
      const locAttrs = location?.attributes || {};

      // Find next signup time
      const nextTimeRel = signup.relationships?.next_signup_time?.data;
      const nextTime = nextTimeRel
        ? included.find(i => i.type === 'SignupTime' && i.id === nextTimeRel.id)
        : null;
      const nextTimeAttrs = nextTime?.attributes || {};

      const description = attrs.description || '';
      const descriptionPlain = description.replace(/<[^>]*>/g, '').trim();

      const locationFull = [
        locAttrs.name,
        locAttrs.street,
        locAttrs.city,
        locAttrs.state,
        locAttrs.zip
      ].filter(Boolean).join(', ');

      allEvents.push({
        'event.id': signup.id,
        'event.updated_at': attrs.updated_at,
        'event.name': attrs.name,
        'event.summary': '',
        'event.description': description,
        'event.description_plain': descriptionPlain,
        'event.starts_at': nextTimeAttrs.starts_at || attrs.open_at || '',
        'event.ends_at': nextTimeAttrs.ends_at || attrs.close_at || '',
        'event.all_day': false,
        'event.public': !attrs.archived,
        'event.archived': attrs.archived || false,
        'event.registration_open': !!(attrs.open_at && new Date(attrs.open_at) <= new Date() && (!attrs.close_at || new Date(attrs.close_at) >= new Date())),
        'event.registration_url': attrs.new_registration_url || '',
        'event.event_url': attrs.new_registration_url || '',
        'event.location_name': locAttrs.name || '',
        'event.location_address_line_1': locAttrs.street || '',
        'event.location_address_line_2': '',
        'event.location_city': locAttrs.city || '',
        'event.location_state': locAttrs.state || '',
        'event.location_postal_code': locAttrs.zip || '',
        'event.location_country': locAttrs.country || '',
        'event.location_full': locationFull,
        'event.image_url': attrs.logo_url || '',
        'event.thumbnail_url': attrs.logo_url || '',
        'event.capacity': null,
        'event.spots_remaining': null,
        'event.registrations_count': null,
        'event.category': '',
        'event.tags': ''
      });
    }

    const nextLink = data.links?.next;
    nextUrl = nextLink ? nextLink.replace('https://api.planningcenteronline.com', '') : null;
  }

  return allEvents;
}

function applyTransform(value, transform, transformConfig, pcoEvent) {
  if (!transform || transform === 'none') return value;

  if (transform === 'static') return transformConfig?.value || '';
  if (transform === 'fallback') return value || transformConfig?.fallback || '';
  if (transform === 'trim') return (value || '').trim();
  if (transform === 'strip_html') return (value || '').replace(/<[^>]*>/g, '').trim();
  if (transform === 'date_format') {
    if (!value) return '';
    const fmt = transformConfig?.format || 'YYYY-MM-DD';
    const d = new Date(value);
    return fmt
      .replace('YYYY', d.getFullYear())
      .replace('MM', String(d.getMonth() + 1).padStart(2, '0'))
      .replace('DD', String(d.getDate()).padStart(2, '0'))
      .replace('HH', String(d.getHours()).padStart(2, '0'))
      .replace('mm', String(d.getMinutes()).padStart(2, '0'));
  }
  if (transform === 'combine') {
    const pattern = transformConfig?.pattern || '';
    return pattern.replace(/\{([^}]+)\}/g, (_, field) => pcoEvent[field] || '');
  }
  return value;
}

function buildWebflowFieldData(pcoEvent, mappings) {
  const fieldData = {};
  for (const mapping of mappings) {
    if (!mapping.pco_field || !mapping.webflow_field) continue;
    let value = pcoEvent[mapping.pco_field];
    value = applyTransform(value, mapping.transform, mapping.transform_config, pcoEvent);
    if (value !== undefined && value !== null) {
      fieldData[mapping.webflow_field] = value;
    }
  }
  return fieldData;
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
  if (res.status === 429) {
    await new Promise(r => setTimeout(r, 5000));
    throw new Error('429 Rate limited');
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Webflow ${method} ${path} (${res.status}): ${err.slice(0, 200)}`);
  }
  if (method === 'DELETE') return { success: true };
  return res.json();
}

async function fetchAllWebflowItems(wfToken, collectionId) {
  let allItems = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const result = await withRetry(() => webflowRequest(wfToken, `/collections/${collectionId}/items?limit=${limit}&offset=${offset}`));
    const items = result.items || [];
    allItems = allItems.concat(items);
    if (items.length < limit) break;
    offset += limit;
  }
  return allItems;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { connectionId, trigger = 'scheduled', forceFullSync = false } = body;

  // Allow scheduled calls (no user) or authenticated users
  let user = null;
  try { user = await base44.auth.me(); } catch (_) {}

  if (!connectionId) return Response.json({ error: 'connectionId required' }, { status: 400 });

  // Load connection
  const connections = await base44.asServiceRole.entities.Connection.filter({ id: connectionId });
  const conn = connections?.[0];
  if (!conn) return Response.json({ error: 'Connection not found' }, { status: 404 });
  if (conn.status === 'setup_incomplete') {
    return Response.json({ error: 'Connection setup incomplete' }, { status: 400 });
  }

  // Validate required config
  if (!conn.pco_access_token || !conn.webflow_access_token || !conn.webflow_collection_id) {
    return Response.json({ error: 'Connection missing required credentials or collection' }, { status: 400 });
  }

  const hasEventIdMapping = (conn.field_mappings || []).some(m => m.pco_field === 'event.id');
  if (!hasEventIdMapping) {
    return Response.json({ error: 'Field mapping must include event.id → pco_event_id' }, { status: 400 });
  }

  // Find the pco_event_id webflow field name from mapping
  const eventIdMapping = conn.field_mappings.find(m => m.pco_field === 'event.id');
  const pcoIdWebflowField = eventIdMapping.webflow_field;

  // Create sync run record
  const syncRun = await base44.asServiceRole.entities.SyncRun.create({
    connection_id: connectionId,
    connection_name: conn.name,
    status: 'running',
    started_at: new Date().toISOString(),
    trigger,
    stats: { pco_events_fetched: 0, webflow_items_fetched: 0, created: 0, updated: 0, archived: 0, deleted: 0, skipped: 0, errors: 0 }
  });

  const startTime = Date.now();
  const stats = { pco_events_fetched: 0, webflow_items_fetched: 0, created: 0, updated: 0, archived: 0, deleted: 0, skipped: 0, errors: 0 };
  const errorDetails = [];
  const eventLog = [];

  try {
    // Decrypt tokens
    const pcoToken = await decrypt(conn.pco_access_token);
    const wfToken = await decrypt(conn.webflow_access_token);

    // Fetch PCO events - only those updated since last sync (if available), unless forced full sync
    const updatedSince = forceFullSync ? null : (conn.last_sync_at || null);
    const pcoEvents = await fetchAllPcoEvents(pcoToken, updatedSince);
    stats.pco_events_fetched = pcoEvents.length;

    // Build lookup map: pco_event_id → webflow item
    // On full sync: fetch all Webflow items upfront for removal detection
    // On incremental sync: skip bulk fetch to save API calls; look up per-event on-demand
    const wfItemMap = {};
    let wfItems = [];

    if (forceFullSync) {
      wfItems = await fetchAllWebflowItems(wfToken, conn.webflow_collection_id);
      stats.webflow_items_fetched = wfItems.length;
      for (const item of wfItems) {
        const pcoId = item.fieldData?.[pcoIdWebflowField];
        if (pcoId) wfItemMap[pcoId] = item;
      }
    }

    // Track which PCO event IDs we saw
    const seenPcoIds = new Set();

    // Process each PCO event
    for (const pcoEvent of pcoEvents) {
      const pcoId = pcoEvent['event.id'];
      seenPcoIds.add(pcoId);
      const fieldData = buildWebflowFieldData(pcoEvent, conn.field_mappings || []);

      // On incremental sync, look up the Webflow item by searching for the pco_event_id field
      let existingItem = wfItemMap[pcoId];
      if (!forceFullSync && !existingItem) {
        try {
          const searchResult = await withRetry(() =>
            webflowRequest(wfToken, `/collections/${conn.webflow_collection_id}/items?${pcoIdWebflowField}=${encodeURIComponent(pcoId)}&limit=1`)
          );
          existingItem = searchResult.items?.[0] || null;
          if (existingItem) wfItemMap[pcoId] = existingItem;
        } catch (_) {
          existingItem = null;
        }
      }

      try {
        if (existingItem) {
          // Compare existing Webflow field data to new data - skip if unchanged
          const existingFieldData = existingItem.fieldData || {};
          const hasChanges = Object.keys(fieldData).some(key => {
            const newVal = fieldData[key] == null ? '' : String(fieldData[key]);
            const oldVal = existingFieldData[key] == null ? '' : String(existingFieldData[key]);
            return newVal !== oldVal;
          });

          if (!hasChanges) {
            stats.skipped++;
            eventLog.push({ pco_event_id: pcoId, event_name: pcoEvent['event.name'], action: 'skip', webflow_item_id: existingItem.id, success: true });
          } else {
          // Update
          await withRetry(() => webflowRequest(wfToken, `/collections/${conn.webflow_collection_id}/items/${existingItem.id}`, 'PATCH', { fieldData }));
          // Publish
          await withRetry(() => webflowRequest(wfToken, `/collections/${conn.webflow_collection_id}/items/publish`, 'POST', { itemIds: [existingItem.id] }));
          stats.updated++;
          eventLog.push({ pco_event_id: pcoId, event_name: pcoEvent['event.name'], action: 'update', webflow_item_id: existingItem.id, success: true });
          }
        } else {
          // Create
          const created = await withRetry(() => webflowRequest(wfToken, `/collections/${conn.webflow_collection_id}/items`, 'POST', { fieldData }));
          const newId = created.id;
          if (newId) {
            await withRetry(() => webflowRequest(wfToken, `/collections/${conn.webflow_collection_id}/items/publish`, 'POST', { itemIds: [newId] }));
          }
          stats.created++;
          eventLog.push({ pco_event_id: pcoId, event_name: pcoEvent['event.name'], action: 'create', webflow_item_id: newId, success: true });
        }
      } catch (err) {
        stats.errors++;
        const errType = err.message?.includes('400') || err.message?.includes('422') ? 'config_error' : 'transient_error';
        errorDetails.push({
          event_id: pcoId,
          event_name: pcoEvent['event.name'],
          action: existingItem ? 'update' : 'create',
          error_type: errType,
          error_message: err.message,
          retry_count: 2
        });
        eventLog.push({ pco_event_id: pcoId, event_name: pcoEvent['event.name'], action: existingItem ? 'update' : 'create', success: false });
      }
    }

    // Handle removed events - only on full sync (no updatedSince filter)
    // On incremental sync, we can't detect removals since we only fetched changed events
    if (!updatedSince) for (const item of wfItems) {
      const pcoId = item.fieldData?.[pcoIdWebflowField];
      if (!pcoId || seenPcoIds.has(pcoId)) continue;

      try {
        if (conn.on_removal_action === 'delete') {
          await withRetry(() => webflowRequest(wfToken, `/collections/${conn.webflow_collection_id}/items/${item.id}`, 'DELETE'));
          stats.deleted++;
          eventLog.push({ pco_event_id: pcoId, event_name: item.fieldData?.name || 'Unknown', action: 'delete', webflow_item_id: item.id, success: true });
        } else {
          // Archive
          await withRetry(() => webflowRequest(wfToken, `/collections/${conn.webflow_collection_id}/items/${item.id}`, 'PATCH', { fieldData: { _archived: true } }));
          stats.archived++;
          eventLog.push({ pco_event_id: pcoId, event_name: item.fieldData?.name || 'Unknown', action: 'archive', webflow_item_id: item.id, success: true });
        }
      } catch (err) {
        stats.errors++;
        errorDetails.push({
          event_id: pcoId,
          action: conn.on_removal_action === 'delete' ? 'delete' : 'archive',
          error_type: 'transient_error',
          error_message: err.message,
          retry_count: 2
        });
      }
    }

    const duration = Date.now() - startTime;
    const finalStatus = stats.errors > 0 && stats.created + stats.updated === 0 ? 'failed'
      : stats.errors > 0 ? 'partial' : 'success';

    // Update sync run
    await base44.asServiceRole.entities.SyncRun.update(syncRun.id, {
      status: finalStatus,
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      stats,
      error_summary: errorDetails.length > 0 ? `${errorDetails.length} event(s) failed to sync` : null,
      error_details: errorDetails,
      event_log: eventLog
    });

    // Update connection
    const newConsecutiveFailures = finalStatus === 'failed' ? (conn.consecutive_failures || 0) + 1 : 0;
    await base44.asServiceRole.entities.Connection.update(connectionId, {
      last_sync_at: new Date().toISOString(),
      last_sync_status: finalStatus,
      last_sync_stats: stats,
      consecutive_failures: newConsecutiveFailures,
      status: newConsecutiveFailures >= 3 ? 'error' : 'active'
    });

    // Send failure notification after 3 consecutive failures
    if (newConsecutiveFailures === 3 && NOTIFICATION_EMAIL) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: NOTIFICATION_EMAIL,
        subject: `[PCO Sync] Connection "${conn.name}" has failed 3 times in a row`,
        body: `The connection "${conn.name}" has failed 3 consecutive sync runs.\n\nLast error: ${errorDetails[0]?.error_message || 'Unknown'}\n\nPlease check the connection settings.`
      });
    }

    return Response.json({ success: true, status: finalStatus, stats, duration_ms: duration });

  } catch (err) {
    const duration = Date.now() - startTime;

    await base44.asServiceRole.entities.SyncRun.update(syncRun.id, {
      status: 'failed',
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      stats,
      error_summary: err.message,
      error_details: [{ error_type: 'config_error', error_message: err.message }],
      event_log: eventLog
    });

    const newFailures = (conn.consecutive_failures || 0) + 1;
    await base44.asServiceRole.entities.Connection.update(connectionId, {
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'failed',
      consecutive_failures: newFailures,
      status: newFailures >= 3 ? 'error' : conn.status
    });

    return Response.json({ error: err.message, stats }, { status: 500 });
  }
});