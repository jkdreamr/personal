/**
 * Isomorphic URL safety checks — no Node built-ins, safe to import on the client.
 * The server adds DNS resolution on top of these (see validate-url.ts).
 */

export type UrlValidation = { ok: true; url: URL } | { ok: false; reason: string };

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal", "metadata"]);

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** Detect IP literals without node:net. Returns 4, 6, or 0. */
export function ipVersion(host: string): 0 | 4 | 6 {
  if (IPV4_RE.test(host)) return 4;
  if (host.includes(":")) return 6; // good enough for blocking decisions
  return 0;
}

export function isPrivateIp(ip: string): boolean {
  const v4 = ip.match(IPV4_RE);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if ([a, b, Number(v4[3]), Number(v4[4])].some((n) => n > 255)) return true;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local + metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 192 && b === 0) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower.includes(":")) {
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80")) return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    if (lower.startsWith("::ffff:") || lower.startsWith("64:ff9b:")) return true;
    return false;
  }
  return false;
}

export function validateUrlShape(input: string): UrlValidation {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, reason: "That doesn't look like a valid web address." };
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { ok: false, reason: "Only http and https links are supported." };
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(host)) {
    return { ok: false, reason: "That address can't be fetched." };
  }
  if (host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, reason: "Internal addresses can't be fetched." };
  }
  if (ipVersion(host) !== 0 && isPrivateIp(host)) {
    return { ok: false, reason: "Private and local addresses can't be fetched." };
  }
  return { ok: true, url };
}
