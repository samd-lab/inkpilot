/**
 * /api/checkout — Stripe Checkout session creator
 *
 * Body: { sessionId: string, designs: [{id, url}], email?: string, priceId?: string }
 * Returns: { url } — the Stripe-hosted checkout URL.
 *
 * Env required:
 *   STRIPE_SECRET_KEY       — sk_live_... or sk_test_...
 *   STRIPE_PRICE_SINGLE     — price_... ($9 single pack of 8)
 *   STRIPE_PRICE_TRIPLE     — price_... ($19 triple pack)
 *   PUBLIC_BASE_URL         — https://tattoodesignr.com
 *
 * Design ownership flow:
 *   1) On checkout success, Stripe redirects to /unlock?session_id={CHECKOUT_SESSION_ID}
 *   2) /unlock fetches the checkout session, retrieves metadata.designs, and shows HD downloads.
 *   3) On webhook event 'checkout.session.completed', we mark the session paid in our DB (or KV).
 */

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const baseUrl  = process.env.PUBLIC_BASE_URL || 'https://tattoodesignr.com';
  const priceSingle = process.env.STRIPE_PRICE_SINGLE;
  const priceTriple = process.env.STRIPE_PRICE_TRIPLE;
  if (!stripeKey || !priceSingle) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Stripe env missing' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { sessionId, designs = [], email, packType = 'single' } = body;
  if (!sessionId || !Array.isArray(designs) || designs.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'sessionId + designs required' }) };
  }

  const price = packType === 'triple' ? priceTriple : priceSingle;
  if (!price) return { statusCode: 400, body: JSON.stringify({ error: `price not configured for pack: ${packType}` }) };

  // Build URL-encoded form for Stripe API
  const form = new URLSearchParams();
  form.append('mode', 'payment');
  form.append('success_url', `${baseUrl}/unlock.html?session_id={CHECKOUT_SESSION_ID}`);
  form.append('cancel_url',  `${baseUrl}/generate.html?canceled=1`);
  form.append('line_items[0][price]', price);
  form.append('line_items[0][quantity]', '1');
  form.append('payment_method_types[0]', 'card');
  form.append('automatic_tax[enabled]', 'true');
  form.append('billing_address_collection', 'auto');
  form.append('metadata[generation_session]', sessionId);
  form.append('metadata[design_count]', String(designs.length));
  form.append('metadata[pack_type]', packType);
  // Pack first 4 design IDs in metadata (Stripe meta is 50 keys × 500 chars)
  designs.slice(0, 8).forEach((d, i) => {
    form.append(`metadata[design_${i}_id]`, d.id || '');
    form.append(`metadata[design_${i}_url]`, (d.url || '').slice(0, 480));
  });
  if (email) form.append('customer_email', email);

  let res;
  try {
    res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: 'stripe unreachable' }) };
  }
  const session = await res.json();
  if (!res.ok) {
    return { statusCode: 502, body: JSON.stringify({ error: 'stripe error', detail: session }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ url: session.url, id: session.id }),
  };
};
