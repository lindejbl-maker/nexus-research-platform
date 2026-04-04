// Email Sender — Netlify Serverless Function
// Deploy path: netlify/functions/send-email.js
//
// SETUP:
// 1. Sign up at resend.com — free tier: 3,000 emails/month
// 2. Add your domain and get an API key
// 3. Set Netlify env var: RESEND_API_KEY=re_...
// 4. Update FROM_EMAIL and OWNER_EMAIL below

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'Nexus <noreply@nexus.ai>';  // ← change to your verified Resend domain
const OWNER_EMAIL = 'hello@nexus.ai';             // ← your email for contact form notifications

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { type, ...payload } = data;
  let emailPayload;

  switch (type) {

    // ── Welcome email (send on signup) ──────────────────────────────────
    case 'welcome': {
      emailPayload = {
        from: FROM_EMAIL,
        to: [payload.email],
        subject: 'Welcome to Nexus — your research co-pilot is ready',
        html: `
          <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#010C1E;color:#E1E7F5;padding:40px;border-radius:16px;">
            <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;margin-bottom:32px;letter-spacing:0.05em;">
              NEX<span style="color:#4F8CEA">US</span>
            </div>
            <h1 style="font-size:28px;margin-bottom:12px;font-weight:700;">Welcome, ${payload.name || 'Researcher'}.</h1>
            <p style="color:#8898B8;line-height:1.75;margin-bottom:24px;">Your free account is ready. You have 5 paper searches and 2 hypothesis generations to start with. Here's what to do first:</p>
            <div style="background:#05111F;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:24px;margin-bottom:28px;">
              <div style="margin-bottom:16px;"><strong style="color:#4F8CEA">1. Search a topic</strong><br><span style="color:#8898B8;font-size:13px;">Type any research area into Paper Search — 200M+ papers indexed</span></div>
              <div style="margin-bottom:16px;"><strong style="color:#4F8CEA">2. Generate a hypothesis</strong><br><span style="color:#8898B8;font-size:13px;">The Hypothesis Generator will find gaps in the literature nobody has explored</span></div>
              <div><strong style="color:#4F8CEA">3. Save papers to your library</strong><br><span style="color:#8898B8;font-size:13px;">Build your reference library and run paper comparisons across any set</span></div>
            </div>
            <a href="https://nexus.ai/pages/dashboard.html" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#4F8CEA,#6366F1);color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">Open your dashboard →</a>
            <p style="color:#4A5870;font-size:12px;margin-top:32px;">You received this because you signed up at nexus.ai · <a href="https://nexus.ai/pages/privacy.html" style="color:#4A5870;">Privacy Policy</a></p>
          </div>`
      };
      break;
    }

    // ── Payment confirmation ─────────────────────────────────────────────
    case 'payment_confirmation': {
      emailPayload = {
        from: FROM_EMAIL,
        to: [payload.email],
        subject: 'Your Nexus Researcher plan is active',
        html: `
          <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#010C1E;color:#E1E7F5;padding:40px;border-radius:16px;">
            <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;margin-bottom:32px;letter-spacing:0.05em;">
              NEX<span style="color:#4F8CEA">US</span>
            </div>
            <div style="background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.2);border-radius:10px;padding:16px;margin-bottom:28px;display:flex;align-items:center;gap:12px;">
              <span style="color:#34D399;font-size:20px;">✓</span>
              <span style="color:#34D399;font-weight:600;">Payment confirmed — Researcher plan active</span>
            </div>
            <h1 style="font-size:26px;margin-bottom:12px;">You're fully unlocked.</h1>
            <p style="color:#8898B8;line-height:1.75;margin-bottom:24px;">Thanks for upgrading. Your Researcher plan gives you unlimited access to all AI features.</p>
            <div style="background:#05111F;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:24px;margin-bottom:28px;">
              <div style="font-size:11px;font-weight:700;color:#4A5870;letter-spacing:0.1em;margin-bottom:12px;">RECEIPT</div>
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;"><span style="color:#8898B8">Plan</span><span>Researcher</span></div>
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;"><span style="color:#8898B8">Amount</span><span>$29.00/month</span></div>
              <div style="display:flex;justify-content:space-between;font-size:13px;"><span style="color:#8898B8">Billing</span><span>Monthly, cancel anytime</span></div>
            </div>
            <a href="https://nexus.ai/pages/dashboard.html" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#4F8CEA,#6366F1);color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">Go to dashboard →</a>
            <p style="color:#4A5870;font-size:12px;margin-top:32px;">Questions? Reply to this email or visit <a href="https://nexus.ai/pages/contact.html" style="color:#4A5870;">nexus.ai/contact</a></p>
          </div>`
      };
      break;
    }

    // ── Usage warning (80% of free limit) ───────────────────────────────
    case 'usage_warning': {
      emailPayload = {
        from: FROM_EMAIL,
        to: [payload.email],
        subject: "You've used 80% of your Nexus free plan",
        html: `
          <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#010C1E;color:#E1E7F5;padding:40px;border-radius:16px;">
            <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;margin-bottom:32px;">
              NEX<span style="color:#4F8CEA">US</span>
            </div>
            <h1 style="font-size:24px;margin-bottom:12px;">Running low on free searches.</h1>
            <p style="color:#8898B8;line-height:1.75;margin-bottom:24px;">You've used <strong style="color:#F59E0B">${payload.used}/${payload.limit}</strong> of your free ${payload.feature || 'searches'} this month. Upgrade now to keep researching without interruption.</p>
            <a href="https://nexus.ai/pages/pricing.html" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#4F8CEA,#6366F1);color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">Upgrade to Researcher — $29/mo →</a>
            <p style="color:#4A5870;font-size:12px;margin-top:32px;"><a href="#" style="color:#4A5870;">Unsubscribe from usage alerts</a></p>
          </div>`
      };
      break;
    }

    // ── Contact form (notify you when someone fills the form) ────────────
    case 'contact': {
      const subjectLabels = {
        'department-plan': 'Department Plan ($199/mo)',
        'enterprise-plan': 'Enterprise Plan ($999/mo)',
        'south-africa': 'SA University Pricing',
        'billing': 'Billing & Account',
        'support': 'Technical Support',
        'partnership': 'Partnership / API',
        'press': 'Press & Media',
        'feedback': 'Feedback',
        'other': 'Other'
      };
      emailPayload = {
        from: FROM_EMAIL,
        to: [OWNER_EMAIL],
        reply_to: payload.email,
        subject: `[Nexus Contact] ${subjectLabels[payload.subject] || payload.subject} — ${payload.firstname} ${payload.lastname}`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#010C1E;color:#E1E7F5;border-radius:16px;">
            <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;margin-bottom:24px;">NEX<span style="color:#4F8CEA">US</span> — NEW CONTACT</div>
            <table style="width:100%;font-size:13px;border-collapse:collapse;">
              <tr><td style="color:#8898B8;padding:7px 0;width:120px;">Name</td><td><strong>${payload.firstname} ${payload.lastname}</strong></td></tr>
              <tr><td style="color:#8898B8;padding:7px 0;">Email</td><td><a href="mailto:${payload.email}" style="color:#4F8CEA;">${payload.email}</a></td></tr>
              <tr><td style="color:#8898B8;padding:7px 0;">Institution</td><td>${payload.institution || '—'}</td></tr>
              <tr><td style="color:#8898B8;padding:7px 0;">Subject</td><td><strong style="color:#F59E0B">${subjectLabels[payload.subject] || payload.subject}</strong></td></tr>
            </table>
            <div style="background:#05111F;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:20px;margin-top:20px;">
              <div style="font-size:11px;color:#4A5870;margin-bottom:10px;letter-spacing:0.08em;font-weight:700;">MESSAGE</div>
              <p style="color:#8898B8;font-size:13px;line-height:1.75;white-space:pre-wrap;">${payload.message}</p>
            </div>
            <p style="color:#4A5870;font-size:11px;margin-top:20px;">Reply directly to this email to respond to ${payload.firstname}.</p>
          </div>`
      };
      break;
    }

    default:
      return { statusCode: 400, body: 'Unknown email type' };
  }

  // Send with Resend
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('Resend error:', body);
      return { statusCode: 500, body: `Email failed: ${body}` };
    }

    const result = await res.json();
    console.log('Email sent:', result.id);
    return { statusCode: 200, body: JSON.stringify({ success: true, id: result.id }) };

  } catch (err) {
    console.error('Send-email error:', err);
    return { statusCode: 500, body: 'Email send failed' };
  }
};
