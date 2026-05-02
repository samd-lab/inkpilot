/**
 * /api/generate — TattooDesignr generation endpoint
 *
 * Body: { idea: string, style: string, placement?: string, referenceDescription?: string, count?: number }
 * Returns: { sessionId, designs: [{ id, url, prompt, style }] }
 *
 * Model: Replicate's `black-forest-labs/flux-dev` (latest version, resolved at call time).
 * Cost: ~$0.030 per image. 4 designs/pack = ~$0.12.  Sells for $9.  Margin: ~98%.
 *
 * Notes:
 *  - FLUX.1-dev does NOT accept `negative_prompt` — we fold negatives into the prompt
 *    as "AVOID: ..." (handled inside lib/prompts.js).
 *  - FLUX.1-dev caps `num_outputs` at 4 per call. We do 2 parallel calls of 4 to get 8.
 *
 * Env required:
 *   REPLICATE_API_TOKEN  — from https://replicate.com/account/api-tokens
 */

const { buildPrompt, STYLE_CONFIGS } = require('../../lib/prompts');

const RATE = new Map();

const FLUX_MODEL = 'black-forest-labs/flux-dev';
const PACK_SIZE  = 8;
const PER_CALL   = 4; // FLUX-dev cap

function rateOk(ip) {
  const now = Date.now();
  const r = RATE.get(ip) || { hour: 0, day: 0, hourTs: now, dayTs: now };
  if (now - r.hourTs > 3600_000) { r.hour = 0; r.hourTs = now; }
  if (now - r.dayTs  > 86_400_000) { r.day  = 0; r.dayTs  = now; }
  if (r.hour >= 8 || r.day >= 50) return false;
  r.hour += 1; r.day += 1;
  RATE.set(ip, r);
  return true;
}

async function pollUntilDone(token, getUrl, maxMs = 90_000) {
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

async function runOnePrediction(token, prompt, count) {
  const create = await fetch(`https://api.replicate.com/v1/models/${FLUX_MODEL}/predictions`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait=55',
    },
    body: JSON.stringify({
      input: {
        prompt,
        aspect_ratio: '1:1',
        num_outputs: Math.min(count, PER_CALL),
        num_inference_steps: 28,
        guidance: 3.5,
        output_format: 'png',
        output_quality: 95,
        go_fast: true,
      },
    }),
  });
  const j = await create.json();
  if (!create.ok) throw new Error(`replicate create: ${JSON.stringify(j)}`);

  if (j.status === 'succeeded') return Array.isArray(j.output) ? j.output : [j.output];
  if (j.status === 'failed' || j.status === 'canceled') {
    throw new Error(`generation ${j.status}: ${JSON.stringify(j.error || j)}`);
  }
  // Still pending after wait=55 — poll
  const finished = await pollUntilDone(token, j.urls.get);
  return Array.isArray(finished.output) ? finished.output : [finished.output];
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || event.headers['client-ip'] || 'unknown';
  if (!rateOk(ip)) {
    return { statusCode: 429, body: JSON.stringify({ error: 'Rate limit. Try again in an hour.' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { idea, style, placement = '', referenceDescription = '', count } = body;
  if (!idea || typeof idea !== 'string' || idea.length < 3) {
    return { statusCode: 400, body: JSON.stringify({ error: 'idea is required (min 3 chars)' }) };
  }
  if (!STYLE_CONFIGS[style]) {
    return { statusCode: 400, body: JSON.stringify({ error: `unknown style. valid: ${Object.keys(STYLE_CONFIGS).join(', ')}` }) };
  }

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return { statusCode: 500, body: JSON.stringify({ error: 'REPLICATE_API_TOKEN missing in Netlify env' }) };
  }

  const totalWanted = Math.min(Math.max(parseInt(count) || PACK_SIZE, 1), PACK_SIZE);
  const { positive } = buildPrompt({ idea, style, placement, referenceDescription });

  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  // Split into parallel batches of 4
  const batches = [];
  let remaining = totalWanted;
  while (remaining > 0) {
    batches.push(Math.min(remaining, PER_CALL));
    remaining -= PER_CALL;
  }

  let allUrls = [];
  try {
    const results = await Promise.all(batches.map(n => runOnePrediction(token, positive, n)));
    allUrls = results.flat().filter(Boolean);
  } catch (err) {
    console.error('[generate] error:', err);
    return { statusCode: 502, body: JSON.stringify({ error: 'generation failed', detail: err.message }) };
  }

  if (allUrls.length === 0) {
    return { statusCode: 502, body: JSON.stringify({ error: 'no images returned' }) };
  }

  const designs = allUrls.map((url, i) => ({
    id: `${sessionId}_${i}`,
    url,
    prompt: positive,
    style,
  }));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ sessionId, status: 'succeeded', designs, prompt: positive }),
  };
};
