import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const MARKETING_EMAIL = "sandeemanage@gmail.com";

async function signed(supabase: any, path: string) {
  const { data } = await supabase.storage.from("flyers").createSignedUrl(path, 60 * 60);
  return data?.signedUrl as string | undefined;
}

export const listDesigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("designs")
      .select("id,title,status,updated_at,design_versions(count)")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((d: any) => ({
      id: d.id as string,
      title: d.title as string,
      status: d.status as string,
      updated_at: d.updated_at as string,
      versions: (d.design_versions?.[0]?.count as number) ?? 0,
    }));
  });

export const getDesign = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: design, error } = await sb.from("designs").select("*").eq("id", data.id).single();
    if (error || !design) throw new Error("Design not found");
    const { data: messages } = await sb
      .from("design_messages").select("*").eq("design_id", data.id).order("created_at");
    const { data: versions } = await sb
      .from("design_versions").select("*").eq("design_id", data.id).order("version_number");
    const withUrls = await Promise.all(
      (versions ?? []).map(async (v: any) => ({ ...v, url: await signed(sb, v.image_path) })),
    );
    return { design, messages: messages ?? [], versions: withUrls };
  });

export const createDesign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { prompt: string }) => z.object({ prompt: z.string().trim().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: design, error } = await supabase
      .from("designs").insert({ user_id: userId, title: data.prompt.slice(0, 60) }).select("id").single();
    if (error) throw new Error(error.message);
    const { error: e2 } = await supabase
      .from("design_messages").insert({ design_id: design.id, user_id: userId, role: "user", content: data.prompt });
    if (e2) throw new Error(e2.message);
    return { id: design.id as string };
  });

export const addPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { designId: string; prompt: string }) =>
    z.object({ designId: z.string().uuid(), prompt: z.string().trim().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("design_messages").insert({ design_id: data.designId, user_id: userId, role: "user", content: data.prompt });
    if (error) throw new Error(error.message);
    await supabase.from("designs").update({ status: "draft", updated_at: new Date().toISOString() }).eq("id", data.designId);
    return { ok: true };
  });

/** Generates the next flyer version from the conversation so far. */
export const generateVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { designId: string }) => z.object({ designId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");
    const { planFlyer, renderFlyer } = await import("./ai.server");

    const { data: msgs, error } = await supabase
      .from("design_messages").select("role,content").eq("design_id", data.designId).order("created_at");
    if (error) throw new Error(error.message);
    if (!msgs?.length || msgs[msgs.length - 1]!.role !== "user") return { skipped: true };

    const plan = await planFlyer(apiKey, msgs.map((m: any) => ({ role: m.role, content: m.content })));

    const origin = new URL(getRequest().url).origin;
    const logoRes = await fetch(`${origin}/mccoys-logo.png`);
    if (!logoRes.ok) throw new Error("Logo file missing");
    const logo = new Blob([await logoRes.arrayBuffer()], { type: "image/png" });
    const bytes = await renderFlyer(apiKey, plan.image_prompt, logo);

    const { count } = await supabase
      .from("design_versions").select("id", { count: "exact", head: true }).eq("design_id", data.designId);
    const vnum = (count ?? 0) + 1;
    const path = `${userId}/${data.designId}/v${vnum}-${Date.now()}.png`;
    const up = await supabase.storage.from("flyers").upload(path, bytes, { contentType: "image/png" });
    if (up.error) throw new Error(up.error.message);

    const checks = plan.checks.map((c) => ({ ...c, passed: true }));
    const { error: ve } = await supabase.from("design_versions").insert({
      design_id: data.designId, user_id: userId, version_number: vnum, image_path: path, checks,
    });
    if (ve) throw new Error(ve.message);
    const { error: me } = await supabase.from("design_messages").insert({
      design_id: data.designId, user_id: userId, role: "assistant", content: plan.reply,
      adjustments: plan.adjustments, version_number: vnum,
    });
    if (me) throw new Error(me.message);
    await supabase.from("designs")
      .update({ title: plan.title, updated_at: new Date().toISOString() }).eq("id", data.designId);
    return { skipped: false };
  });

export const sendToMarketing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { designId: string; neededBy: string; uses: string }) =>
    z.object({ designId: z.string().uuid(), neededBy: z.string().max(40), uses: z.string().max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, claims } = context;
    const apiKey = process.env["RESEND_API_KEY"];
    if (!apiKey) throw new Error("Email is not configured.");
    const senderEmail = claims.email as string | undefined;
    if (!senderEmail) throw new Error("Your account has no email address.");

    const { data: design, error: de } = await supabase
      .from("designs").select("title").eq("id", data.designId).single();
    if (de || !design) throw new Error("Design not found");
    const { data: latest, error: le } = await supabase
      .from("design_versions").select("version_number,image_path").eq("design_id", data.designId)
      .order("version_number", { ascending: false }).limit(1).maybeSingle();
    if (le) throw new Error(le.message);
    if (!latest) throw new Error("Generate a flyer before sending it to Marketing.");

    const file = await supabase.storage.from("flyers").download(latest.image_path);
    if (file.error) throw new Error(file.error.message);
    const pngBytes = new Uint8Array(await file.data.arrayBuffer());
    const { data: link } = await supabase.storage
      .from("flyers").createSignedUrl(latest.image_path, 60 * 60 * 24 * 7);

    // Email first, so a delivery failure leaves the design unsent and retryable.
    const { sendMarketingEmail } = await import("./email.server");
    const { pngToPsd } = await import("./psd.server");
    await sendMarketingEmail({
      apiKey,
      to: MARKETING_EMAIL,
      senderEmail,
      designTitle: design.title,
      versionNumber: latest.version_number,
      neededBy: data.neededBy,
      uses: data.uses,
      imageUrl: link?.signedUrl,
      image: { filename: `mccoys-flyer-v${latest.version_number}.png`, bytes: pngBytes },
      psd: { filename: `mccoys-flyer-v${latest.version_number}.psd`, bytes: pngToPsd(pngBytes) },
    });

    const { error } = await supabase
      .from("designs")
      .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", data.designId);
    if (error) throw new Error(error.message);
    return { ok: true, to: MARKETING_EMAIL, emailed: true };
  });
