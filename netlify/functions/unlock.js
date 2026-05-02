/**
 * /api/unlock — fetch paid Stripe session and return HD design URLs.
 *
 * Query: ?session_id=cs_...
 * Returns: { paid: bool, designs: [{ id, url }], packType }
 */

exports.handler = async (event) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return { statusCode: 500, body: JSON.stringify({ error: 'Stripe env missing' }) };

  const sid = event.queryStringParameters?.session_id;
  if (!sid) return { statusCode: 400, body: JSON.stringify({ error: 'session_id required' }) };

  let res;
  try {
    res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sid)}`, {
      headers: { 'Authorization': `Bearer ${stripeKey}` },
    });
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: 'stripe unreachable' }) };
  }
  const sess = await res.json();
  if (!res.ok) return { statusCode: 502, body: JSON.stringify({ error: 'stripe error', detail: sess }) };

  const paid = sess.payment_status === 'paid';
  if (!paid) return { statusCode: 200, body: JSON.stringify({ paid: false }) };

  const meta = sess.metadata || {};
  const packType = meta.pack_type || 'single';
  const count = parseInt(meta.design_count || '0', 10);
  const designs = [];
  for (let i = 0; i < count; i++) {
    const id = meta[`design_${i}_id`];
    const url = meta[`design_${i}_url`];
    if (id && url) designs.push({ id, url });
  }
  return {
    statusCode: 200,
    body: JSON.stringify({ paid, designs, packType, customerEmail: sess.customer_details?.email || null }),
  };
};
