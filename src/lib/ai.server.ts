import { BRAND_SYSTEM_PROMPT } from "./brand";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const TEXT_MODEL = "openai/gpt-6-astra";
const IMAGE_MODEL = "openai/gpt-image-2.5-sunburst";

export type FlyerPlan = {
  title: string;
  reply: string;
  adjustments: { requested: string; applied: string }[];
  image_prompt: string;
  checks: { label: string; detail: string }[];
};

export class GatewayError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function gatewayError(res: Response) {
  const text = await res.text().catch(() => "");
  let msg = text;
  try {
    const j = JSON.parse(text);
    msg = j?.error?.message ?? j?.message ?? text;
  } catch {}
  if (res.status === 402) msg = msg || "AI credits are used up. Add credits to keep designing.";
  if (res.status === 429) msg = "The AI is busy right now. Please try again in a minute.";
  return new GatewayError(res.status, msg || `AI request failed (${res.status})`);
}

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "reply", "adjustments", "image_prompt", "checks"],
  properties: {
    title: { type: "string" },
    reply: { type: "string" },
    adjustments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["requested", "applied"],
        properties: { requested: { type: "string" }, applied: { type: "string" } },
      },
    },
    image_prompt: { type: "string" },
    checks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "detail"],
        properties: { label: { type: "string" }, detail: { type: "string" } },
      },
    },
  },
};

export async function planFlyer(
  apiKey: string,
  history: { role: "user" | "assistant"; content: string }[],
): Promise<FlyerPlan> {
  const res = await fetch(`${GATEWAY}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      Authorization: `Bearer ${apiKey}`,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      input: [{ role: "system", content: BRAND_SYSTEM_PROMPT }, ...history],
      text: { format: { type: "json_schema", name: "flyer_plan", strict: true, schema } },
    }),
  });
  if (!res.ok || !res.body) throw await gatewayError(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let out = "";
  let done = "";
  for (;;) {
    const { value, done: end } = await reader.read();
    if (end) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const data = frame
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .join("");
      if (!data || data === "[DONE]") continue;
      let ev: any;
      try {
        ev = JSON.parse(data);
      } catch {
        continue;
      }
      if (ev.type === "response.output_text.delta") out += ev.delta ?? "";
      else if (ev.type === "response.output_text.done") done = ev.text ?? "";
      else if (ev.type === "response.failed" || ev.type === "error")
        throw new GatewayError(500, ev?.response?.error?.message ?? ev?.message ?? "AI request failed");
      else if (ev.type === "response.refusal.done") throw new GatewayError(400, ev.refusal ?? "The AI declined this request.");
    }
  }
  const text = done || out;
  if (!text) throw new GatewayError(500, "The AI returned an empty answer. Please try again.");
  return JSON.parse(text) as FlyerPlan;
}

export async function renderFlyer(apiKey: string, prompt: string, logo: Blob): Promise<Uint8Array> {
  const form = new FormData();
  form.set("model", IMAGE_MODEL);
  form.set("prompt", prompt);
  form.set("size", "1024x1536");
  form.set("image", logo, "mccoys-logo.png");
  const res = await fetch(`${GATEWAY}/images/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw await gatewayError(res);
  const json: any = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new GatewayError(500, "No image came back. Please try again.");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
