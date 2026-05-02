/**
 * /api/gallery-manifest  (Netlify Functions v2 / ESM)
 *
 * Returns the current gallery manifest from Netlify Blobs.
 */

import { getStore } from "@netlify/blobs";

const STORE_NAME = "tattoo-gallery";

export default async () => {
  const store = getStore(STORE_NAME);
  let manifest = [];
  try {
    const m = await store.get("manifest.json", { type: "json" });
    if (Array.isArray(m)) manifest = m;
  } catch {}

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
    },
  });
};

export const config = { path: "/api/gallery-manifest" };
