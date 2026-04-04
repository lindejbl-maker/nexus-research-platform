// Stripe Webhook Handler — Netlify Serverless Function
// Deploy path: netlify/functions/stripe-webhook.js
//
// SETUP INSTRUCTIONS:
// 1. npm install stripe --save in project root
// 2. Add to Netlify env vars:
//    STRIPE_SECRET_KEY=sk_live_...
//    STRIPE_WEBHOOK_SECRET=whsec_...
//    SUPABASE_URL=https://your-project.supabase.co
//    SUPABASE_SERVICE_ROLE_KEY=eyJ...
// 3. In Stripe Dashboard > Webhooks, add endpoint:
//    https://your-site.netlify.app/.netlify/functions/stripe-webhook
//    Listen for: checkout.session.completed, customer.subscription.deleted, customer.subscription.updated

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Must use service role key to bypass RLS
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  // Verify the webhook signature so we know it's genuinely from Stripe
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // Handle each event type
  try {
    switch (stripeEvent.type) {

      // ── User completes checkout → upgrade them to paid plan ──────────────
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        const customerEmail = session.customer_details?.email || session.customer_email;
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        if (!customerEmail) break;

        // Update user in Supabase
        const { error } = await supabase
          .from('profiles')
          .update({
            plan: 'researcher',
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            plan_started_at: new Date().toISOString(),
            plan_expires_at: null // Active subscription, no expiry
          })
          .eq('email', customerEmail);

        if (error) {
          console.error('Supabase update error (checkout.completed):', error);
          return { statusCode: 500, body: 'DB update failed' };
        }

        console.log(`✓ Upgraded ${customerEmail} to Researcher plan`);
        break;
      }

      // ── Subscription cancelled → downgrade back to free ────────────────
      case 'customer.subscription.deleted': {
        const subscription = stripeEvent.data.object;
        const customerId = subscription.customer;

        // Look up the customer email from Stripe
        const customer = await stripe.customers.retrieve(customerId);
        const customerEmail = customer.email;

        if (!customerEmail) break;

        const { error } = await supabase
          .from('profiles')
          .update({
            plan: 'free',
            stripe_subscription_id: null,
            plan_expires_at: new Date().toISOString()
          })
          .eq('email', customerEmail);

        if (error) {
          console.error('Supabase update error (subscription.deleted):', error);
          return { statusCode: 500, body: 'DB update failed' };
        }

        console.log(`✓ Downgraded ${customerEmail} to Free plan`);
        break;
      }

      // ── Subscription updated (e.g. plan change) ─────────────────────────
      case 'customer.subscription.updated': {
        const subscription = stripeEvent.data.object;
        const customerId = subscription.customer;
        const status = subscription.status; // active, past_due, canceled, etc.

        const customer = await stripe.customers.retrieve(customerId);
        const customerEmail = customer.email;

        if (!customerEmail) break;

        const plan = status === 'active' ? 'researcher' : 'free';

        const { error } = await supabase
          .from('profiles')
          .update({ plan })
          .eq('email', customerEmail);

        if (error) {
          console.error('Supabase update error (subscription.updated):', error);
        }

        console.log(`✓ Updated ${customerEmail} plan to ${plan} (status: ${status})`);
        break;
      }

      // ── Payment failed ───────────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = stripeEvent.data.object;
        const customerEmail = invoice.customer_email;
        console.warn(`⚠ Payment failed for ${customerEmail}`);
        // Optionally: notify user via email (send-email function)
        break;
      }

      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    return { statusCode: 500, body: 'Internal handler error' };
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
