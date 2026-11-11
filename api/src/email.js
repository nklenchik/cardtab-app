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
export async function sendMail(env, { to, subject, html, text, replyTo }) {
  const from = env.MAIL_FROM || 'login@cardtab.app';
  if (env.EMAIL && env.EMAIL.send) {
    await env.EMAIL.send({ to, from: { email: from, name: 'Card Tab' }, subject, html, text, ...(replyTo ? { replyTo } : {}) });
    return 'cloudflare';
  }
  if (env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ from: `Card Tab <${from}>`, to: [to], subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) }) });
    if (!r.ok) throw Object.assign(new Error('resend ' + r.status + ' ' + (await r.text()).slice(0, 200)), { status: 502 });
    return 'resend';
  }
  throw Object.assign(new Error('no email sender set up'), { status: 503 });
}

// ---------- v50.72: welcome and payment emails (same card layout as the sign-in email) ----------
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
function shell({ title, preheader, body, foot, note }) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f6f5f0;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f0"><tr><td align="center" style="padding:32px 16px">
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border:1px solid #e9e6de;border-radius:20px">
  <tr><td style="padding:28px 28px 8px;font-family:${FONT}">
   <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="width:30px;height:30px;vertical-align:middle"><img src="https://app.cardtab.app/icon-192.png" width="30" height="30" alt="" style="display:block;border:0;border-radius:8px"></td>
    <td style="padding-left:10px;font-weight:800;font-size:17px;color:#1a1918">Card Tab</td></tr></table>
  </td></tr>
  <tr><td style="padding:14px 28px 0;font-family:${FONT};color:#1a1918">${body}</td></tr>
  <tr><td style="padding:22px 28px 26px;font-family:${FONT};font-size:13px;line-height:1.5;color:#77736d">${foot}</td></tr>
 </table>
 <p style="margin:16px 0 0;font-family:${FONT};font-size:12px;line-height:1.5;color:#9a958e">${note ? note + '<br>' : ''}Card Tab · <a href="https://cardtab.app" style="color:#9a958e">cardtab.app</a></p>
</td></tr></table></body></html>`;
}
const h1 = t => `<h1 style="margin:0 0 8px;font-size:24px;line-height:1.2;font-weight:800;letter-spacing:-.02em">${t}</h1>`;
const lead = t => `<p style="margin:0 0 22px;font-size:15px;line-height:1.5;color:#55524c">${t}</p>`;
const button = (href, label, top = 22) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:${top}px"><tr><td align="center" style="border-radius:999px;background:#a50e37">
    <a href="${esc(href)}" style="display:block;padding:15px 20px;font-size:16px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:999px">${esc(label)}</a></td></tr></table>`;
const tip = (n, title, text, last) => `<tr><td style="width:28px;vertical-align:top;padding:0 0 ${last ? 4 : 16}px"><div style="width:26px;height:26px;border-radius:13px;background:#f6e3e8;color:#a50e37;font-weight:800;font-size:13px;line-height:26px;text-align:center">${n}</div></td>
     <td style="padding:2px 0 ${last ? 4 : 16}px 12px;font-size:15px;line-height:1.45;color:#55524c"><b style="color:#1a1918">${title}</b> ${text}</td></tr>`;

// What the Premium box says changes with the dates: before Premium opens, during the founders window, after it
const FOUNDERS_JOIN_BEFORE = Date.parse('2027-01-01T00:00:00-05:00'), FOUNDERS_UPGRADE_BY = Date.parse('2027-02-01T00:00:00-05:00');
export function premiumLine({ open, opens, joinedAt, t = Date.now() }) {
  const perks = 'Premium adds unlimited entries, spreadsheet import, every Stories theme and your full history.';
  const founder = joinedAt * 1000 < FOUNDERS_JOIN_BEFORE && t < FOUNDERS_UPGRADE_BY;
  if (founder && !open) return { html: `<b style="color:#a50e37">Want more?</b> ${perks} You joined early, so you'll get founders pricing ($4 a month or $40 a year) if you upgrade by Jan 31. Premium opens ${esc(opens || 'soon')}.`,
    text: `Want more? ${perks} You joined early, so you'll get founders pricing ($4 a month or $40 a year) if you upgrade by Jan 31. Premium opens ${opens || 'soon'}.` };
  if (founder) return { html: `<b style="color:#a50e37">Want more?</b> ${perks} You joined early, so you can lock in founders pricing ($4 a month or $40 a year) if you upgrade by Jan 31.`,
    text: `Want more? ${perks} You joined early, so you can lock in founders pricing ($4 a month or $40 a year) if you upgrade by Jan 31.` };
  return { html: `<b style="color:#a50e37">Want more?</b> ${perks} $6 a month or $60 a year.`, text: `Want more? ${perks} $6 a month or $60 a year.` };
}

export function welcomeEmail({ name, appUrl, open, opens, joinedAt, t }) {
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  const subject = 'Welcome to Card Tab';
  const pl = premiumLine({ open, opens, joinedAt, t });
  const body = h1('Welcome to Card Tab' + (first ? ', ' + esc(first) : '')) +
    lead('Card Tab keeps track of the cards you buy and sell, and does the math for you. Here\'s how to get started.') +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">` +
    tip(1, 'Add your first card.', 'Tap <b style="color:#1a1918">+</b>, type the card\'s name, pick it from the list and enter the price. The art fills in on its own.') +
    tip(2, 'See your numbers on the Board.', 'Profit, spending, fees and your biggest win, all in one place.') +
    tip(3, 'Put Card Tab on your Home Screen.', 'It opens full screen, like an app. On iPhone, tap Share, then Add to Home Screen.', true) + `</table>` +
    button(appUrl + '/', 'Open Card Tab') +
    `<div style="margin:22px 0 0;padding:14px 16px;background:#f9f0f2;border-radius:14px;font-size:13.5px;line-height:1.5;color:#55524c">${pl.html}</div>`;
  const html = shell({ title: subject, preheader: 'Three quick ways to get started.', body, foot: 'Questions or ideas? Just reply to this email. It comes straight to us.',
    note: 'You\'re getting this because you created a Card Tab account. It\'s the only welcome email we send.' });
  const text = `Welcome to Card Tab${first ? ', ' + first : ''}\n\nCard Tab keeps track of the cards you buy and sell, and does the math for you. Here's how to get started.\n\n` +
    `1. Add your first card. Tap +, type the card's name, pick it from the list and enter the price. The art fills in on its own.\n` +
    `2. See your numbers on the Board. Profit, spending, fees and your biggest win, all in one place.\n` +
    `3. Put Card Tab on your Home Screen. It opens full screen, like an app. On iPhone, tap Share, then Add to Home Screen.\n\n` +
    `Open Card Tab: ${appUrl}/\n\n${pl.text}\n\nQuestions or ideas? Just reply to this email.\n\nCard Tab · cardtab.app`;
  return { subject, html, text };
}

// A renewal didn't go through: the first email when it happens, one reminder near the end of the 7 days
const day = s => new Date(s * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/New_York' });
export function paymentEmail({ kind, graceUntil, appUrl, card, amount, interval }) {
  const link = appUrl + '/?billing=fix', when = day(graceUntil), reminder = kind === 'reminder';
  const subject = reminder ? 'Your Card Tab Premium ends ' + when : 'Your Card Tab payment didn\'t go through';
  const title = reminder ? 'Premium ends ' + esc(when) : 'Your payment didn\'t go through';
  const intro = reminder ? 'We still couldn\'t charge your card for Card Tab Premium.' : 'We couldn\'t charge your card for your Card Tab Premium renewal.';
  const dollars = amount % 100 ? (amount / 100).toFixed(2) : String(amount / 100);
  const price = amount ? '$' + dollars + (interval === 'year' ? '/year' : interval === 'month' ? '/month' : '') : '';
  // v50.73: the card on its own line, in a small receipt-style box, so it's clear which card to fix
  const row = (k, v, last) => `<tr><td style="padding:${last ? '10px 0 0' : '0 0 10px'};font-size:13px;color:#77736d;${last ? 'border-top:1px dashed #e2ded5;' : ''}">${k}</td><td align="right" style="padding:${last ? '10px 0 0' : '0 0 10px'};font-size:15px;font-weight:800;color:#1a1918;${last ? 'border-top:1px dashed #e2ded5;' : ''}">${v}</td></tr>`;
  const box = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:#f6f5f0;border-radius:14px"><tr><td style="padding:14px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${row('Card', esc(card || 'Your saved card'), !price)}${price ? row('Premium', esc(price), true) : ''}</table></td></tr></table>`;
  const p = (t, last) => `<p style="margin:0 0 ${last ? 22 : 14}px;font-size:15px;line-height:1.5;color:#55524c">${t}</p>`;
  const body = h1(title) + p(intro) + box +
    p(`<b style="color:#1a1918">Update your card by ${esc(when)}</b> to keep Premium.`) +
    p(reminder ? 'After that, your account goes back to Free. Your entries stay just as they are.' : 'It happens: a card expires or a bank says no. We\'ll try the card again in the meantime.', true) +
    button(link, 'Update my card', 0);
  const html = shell({ title: subject, preheader: 'Update your card by ' + when + ' to keep Premium.', body,
    foot: 'Already fixed it? Then you can ignore this email.<br>Questions? Just reply.' });
  const text = `${reminder ? 'Premium ends ' + when : 'Your payment didn\'t go through'}\n\n${intro}\n\nCard: ${card || 'your saved card'}${price ? '\nPremium: ' + price : ''}\n\n` +
    `Update your card by ${when} to keep Premium.\n${reminder ? 'After that, your account goes back to Free. Your entries stay just as they are.' : 'It happens: a card expires or a bank says no. We\'ll try the card again in the meantime.'}\n\n` +
    `Update your card: ${link}\n\nAlready fixed it? Then you can ignore this email.\n\nCard Tab · cardtab.app`;
  return { subject, html, text };
}

// v52.11: an admin gave Premium as a gift (sent once, when the gift starts)
export function giftEmail({ name, until, appUrl }) {
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  const subject = 'You’ve been given Card Tab Premium';
  const when = until ? new Date(until * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }) : '';
  const intro = until ? 'A gift from Card Tab: Premium is yours until ' + when + '. There’s nothing to pay, and it won’t renew.' : 'A gift from Card Tab: Premium is yours, with no end date. There’s nothing to pay.';
  const body = h1('You’ve been given Premium' + (first ? ', ' + esc(first) : '')) + lead(esc(intro)) +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">` +
    tip(1, 'No monthly limit.', 'Add every card you buy and sell.') +
    tip(2, 'Your whole history.', 'Totals and the Board for any date range, all the way back.') +
    tip(3, 'Every Stories theme and video.', 'Share your month, your year, or your best flips.', true) + `</table>` +
    button(appUrl + '/', 'Open Card Tab');
  const html = shell({ title: subject, preheader: until ? 'Premium until ' + when + ', on us.' : 'Premium, on us.', body,
    foot: (until ? 'When the gift ends you’ll go back to Free, and everything you added stays.<br>' : '') + 'Questions? Just reply to this email.' });
  const text = `You’ve been given Premium${first ? ', ' + first : ''}\n\n${intro}\n\n1. No monthly limit. Add every card you buy and sell.\n2. Your whole history. Totals and the Board for any date range, all the way back.\n3. Every Stories theme and video. Share your month, your year, or your best flips.\n\nOpen Card Tab: ${appUrl}/\n\n` +
    (until ? 'When the gift ends you’ll go back to Free, and everything you added stays.\n' : '') + 'Questions? Just reply to this email.\n\nCard Tab · cardtab.app';
  return { subject, html, text };
}

