/**
 * /api/checkout — Stripe Checkout session creator
 *
 * Body: { sessionId, designs?, email?, packType: 'single'|'triple'|'studio' }
 *
 *   single  -> $9 one-time   (env: STRIPE_PRICE_SINGLE)
 *   triple  -> $19 one-time  (env: STRIPE_PRICE_TRIPLE)
 *   studio  -> $14.99/mo     (env: STRIPE_PRICE_STUDIO)  ← NEW recurring tier
 *
 * Subscription pricing flips Stripe to mode='subscription' instead of 'payment'.
 * Returns { url } — the Stripe-hosted checkout URL.
 *
 * Env required:
 *   STRIPE_SECRET_KEY       — sk_live_... or sk_test_...
 *   STRIPE_PRICE_SINGLE     — price_... ($9 single pack of 8)
 *   STRIPE_PRICE_TRIPLE     — price_... ($19 triple pack)
 *   STRIPE_PRICE_STUDIO     — price_... ($14.99/mo unlimited)
 *   PUBLIC_BASE_URL         — https://tattoodesignr.com
 */

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const baseUrl  = process.env.PUBLIC_BASE_URL || 'https://tattoodesignr.com';
  const priceMap = {
    flash:  process.env.STRIPE_PRICE_FLASH,    // NEW: $5 pre-made gallery design
    single: process.env.STRIPE_PRICE_SINGLE,   // $9 generate 8
    triple: process.env.STRIPE_PRICE_TRIPLE,   // $19 generate 24
    studio: process.env.STRIPE_PRICE_STUDIO,   // $14.99/mo unlimited
  };
  if (!stripeKey || !priceMap.single) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Stripe env missing (STRIPE_SECRET_KEY or STRIPE_PRICE_SINGLE)' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { sessionId, designs = [], email, packType = 'single' } = body;
  const price = priceMap[packType];
  if (!price) {
    return { statusCode: 400, body: JSON.stringify({ error: `price not configured for pack: ${packType}` }) };
  }

  // Subscriptions use mode='subscription', one-time uses mode='payment'.
  const isSubscription = packType === 'studio';
  const mode = isSubscription ? 'subscription' : 'payment';

  const form = new URLSearchParams();
  form.append('mode', mode);
  form.append('success_url', `${baseUrl}/unlock.html?session_id={CHECKOUT_SESSION_ID}`);
  form.append('cancel_url',  `${baseUrl}/generate.html?canceled=1`);
  form.append('line_items[0][price]', price);
  form.append('line_items[0][quantity]', '1');
  form.append('payment_method_types[0]', 'card');
  // Subscription mode does NOT support automatic_tax with non-tax-registered accounts -> leave off
  if (!isSubscription) {
    form.append('automatic_tax[enabled]', 'true');
  }
  form.append('billing_address_collection', 'auto');
  form.append('metadata[generation_session]', sessionId || '');
  form.append('metadata[design_count]', String(designs.length));
  form.append('metadata[pack_type]', packType);
  // For subscriptions, Stripe puts metadata on the Subscription object too via subscription_data.metadata
  if (isSubscription) {
    form.append('subscription_data[metadata][generation_session]', sessionId || '');
    form.append('subscription_data[metadata][pack_type]', packType);
  }
  // Stash design IDs in metadata for one-time packs (subscription unlock pulls fresh designs)
  if (!isSubscription) {
    designs.slice(0, 8).forEach((d, i) => {
      form.append(`metadata[design_${i}_id]`, d.id || '');
      form.append(`metadata[design_${i}_url]`, (d.url || '').slice(0, 480));
    });
  }
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
    return { statusCode: 502, body: JSON.stringify({ error: 'strip