import dns from "node:dns/promises";
import { ipVersion, isPrivateIp, validateUrlShape, type UrlValidation } from "./url-shape";

/**
 * Server-side URL validation. Reuses the isomorphic shape checks (protocol, hostname,
 * literal IPs) and adds DNS resolution to catch public hostnames that point at private IPs.
 */

export { isPrivateIp, validateUrlShape };
export type { UrlValidation };

export async function validateUrl(input: string): Promise<UrlValidation> {
  const shape = validateUrlShape(input);
  if (!shape.ok) return shape;
  const host = shape.url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  // If the host is already an IP literal it passed the shape check.
  if (ipVersion(host) !== 0) return shape;

  try {
    const records = await dns.lookup(host, { all: true });
    if (!records.length) return { ok: false, reason: "That address could not be resolved." };
    for (const r of records) {
      if (isPrivateIp(r.address)) {
        return { ok: false, reason: "That address resolves to a private network and can't be fetched." };
      }
    }
  } catch {
    return { ok: false, reason: "That address could not be resolved." };
  }
  return shape;
}
