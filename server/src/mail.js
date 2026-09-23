/* One job: get a six-digit code from this machine into her inbox. Both providers take a POST
   with JSON and return a status, so no SMTP client — and no dependency — is needed. */
import { MAIL } from './config.js';
import { log } from './log.js';

const TIMEOUT_MS = 15000;

/* "Laxan <no-reply@example.com>" is what both APIs want split up. */
function sender(from) {
  const named = /^([^<]*?)\s*<([^>]+)>$/.exec(from);
  if (!named) return { email: from, name: 'Laxan' };
  return { email: named[2].trim(), name: (named[1].trim() || 'Laxan').replace(/^["']|["']$/g, '') };
}

const providerOf = () => MAIL.provider ?? (MAIL.key.startsWith('re_') ? 'resend' : 'brevo');

async function post(url, headers, payload, what) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...headers },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch((err) => {
    throw Object.assign(new Error(`${what} could not be reached: ${err.message}`), { code: 'email-unreachable' });
  });
  const text = await res.text();
  if (!res.ok) {
    log.warn(`mail: ${what} answered ${res.status} — ${text.slice(0, 160)}`);
    throw Object.assign(new Error(`${what} answered ${res.status}`), { code: 'email-refused' });
  }
  return text;
}

export const mailReady = () => Boolean(MAIL.key && MAIL.from);

export async function sendMail({ to, subject, html, text }) {
  if (!mailReady()) throw Object.assign(new Error('no email key is configured'), { code: 'email-off' });
  const from = sender(MAIL.from);
  const body = { subject, html, text: text ?? html.replace(/<[^>]+>/g, ' ') };
  if (providerOf() === 'resend') {
    await post(
      'https://api.resend.com/emails',
      { authorization: `Bearer ${MAIL.key}` },
      { ...body, from: MAIL.from, to: [to], headers: { 'X-Laxan': 'password-reset' } },
      'Resend'
    );
  } else {
    await post(
      'https://api.brevo.com/v3/smtp/email',
      { 'api-key': MAIL.key },
      { ...body, sender: from, to: [{ email: to }], htmlContent: body.html, textContent: body.text },
      'Brevo'
    );
  }
  return { to, provider: providerOf() };
}
