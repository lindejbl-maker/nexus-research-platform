// PayFast IPN Handler — Netlify Serverless Function
// Deploy path: netlify/functions/payfast-ipn.js
//
// SETUP:
// 1. Sign up at payfast.co.za and create a merchant account
// 2. Set Netlify env vars:
//    PAYFAST_MERCHANT_ID=your_merchant_id
//    PAYFAST_MERCHANT_KEY=your_merchant_key
//    PAYFAST_PASSPHRASE=your_passphrase (if set)
//    SUPABASE_URL=https://your-project.supabase.co
//    SUPABASE_SERVICE_ROLE_KEY=eyJ...
// 3. In PayFast merchant portal, set your IPN URL to:
//    https://your-site.netlify.app/.netlify/functions/payfast-ipn
//
// PayFast IPN docs: https://developers.payfast.co.za/docs#instant-payment-notification

const crypto = require('crypto');
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID;
const MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY;
const PASSPHRASE = process.env.PAYFAST_PASSPHRASE || '';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Parse x-www-form-urlencoded body
function parseForm(body) {
  return Object.fromEntries(new URLSearchParams(body));
}

// Generate PayFast signature
function generateSignature(data, passphrase = '') {
  let str = Object.keys(data)
    .filter(k => k !== 'signature' && data[k] !== '')
    .map(k => `${k}=${encodeURIComponent(data[k]).replace(/%20/g, '+')}`)
    .join('&');
  if (passphrase) str += `&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}`;
  return crypto.createHash('md5').update(str).digest('hex');
}

// Validate IPN with PayFast server
function validateWithPayFast(data) {
  return new Promise((resolve) => {
    const postData = new URLSearchParams(data).toString();
    const options = {
      hostname: 'www.payfast.co.za',
      port: 443,
      path: '/eng/query/validate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body.trim() === 'VALID'));
    });
    req.on('error', () => resolve(false));
    req.write(postData);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const data = parseForm(event.body);
  console.log('PayFast IPN received:', JSON.stringify(data));

  // Step 1: Verify merchant ID
  if (data.merchant_id !== MERCHANT_ID) {
    console.error('Invalid merchant ID');
    return { statusCode: 400, body: 'Invalid merchant' };
  }

  // Step 2: Verify signature (security check)
  const expectedSig = generateSignature(data, PASSPHRASE);
  if (data.signature !== expectedSig) {
    console.error('Signature mismatch. Expected:', expectedSig, 'Got:', data.signature);
    return { statusCode: 400, body: 'Signature invalid' };
  }

  // Step 3: Validate with PayFast server (prevents replay attacks)
  const isValid = await validateWithPayFast(data);
  if (!isValid) {
    console.error('PayFast server validation failed');
    return { statusCode: 400, body: 'Validation failed' };
  }

  // Step 4: Process based on payment status
  const { payment_status, email_address, item_name, m_payment_id } = data;

  if (payment_status === 'COMPLETE') {
    // Determine plan from item_name or custom integer fields
    let plan = 'researcher'; // default
    if (item_name?.toLowerCase().includes('department')) plan = 'department';

    const { error } = await supabase
      .from('profiles')
      .update({
        plan,
        payfast_payment_id: m_payment_id,
        plan_started_at: new Date().toISOString()
      })
      .eq('email', email_address);

    if (error) {
      console.error('Supabase update failed:', error);
      return { statusCode: 500, body: 'DB update failed' };
    }

    console.log(`✓ PayFast: upgraded ${email_address} to ${plan}`);
  } else if (payment_status === 'CANCELLED') {
    const { error } = await supabase
      .from('profiles')
      .update({ plan: 'free', plan_expires_at: new Date().toISOString() })
      .eq('email', email_address);

    if (error) console.error('Supabase downgrade error:', error);
    console.log(`✓ PayFast: downgraded ${email_address} to free`);
  }

  // PayFast expects a 200 OK with empty body to confirm IPN receipt
  return { statusCode: 200, body: '' };
};
