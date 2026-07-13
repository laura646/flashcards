import { lookup } from 'node:dns/promises'
import net from 'node:net'

// True if an IP literal falls in a private / loopback / link-local / reserved
// range that must never be reachable from a user-supplied server-side fetch.
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true // link-local + cloud metadata (169.254.169.254)
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
    if (a >= 224) return true // multicast + reserved
    return false
  }
  const s = ip.toLowerCase()
  if (s === '::' || s === '::1') return true
  if (s.startsWith('fe80')) return true // link-local
  if (s.startsWith('fc') || s.startsWith('fd')) return true // unique-local
  // IPv4-mapped/-embedded IPv6. The WHATWG URL parser normalizes
  // [::ffff:169.254.169.254] to the HEX form ::ffff:a9fe:a9fe, so we must decode
  // both the dotted and the hextet forms (a dotted-only check is bypassable).
  const dotted = s.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
  if (dotted) return isPrivateIp(dotted[1])
  const hex = s.match(/::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (hex) {
    const h1 = parseInt(hex[1], 16)
    const h2 = parseInt(hex[2], 16)
    return isPrivateIp(`${(h1 >> 8) & 255}.${h1 & 255}.${(h2 >> 8) & 255}.${h2 & 255}`)
  }
  if (s.startsWith('::ffff:')) return true // any other mapped form → block conservatively
  return false
}

// Validate a user-supplied URL is a public http(s) endpoint (no internal SSRF
// target). Throws on anything unsafe. Resolves DNS and checks every A/AAAA
// record, so a public hostname that resolves to a private IP is also rejected.
export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw new Error('Invalid URL')
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed')
  }
  const host = u.hostname.replace(/^\[|\]$/g, '') // strip IPv6 brackets
  if (!host || host === 'localhost' || host.endsWith('.localhost')) {
    throw new Error('Blocked host')
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('Blocked host')
    return u
  }
  const records = await lookup(host, { all: true })
  if (records.length === 0) throw new Error('Host did not resolve')
  for (const r of records) {
    if (isPrivateIp(r.address)) throw new Error('Blocked host')
  }
  return u
}

// SSRF-safe fetch: validates the URL — and every redirect hop — points at a
// public host before each request, so a public URL can't 30x-redirect into an
// internal target. 8s per-hop timeout.
export async function safeFetch(rawUrl: string, init?: RequestInit, maxRedirects = 3): Promise<Response> {
  let url = rawUrl
  for (let i = 0; i <= maxRedirects; i++) {
    const validated = await assertPublicHttpUrl(url)
    const res = await fetch(validated, { ...init, redirect: 'manual', signal: AbortSignal.timeout(8000) })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc) return res
      url = new URL(loc, validated).toString()
      continue
    }
    return res
  }
  throw new Error('Too many redirects')
}
