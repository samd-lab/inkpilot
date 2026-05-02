/**
 * /api/gallery-manifest
 *
 * Returns the current manifest of populated gallery designs from Netlify Blobs.
 * Public endpoint — examples.html consumes this on page load.
 */

const { getStore } = require('@netlify/blobs');

const STORE_NAME = 'tattoo-gallery';

exports.handler = async () => {
  const store = getStore(STORE_NAME);
  let manifest = [];
  try {
    const m = await store.get('manifest.json', { type: 'json' });
    if (Array.isArray(m)) manifest = m;
  } catch {}

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
    body: JSON.stringify(manifest),
  };
};
