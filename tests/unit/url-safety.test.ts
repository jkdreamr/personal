import { describe, it, expect } from "vitest";
import { isPrivateIp, validateUrlShape, ipVersion } from "@/lib/research/url-shape";

describe("isPrivateIp (SSRF blocking)", () => {
  it("blocks loopback and private IPv4 ranges", () => {
    for (const ip of ["127.0.0.1", "10.0.0.5", "172.16.4.4", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1"]) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });
  it("allows public IPv4", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34"]) {
      expect(isPrivateIp(ip)).toBe(false);
    }
  });
  it("blocks IPv6 loopback, link-local, ULA, and mapped private", () => {
    for (const ip of ["::1", "fe80::1", "fc00::1", "fd12::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"]) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });
});

describe("validateUrlShape", () => {
  it("rejects non-http protocols", () => {
    expect(validateUrlShape("file:///etc/passwd").ok).toBe(false);
    expect(validateUrlShape("ftp://example.com").ok).toBe(false);
    expect(validateUrlShape("javascript:alert(1)").ok).toBe(false);
  });
  it("rejects localhost and internal hostnames", () => {
    expect(validateUrlShape("http://localhost:3000").ok).toBe(false);
    expect(validateUrlShape("http://printer.local").ok).toBe(false);
    expect(validateUrlShape("http://db.internal/x").ok).toBe(false);
    expect(validateUrlShape("http://metadata.google.internal").ok).toBe(false);
  });
  it("rejects literal private IP hosts", () => {
    expect(validateUrlShape("http://169.254.169.254/latest/meta-data").ok).toBe(false);
    expect(validateUrlShape("http://192.168.0.1").ok).toBe(false);
  });
  it("accepts well-formed public https URLs", () => {
    const v = validateUrlShape("https://www.example.com/about");
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.url.hostname).toBe("www.example.com");
  });
  it("rejects garbage", () => {
    expect(validateUrlShape("not a url").ok).toBe(false);
    expect(validateUrlShape("").ok).toBe(false);
  });
});

describe("ipVersion", () => {
  it("detects versions", () => {
    expect(ipVersion("1.2.3.4")).toBe(4);
    expect(ipVersion("::1")).toBe(6);
    expect(ipVersion("example.com")).toBe(0);
  });
});
