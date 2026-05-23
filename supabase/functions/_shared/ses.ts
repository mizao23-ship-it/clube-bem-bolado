// ── AWS SES v2 sender (shared) ────────────────────────────────────────────────

const SES_REGION     = (Deno.env.get('SES_REGION')     ?? 'us-east-1').replace(/[^\x20-\x7E]/g, '').trim()
const SES_ACCESS_KEY = (Deno.env.get('SES_ACCESS_KEY') ?? '').replace(/[^\x20-\x7E]/g, '').trim()
const SES_SECRET_KEY = (Deno.env.get('SES_SECRET_KEY') ?? '').replace(/[^\x20-\x7E]/g, '').trim()
const SES_SENDER     = (Deno.env.get('SES_SENDER')     ?? '').replace(/[^\x20-\x7E]/g, '').trim()

function hex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hmac(key: ArrayBuffer | string, msg: string): Promise<ArrayBuffer> {
  const k = typeof key === 'string'
    ? await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    : await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg))
}

async function sha256(msg: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg)))
}

async function signRequest(body: string, date: string) {
  const endpoint = `https://email.${SES_REGION}.amazonaws.com/v2/email/outbound-emails`
  const host     = `email.${SES_REGION}.amazonaws.com`
  const dateOnly = date.slice(0, 8)
  const service  = 'ses'

  const payloadHash  = await sha256(body)
  const canonicalReq = [
    'POST',
    '/v2/email/outbound-emails',
    '',
    `content-type:application/json\nhost:${host}\nx-amz-date:${date}\n`,
    'content-type;host;x-amz-date',
    payloadHash,
  ].join('\n')

  const credScope = `${dateOnly}/${SES_REGION}/${service}/aws4_request`
  const strToSign = `AWS4-HMAC-SHA256\n${date}\n${credScope}\n${await sha256(canonicalReq)}`

  const kDate    = await hmac(`AWS4${SES_SECRET_KEY}`, dateOnly)
  const kRegion  = await hmac(kDate, SES_REGION)
  const kService = await hmac(kRegion, service)
  const kSigning = await hmac(kService, 'aws4_request')
  const sig      = hex(await hmac(kSigning, strToSign))

  const authHeader = `AWS4-HMAC-SHA256 Credential=${SES_ACCESS_KEY}/${credScope}, SignedHeaders=content-type;host;x-amz-date, Signature=${sig}`
  return { endpoint, authHeader }
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const now  = new Date()
  const date = now.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'

  const body = JSON.stringify({
    FromEmailAddress: SES_SENDER,
    Destination: { ToAddresses: [to] },
    Content: {
      Simple: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body:    { Html: { Data: html, Charset: 'UTF-8' } },
      },
    },
  })

  const { endpoint, authHeader } = await signRequest(body, date)

  const res = await fetch(endpoint, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'X-Amz-Date':    date,
      'Authorization': authHeader,
    },
    body,
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`SES error ${res.status}: ${txt}`)
  }
}
