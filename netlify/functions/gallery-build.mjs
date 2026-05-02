/**
 * /api/gallery-build?id=<design-id>  (Netlify Functions v2 / ESM)
 *
 * Generates one curated example design via Replicate, stores PNG bytes in
 * Netlify Blobs, updates manifest. Idempotent.
 */

import { getStore } from "@netlify/blobs";

// dynamic CJS import (lib/prompts.js is CommonJS)
const { buildPrompt, GALLERY_DESIGNS } = await import("../../lib/prompts.js")
  .then(m => m.default || m);

const FLUX_MODEL = "black-forest-labs/flux-dev";
const STORE_NAME = "tattoo-gallery";

async function pollUntilDone(token, getUrl, maxMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const r = await fetch(getUrl, { headers: { Authorization: `Token ${token}` } });
    const j = await r.json();
    if (j.status === "succeeded") return j;
    if (j.status === "failed" || j.status === "canceled") {
      throw new Error(`generation ${j.status}: ${JSON.stringify(j.error || j)}`);
    }
    await new Promise(res => setTimeout(res, 2000));
  }
  throw new Error("generation timeout");
}

async function generateOne(token, prompt) {
  const create = await fetch(`https://api.replicate.com/v1/models/${FLUX_MODEL}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait=20",
    },
    body: JSON.stringify({
      input: {
        prompt,
        aspect_ratio: "1:1",
        num_outputs: 1,
        num_inference_steps: 28,
        guidance: 3.5,
        output_format: "png",
        output_quality: 95,
        go_fast: true,
      },
    }),
  });
  const j = await create.json();
  if (!create.ok) throw new Error(`replicate: ${JSON.stringify(j)}`);

  let result = j;
  if (j.status !== "succeeded" && j.status !== "failed") {
    result = await pollUntilDone(token, j.urls.get);
  }
  if (result.status !== "succeeded") {
    throw new Error(`generation ${result.status}: ${JSON.stringify(result.error || result)}`);
  }
  const url = Array.isArray(result.output) ? result.output[0] : result.output;
  if (!url) throw new Error("no output url");
  return url;
}

export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return new Response(JSON.stringify({ error: "id required" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const design = GALLERY_DESIGNS.find(d => d.id === id);
  if (!design) {
    return new Response(JSON.stringify({ error: `unknown design id: ${id}` }), {
      status: 404, headers: { "Content-Type": "application/json" },
    });
  }

  const token = Netlify.env.get("REPLICATE_API_TOKEN");
  if (!token) {
    return new Response(JSON.stringify({ error: "REPLICATE_API_TOKEN missing" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  const store = getStore(STORE_NAME);
  const blobKey = `${id}.png`;

  // Idempotency check
  const existingMeta = await store.getMetadata(blobKey).catch(() => null);
  if (existingMeta) {
    return new Response(JSON.stringify({
      id, status: "cached", label: design.label, style: design.style,
    }), { headers: { "Content-Type": "application/json" } });
  }

  // Generate
  const { positive } = buildPrompt({ idea: design.idea, style: design.style });

  let imageUrl;
  try {
    imageUrl = await generateOne(token, positive);
  } catch (err) {
    return new Response(JSON.stringify({ id, status: "error", error: err.message }), {
      status: 502, headers: { "Content-Type": "application/json" },
    });
  }

  // Download bytes
  let buffer;
  try {
    const png = await fetch(imageUrl);
    if (!png.ok) throw new Error(`image download ${png.status}`);
    buffer = Buffer.from(await png.arrayBuffer());
  } catch (err) {
    return new Response(JSON.stringify({ id, status: "error", error: "download: " + err.message }), {
      status: 502, headers: { "Content-Type": "application/json" },
    });
  }

  // Store in Blobs
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
  let manifest = [];
  try {
    const m = await store.get("manifest.json", { type: "json" });
    if (Array.isArray(m)) manifest = m;
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
  await store.setJSON("manifest.json", manifest);

  return new Response(JSON.stringify({
    id, status: "generated", label: design.label, style: design.style, bytes: buffer.length,
  }), { headers: { "Content-Type": "application/json" } });
};

export const config = { path: "/api/gallery-build" };
