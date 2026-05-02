/**
 * /api/gallery-build?id=<design-id>
 *
 * Generates one curated example design via Replicate, stores the PNG bytes in
 * Netlify Blobs, and updates the manifest. Idempotent: if the design already
 * exists in blobs, returns cached status without spending API credit.
 *
 * Security: only design IDs in the whitelist (GALLERY_DESIGNS in lib/prompts.js)
 * are accepted. Anyone can call this URL safely — once the gallery is built,
 * subsequent calls are free no-ops.
 *
 * Env required:
 *   REPLICATE_API_TOKEN
 */

const { getStore } = require('@netlify/blobs');
const { buildPrompt, GALLERY_DESIGNS } = require('../../lib/prompts');

const FLUX_MODEL = 'black-forest-labs/flux-dev';
const STORE_NAME = 'tattoo-gallery';

async function pollUntilDone(token, getUrl, maxMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const r = await fetch(getUrl, { headers: { 'Authorization': `Token ${token}` } });
    const j = await r.json();
    if (j.status === 'succeeded') return j;
    if (j.status === 'failed' || j.status === 'canceled') {
      throw new Error(`generation ${j.status}: ${JSON.stringify(j.error || j)}`);
    }
    await new Promise(res => setTimeout(res, 2000));
  }
  throw new Error('generation timeout');
}

async function generateOne(token, prompt) {
  const create = await fetch(`https://api.replicate.com/v1/models/${FLUX_MODEL}/predictions`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait=20',
    },
    body: JSON.stringify({
      input: {
        prompt,
        aspect_ratio: '1:1',
        num_outputs: 1,
        num_inference_steps: 28,
        guidance: 3.5,
        output_format: 'png',
        output_quality: 95,
        go_fast: true,
      },
    }),
  });
  const j = await create.json();
  if (!create.ok) throw new Error(`replicate: ${JSON.stringify(j)}`);

  let result = j;
  if (j.status !== 'succeeded' && j.status !== 'failed') {
    result = await pollUntilDone(token, j.urls.get);
  }
  if (result.status !== 'succeeded') {
    throw new Error(`generation ${result.status}: ${JSON.stringify(result.error || result)}`);
  }
  const url = Array.isArray(result.output) ? result.output[0] : result.output;
  if (!url) throw new Error('no output url');
  return url;
}

exports.handler = async (event) => {
  const id = event.queryStringParameters?.id;
  if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'id query param required' }) };

  // Whitelist check
  const design = GALLERY_DESIGNS.find(d => d.id === id);
  if (!design) {
    return { statusCode: 404, body: JSON.stringify({ error: `unknown design id: ${id}` }) };
  }

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return { statusCode: 500, body: JSON.stringify({ error: 'REPLICATE_API_TOKEN missing' }) };
  }

  const store = getStore(STORE_NAME);
  const blobKey = `${id}.png`;

  // Idempotent: skip if already exists
  const existing = await store.getMetadata(blobKey).catch(() => null);
  if (existing) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'cached', label: design.label, style: design.style }),
    };
  }

  // Generate
  const { positive } = buildPrompt({ idea: design.idea, style: design.style });
  let imageUrl;
  try {
    imageUrl = await generateOne(token, positive);
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ id, status: 'error', error: err.message }) };
  }

  // Download bytes
  let buffer;
  try {
    const png = await fetch(imageUrl);
    if (!png.ok) throw new Error(`image download ${png.status}`);
    buffer = Buffer.from(await png.arrayBuffer());
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ id, status: 'error', error: 'download: ' + err.message }) };
  }

  // Store in Netlify Blobs
  await store.set(blobKey, buffer, {
    metadata: {
      style: design.style,
      label: design.label,
      idea: design.idea,
      bytes: buffer.length,
      ts: Date.now(),
    },
  });

  // Update manifest
  const manifestKey = 'manifest.json';
  let manifest = [];
  try {
    const existingManifest = await store.get(manifestKey, { type: 'json' });
    if (Array.isArray(existingManifest)) manifest = existingManifest;
  } catch {}

  manifest = manifest.filter(m => m.id !== id);
  manifest.push({
    id,
    style: design.style,
    label: design.label,
    file: `/api/gallery-image?id=${id}`,
    bytes: buffer.length,
    ts: Date.now(),
  });
  await store.setJSON(manifestKey, manifest);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status: 'generated', label: design.label, style: design.style, bytes: buffer.length }),
  };
};
