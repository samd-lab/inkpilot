/**
 * /api/gallery-image?id=<design-id>  (Netlify Functions v2 / ESM)
 *
 * Streams a PNG from Netlify Blobs.
 */

import { getStore } from "@netlify/blobs";

const STORE_NAME = "tattoo-gallery";

export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return new Response("id required", { status: 400 });
  if (!/^[a-z0-9-]+$/i.test(id)) return new Response("invalid id", { status: 400 });

  const store = getStore(STORE_NAME);

  let buffer;
  try {
    buffer = await store.get(`${id}.png`, { type: "arrayBuffer" });
  } catch {
    return new Response("storage error", { status: 500 });
  }
  if (!buffer) return new Response("not found", { status: 404 });

  return new Response(buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
    },
  });
};

export const config = { path: "/api/gallery-image" };
