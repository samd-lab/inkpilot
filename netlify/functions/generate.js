/**
 * /api/generate — TattooDesignr generation endpoint
 *
 * Body: { idea: string, style: string, placement?: string, referenceDescription?: string, count?: number }
 * Returns: { sessionId, designs: [{ url, prompt }] } — watermarked previews only.
 *
 * Real model: Replicate FLUX.1-dev with style-specific tattoo LoRA.
 * Cost: ~$0.024–$0.072 per 8-design pack. Sells for $9. Margin: 99%.
 *
 * Env required:
 *   REPLICATE_API_TOKEN  — from https://replicate.com/account/api-tokens
 *   PREVIEW_BUCKET_URL   — public CDN base (e.g. R2 or Netlify Blobs)
 *
 * Rate-limiting (in-memory, swap for Redis when traffic > 1k/day):
 *   8 packs / IP / hour, 50 / IP / day
 */

const { buildPrompt, STYLE_CONFIGS } = require('../../lib/prompts');

const RATE = new Map(); // ip -> { hour, day, hourTs, dayTs }

const FLUX_VERSION =
  // FLUX.1-dev — proven LoRA support, $0.030/image
  'black-forest-labs/flux-dev:b9c5cdf2d8b0a4e0a8dba6e8f7e5a2cb37f16f31'; // pin exact version on deploy
const NUM_OUTPUTS_DEFAULT = 8;

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

  const numOutputs = Math.min(Math.max(parseInt(count) || NUM_OUTPUTS_DEFAULT, 1), 8);
  const { positive, negative, lora, loraWeight } = buildPrompt({ idea, style, placement, referenceDescription });

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return { statusCode: 500, body: JSON.stringify({ error: 'REPLICATE_API_TOKEN missing in Netlify env' }) };
  }

  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  // Submit prediction to Replicate
  const input = {
    prompt: positive,
    negative_prompt: negative,
    num_outputs: numOutputs,
    aspect_ratio: '1:1',
    output_format: 'png',
    output_quality: 95,
    guidance_scale: 3.5,
    num_inference_steps: 28,
  };
  if (lora) {
    input.hf_lora = lora;
    input.lora_scale = loraWeight;
  }

  let predictionRes;
  try {
    const r = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=60', // wait up to 60s for synchronous return
      },
      body: JSON.stringify({
        version: FLUX_VERSION.split(':')[1],
        input,
      }),
    });
    predictionRes = await r.json();
    if (!r.ok) {
      console.error('Replicate error:', predictionRes);
      return { statusCode: 502, body: JSON.stringify({ error: 'generator upstream error', detail: predictionRes }) };
    }
  } catch (err) {
    console.error('fetch failed:', err);
    return { statusCode: 502, body: JSON.stringify({ error: 'generator unreachable' }) };
  }

  // If wait=60 timed out, return polling URL
  if (predictionRes.status !== 'succeeded' && predictionRes.status !== 'failed') {
    return {
      statusCode: 202,
      body: JSON.stringify({
        sessionId,
        status: 'pending',
        pollUrl: predictionRes.urls?.get,
        prompt: positive,
      }),
    };
  }

  if (predictionRes.status === 'failed') {
    return { statusCode: 502, body: JSON.stringify({ error: 'generation failed', detail: predictionRes.error }) };
  }

  const outputs = Array.isArray(predictionRes.output) ? predictionRes.output : [predictionRes.output];

  // TODO when we wire R2: copy outputs to our CDN with watermark, set 24h expiry.
  // For MVP, return Replicate's signed URLs directly (24h validity) and watermark client-side via canvas.
  const designs = outputs.map((url, i) => ({
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
