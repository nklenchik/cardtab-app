/* The sign-in email: one button and a 6-digit code (the code is for the Home Screen app on iPhone, which can't
   receive a link opened in the browser). Plain, light, and readable in every mail app: tables and inline styles only. */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function signInEmail({ link, code, mode }) {
  const isNew = mode === 'up';
  const subject = isNew ? `Your Card Tab sign-up link (code ${code})` : `Your Card Tab sign-in link (code ${code})`;
  const btn = isNew ? 'Create my account' : 'Sign in to Card Tab';
  const lead = isNew ? 'Tap the button to create your Card Tab account.' : 'Tap the button to sign in to Card Tab.';
  const spaced = code.slice(0, 3) + ' ' + code.slice(3);
  const text = `${lead}\n\n${link}\n\nOr enter this code in the app: ${code}\n\nThe link and code work once, for 15 minutes.\nIf you didn't ask for this, you can ignore this email. Nobody can sign in without it.\n\nCard Tab · cardtab.app`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f6f5f0;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Your code is ${spaced}. It works for 15 minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f0"><tr><td align="center" style="padding:32px 16px">
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border:1px solid #e9e6de;border-radius:20px">
  <tr><td style="padding:28px 28px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
   <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="width:30px;height:30px;vertical-align:middle"><img src="https://app.cardtab.app/icon-192.png" width="30" height="30" alt="" style="display:block;border:0;border-radius:8px"></td>
    <td style="padding-left:10px;font-weight:800;font-size:17px;color:#1a1918">Card Tab</td></tr></table>
  </td></tr>
  <tr><td style="padding:14px 28px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1918">
   <h1 style="margin:0 0 8px;font-size:24px;line-height:1.2;font-weight:800;letter-spacing:-.02em">${isNew ? 'Welcome to Card Tab' : 'Sign in to Card Tab'}</h1>
   <p style="margin:0 0 22px;font-size:15px;line-height:1.5;color:#55524c">${lead}</p>
   <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="border-radius:999px;background:#a50e37">
    <a href="${esc(link)}" style="display:block;padding:15px 20px;font-size:16px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:999px">${btn}</a></td></tr></table>
   <p style="margin:26px 0 8px;font-size:13px;font-weight:700;color:#77736d;text-transform:uppercase;letter-spacing:.06em">Or enter this code</p>
   <div style="font-size:32px;font-weight:800;letter-spacing:.18em;color:#1a1918;background:#f6f5f0;border-radius:14px;padding:14px 0;text-align:center;font-variant-numeric:tabular-nums">${spaced}</div>
   <p style="margin:10px 0 0;font-size:13px;line-height:1.5;color:#77736d">Handy if you're using Card Tab from your Home Screen.</p>
  </td></tr>
  <tr><td style="padding:22px 28px 26px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#77736d">
   The link and code work once, for 15 minutes. If you didn't ask for this, you can ignore this email. Nobody can sign in without it.
  </td></tr>
 </table>
 <p style="margin:16px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#9a958e">Card Tab · <a href="https://cardtab.app" style="color:#9a958e">cardtab.app</a></p>
</td></tr></table></body></html>`;
  return { subject, html, text };
}

// Send through Cloudflare Email Service when its binding is set up (needs Workers Paid for any recipient), otherwise Resend.
export async function sendMail(env, { to, subject, html, text }) {
  const from = env.MAIL_FROM || 'login@cardtab.app';
  if (env.EMAIL && env.EMAIL.send) {
    await env.EMAIL.send({ to, from: { email: from, name: 'Card Tab' }, subject, html, text });
    return 'cloudflare';
  }
  if (env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ from: `Card Tab <${from}>`, to: [to], subject, html, text }) });
    if (!r.ok) throw Object.assign(new Error('resend ' + r.status + ' ' + (await r.text()).slice(0, 200)), { status: 502 });
    return 'resend';
  }
  throw Object.assign(new Error('no email sender set up'), { status: 503 });
}
