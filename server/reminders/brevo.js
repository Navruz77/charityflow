// Sends one reminder email through Brevo's transactional email API (B.7).
// The key and the verified sender address come only from environment
// variables (Render). Never logs the key, the address or the message.
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'
const TIMEOUT_MS = 8000

export const brevoMailer = {
  async send({ to, subject, text }) {
    const key = process.env.BREVO_API_KEY
    const sender = process.env.BREVO_SENDER_EMAIL
    if (!key || !sender) {
      console.error('BREVO_API_KEY or BREVO_SENDER_EMAIL is not set; email reminder not sent')
      return { ok: false, status: 0 }
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(BREVO_URL, {
        method: 'POST',
        headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          sender: { name: 'CharityFlow', email: sender },
          to: [{ email: to }],
          subject,
          textContent: text,
        }),
        signal: controller.signal,
      })
      if (!res.ok) console.error(`Brevo refused a reminder email: ${res.status}`)
      return { ok: res.ok, status: res.status }
    } catch (err) {
      console.error('Brevo request failed:', err.name)
      return { ok: false, status: 0 }
    } finally {
      clearTimeout(timer)
    }
  },
}
