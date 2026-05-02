/**
 * /api/gallery-image?id=<design-id>
 *
 * Reads PNG bytes from Netlify Blobs and serves them with proper image headers.
 * Public endpoint — anyone can view gallery images.
 */

const { getStore } = require('@netlify/blobs');

const STORE_NAME = 'tattoo-gallery';

exports.handler = async (event) => {
  const id = event.queryStringParameters?.id;
  if (!id) {
    return { statusCode: 400, body: 'id required' };
  }

  // Basic safety: only alphanumeric and dashes
  if (!/^[a-z0-9-]+$/i.test(id)) {
    return { statusCode: 400, body: 'invalid id' };
  }

  const store = getStore(STORE_NAME);
  const blobKey = `${id}.png`;

  let buffer;
  try {
    buffer = await store.get(blobKey, { type: 'arrayBuffer' });
  } catch (err) {
    return { statusCode: 500, body: 'storage error' };
  }
  if (!buffer) {
    return { statusCode: 404, body: 'not found' };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, s-maxage=604800',
    },
    body: Buffer.from(buffer).toString('base64'),
    isBase64Encoded: true,
  };
};
