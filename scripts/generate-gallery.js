#!/usr/bin/env node
/**
 * scripts/generate-gallery.js
 *
 * Generate the 40-design example gallery using Replicate FLUX.1-dev.
 *
 * USAGE (from repo root):
 *   1) Get a Replicate API token: https://replicate.com/account/api-tokens
 *   2) Run:    REPLICATE_API_TOKEN=r8_xxx node scripts/generate-gallery.js
 *   3) Watch:  images appear under images/examples/<id>.png
 *   4) The script also writes images/examples/manifest.json which examples.html reads.
 *
 * Cost: 40 designs × ~$0.030 each = ~$1.20 total.  One-time spend.
 *
 * Resumable: skips files that already exist. Re-run safely.
 *
 * Concurrency: 3 parallel requests to stay under Replicate rate limits.
 */

const fs = require('fs');
const path = require('path');
const { buildPrompt, GALLERY_DESIGNS, STYLE_CONFIGS } = require('../lib/prompts');

const TOKEN = process.env.REPLICATE_API_TOKEN;
if (!TOKEN) {
  console.error('FATAL: set REPLICATE_API_TOKEN env var.');
  console.error('  Get one at: https://replicate.com/account/api-tokens');
  console.error('  Then run:   REPLICATE_API_TOKEN=r8_xxx node scripts/generate-gallery.js');
  process.exit(1);
}

const OUT_DIR = path.join(__dirname, '..', 'images', 'examples');
fs.mkdirSync(OUT_DIR, { recursive: true });

const FLUX_DEV = 'black-forest-labs/flux-dev';
const CONCURRENCY = 3;

async function pollUntilDone(getUrl, maxMs = 240_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const r = await fetch(getUrl, { headers: { 'Authorization': `Token ${TOKEN}` } });
    const j = await r.json();
    if (j.status === 'succeeded') return j;
    if (j.status === 'failed' || j.status === 'canceled') throw new Error(`generation ${j.status}: ${JSON.stringify(j.error)}`);
    await new Promise(res => setTimeout(res, 2500));
  }
  throw new Error('generation timeout');
}

async function generateOne(design) {
  const outFile = path.join(OUT_DIR, `${design.id}.png`);
  if (fs.existsSync(outFile)) {
    console.log(`  [skip] ${design.id} (already exists)`);
    return { ...design, file: `images/examples/${design.id}.png` };
  }

  const { positive, negative, lora, loraWeight } = buildPrompt({ idea: design.idea, style: design.style });

  const input = {
    prompt: positive,
    negative_prompt: negative,
    aspect_ratio: '1:1',
    num_outputs: 1,
    output_format: 'png',
    output_quality: 95,
    guidance_scale: 3.5,
    num_inference_steps: 28,
  };
  if (lora) {
    input.hf_lora = lora;
    input.lora_scale = loraWeight;
  }

  console.log(`  [gen]  ${design.id} — ${design.label} (${design.style})`);
  const create = await fetch(`https://api.replicate.com/v1/models/${FLUX_DEV}/predictions`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input }),
  });
  const created = await create.json();
  if (!create.ok) throw new Error(`replicate create: ${JSON.stringify(created)}`);

  const finished = await pollUntilDone(created.urls.get);
  const url = Array.isArray(finished.output) ? finished.output[0] : finished.output;
  if (!url) throw new Error(`no output url for ${design.id}`);

  const png = await fetch(url);
  if (!png.ok) throw new Error(`download failed: ${png.status}`);
  const buf = Buffer.from(await png.arrayBuffer());
  fs.writeFileSync(outFile, buf);
  console.log(`  [done] ${design.id} — ${(buf.length / 1024).toFixed(0)} KB`);

  return { ...design, file: `images/examples/${design.id}.png` };
}

async function runPool(items, worker, n) {
  const results = new Array(items.length);
  let cursor = 0;
  async function lane() {
    while (cursor < items.length) {
      const i = cursor++;
      try { results[i] = await worker(items[i]); }
      catch (err) {
        console.error(`  [fail] ${items[i].id}:`, err.message);
        results[i] = { ...items[i], error: err.message };
      }
    }
  }
  await Promise.all(Array.from({ length: n }, lane));
  return results;
}

(async () => {
  console.log(`Generating ${GALLERY_DESIGNS.length} tattoo designs to ${OUT_DIR}`);
  console.log(`Concurrency: ${CONCURRENCY}, est cost: $${(GALLERY_DESIGNS.length * 0.030).toFixed(2)}`);
  console.log('---');

  const start = Date.now();
  const results = await runPool(GALLERY_DESIGNS, generateOne, CONCURRENCY);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  // Write manifest for examples.html consumption
  const manifest = results.map(r => ({
    id: r.id,
    style: r.style,
    label: r.label,
    file: r.file || null,
    error: r.error || null,
  }));
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`---`);
  console.log(`Done in ${elapsed}s. Manifest: ${path.relative(process.cwd(), path.join(OUT_DIR, 'manifest.json'))}`);
  const ok = manifest.filter(m => m.file && !m.error).length;
  console.log(`Success: ${ok}/${manifest.length}`);
  if (ok < manifest.length) {
    console.log('Some failed — re-run the script to retry only the missing ones.');
  }
})();
