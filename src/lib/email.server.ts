// Sends transactional email through the Lovable connector gateway (Resend).
// Without a verified domain, Resend only allows onboarding@resend.dev as the sender,
// and only delivers to the Resend account owner's address.
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

type Attachment = { filename: string; bytes: Uint8Array };

export type MarketingEmail = {
  apiKey: string;
  to: string;
  senderEmail: string;
  designTitle: string;
  versionNumber: number;
  neededBy: string;
  uses: string;
  imageUrl: string | undefined;
  image: Attachment;
};

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export async function sendMarketingEmail(e: MarketingEmail) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!lovableKey) throw new Error("Lovable gateway is not configured.");
  const fromAddress = process.env["RESEND_FROM_EMAIL"] || "onboarding@resend.dev";
  // Display names can't contain unescaped quotes or angle brackets.
  const fromName = `${e.senderEmail} via McCoy's Brand Studio`.replace(/["<>]/g, "");
  const rows: [string, string][] = [
    ["From", e.senderEmail],
    ["Design", `${e.designTitle} (v${e.versionNumber})`],
    ["Needed by", e.neededBy || "Not specified"],
    ["Where it will be used", e.uses || "Not specified"],
  ];
  const html = `
    <p>A store manager sent a flyer for Marketing review. Reply to this email to respond to them directly.</p>
    <table cellpadding="6" style="border-collapse:collapse">
      ${rows.map(([k, v]) => `<tr><td><strong>${escapeHtml(k)}</strong></td><td>${escapeHtml(v)}</td></tr>`).join("")}
    </table>
    <p>The flyer is attached${e.imageUrl ? `, or <a href="${escapeHtml(e.imageUrl)}">view it here</a> (link expires in 7 days)` : ""}.</p>`;
  const text = [
    "A store manager sent a flyer for Marketing review. Reply to this email to respond to them directly.",
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    "The flyer is attached.",
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${e.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `"${fromName}" <${fromAddress}>`,
      to: [e.to],
      reply_to: e.senderEmail,
      subject: `Flyer for review: ${e.designTitle} (v${e.versionNumber})`,
      html,
      text,
      attachments: [{ filename: e.image.filename, content: toBase64(e.image.bytes) }],
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(`Email failed to send: ${body?.message ?? res.statusText}`);
  }
}
