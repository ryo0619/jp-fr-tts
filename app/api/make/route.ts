import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const BUCKET = process.env.SUPABASE_BUCKET || "phrases";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { jp?: string };
    const jp = body?.jp;
    if (!jp || typeof jp !== "string") {
      return NextResponse.json({ error: "jp is required" }, { status: 400 });
    }

    // 1) 翻訳＋カタカナ発音（JSONで返す）
    const responseFormat: { type: "json_object" } = { type: "json_object" };

    const chat = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: responseFormat,
      messages: [
        {
          role: "system",
          content:
            '日本語を自然で丁寧な口語フランス語に訳し、発音カタカナも返す。必ずJSON：{"fr":"...","kana":"..."}',
        },
        { role: "user", content: jp },
      ],
      temperature: 0.2,
    });

    const raw = chat.choices[0]?.message?.content?.trim() ?? "";
    let fr = "", kana = "";
    try {
      const obj = JSON.parse(raw) as { fr?: string; kana?: string };
      fr = (obj.fr ?? "").trim();
      kana = (obj.kana ?? "").trim();
    } catch {
      fr = raw;
      kana = "";
    }
    if (!fr) return NextResponse.json({ error: "translation failed" }, { status: 500 });

    // 2) TTS（mp3生成）
    // @ts-expect-error: 'format' is supported at runtime, but not in current types
    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: fr,
      format: "mp3",
    } as unknown as Record<string, unknown> 
  );
    const mp3Array = await speech.arrayBuffer();
    const mp3Buffer = Buffer.from(mp3Array);

    // 3) Supabase（動的 import）
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!, {
      auth: { persistSession: false },
    });

    // 4) ファイル名（Unicodeプロパティ不使用）
    const filenameSafe = fr
      .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s-]/g, "")
      .trim().replace(/\s+/g, "_").slice(0, 60);
    const objectName = `${Date.now()}_${filenameSafe || "phrase"}.mp3`;

    // 5) アップロード
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(objectName, mp3Buffer, { contentType: "audio/mpeg", upsert: false });
    if (upErr) {
      return NextResponse.json({ error: "upload failed", detail: upErr.message }, { status: 500 });
    }

    // 6) 公開URL
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(objectName);
    const audioUrl = pub?.publicUrl ?? "";

    // 7) 履歴保存
    try {
      await supabase.from("phrase_logs").insert({ jp, fr, kana, audio_url: audioUrl });
    } catch {
      /* ignore insert error */
    }

    return NextResponse.json({ fr, kana, audioUrl });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "internal", detail: msg }, { status: 500 });
  }
}
