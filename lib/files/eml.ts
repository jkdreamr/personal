"use client";

/**
 * Compact, dependency-free EML parser that runs in the browser, so email content stays on
 * the device. Extracts sender, recipients, date, subject, and a plain-text body. Handles
 * MIME multipart, quoted-printable, and base64. (We deliberately avoid the Node-only
 * `mailparser`, which would require uploading the email to the server.)
 */

export type ParsedEmail = {
  from?: string;
  to?: string;
  cc?: string;
  date?: string;
  subject?: string;
  body: string;
  text: string; // a single string for the model context
};

function decodeQuotedPrintable(input: string): string {
  return input
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function decodeBase64(input: string): string {
  try {
    const bin = atob(input.replace(/\s+/g, ""));
    // Best-effort UTF-8 decode.
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return input;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseHeaders(block: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const unfolded = block.replace(/\r?\n[ \t]+/g, " ");
  for (const line of unfolded.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key) headers[key] = value;
  }
  return headers;
}

function decodeBody(body: string, encoding?: string, contentType?: string): string {
  let decoded = body;
  const enc = (encoding ?? "").toLowerCase();
  if (enc.includes("quoted-printable")) decoded = decodeQuotedPrintable(body);
  else if (enc.includes("base64")) decoded = decodeBase64(body);
  if ((contentType ?? "").toLowerCase().includes("text/html")) decoded = stripHtml(decoded);
  return decoded.trim();
}

export async function parseEml(file: File): Promise<ParsedEmail> {
  const raw = await file.text();
  const sep = raw.indexOf("\r\n\r\n") !== -1 ? "\r\n\r\n" : "\n\n";
  const splitIdx = raw.indexOf(sep);
  const headerBlock = splitIdx === -1 ? raw : raw.slice(0, splitIdx);
  const bodyBlock = splitIdx === -1 ? "" : raw.slice(splitIdx + sep.length);
  const headers = parseHeaders(headerBlock);

  const contentType = headers["content-type"] ?? "";
  let body = "";

  const boundaryMatch = contentType.match(/boundary="?([^";]+)"?/i);
  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = bodyBlock.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:--)?`));
    let plain = "";
    let html = "";
    for (const part of parts) {
      const trimmed = part.replace(/^\r?\n/, "");
      const pSep = trimmed.indexOf("\r\n\r\n") !== -1 ? "\r\n\r\n" : "\n\n";
      const pIdx = trimmed.indexOf(pSep);
      if (pIdx === -1) continue;
      const partHeaders = parseHeaders(trimmed.slice(0, pIdx));
      const partBody = trimmed.slice(pIdx + pSep.length);
      const ct = partHeaders["content-type"] ?? "";
      const cte = partHeaders["content-transfer-encoding"];
      if (ct.toLowerCase().includes("text/plain") && !plain) plain = decodeBody(partBody, cte, ct);
      else if (ct.toLowerCase().includes("text/html") && !html) html = decodeBody(partBody, cte, ct);
    }
    body = plain || html;
  } else {
    body = decodeBody(bodyBlock, headers["content-transfer-encoding"], contentType);
  }

  const parsed: ParsedEmail = {
    from: headers["from"],
    to: headers["to"],
    cc: headers["cc"],
    date: headers["date"],
    subject: headers["subject"],
    body: body.slice(0, 20000),
    text: "",
  };

  const head = [
    parsed.from ? `From: ${parsed.from}` : "",
    parsed.to ? `To: ${parsed.to}` : "",
    parsed.cc ? `Cc: ${parsed.cc}` : "",
    parsed.date ? `Date: ${parsed.date}` : "",
    parsed.subject ? `Subject: ${parsed.subject}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  parsed.text = `${head}\n\n${parsed.body}`.trim();
  return parsed;
}
