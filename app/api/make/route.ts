import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const BUCKET = process.env.SUPABASE_BUCKET || "phrases";

export async function POST(req: NextRequest) {
  try {
    const { jp } = await req.json();
    if (!jp || typeof jp !== "string") {
      return NextResponse.json({ error: "jp is required" }, { status: 400 });
    }

    // 1) 翻訳＋カタカナ発音（JSONで返してもらう）
    const chat = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" } as any, // 型のラグ対策
      messages: [
        {
          role: "system",
          content:
            "日本語を自然で丁寧な口語フランス語に訳し、フランス語の発音を日本語カタカナで与えてください。必ず JSON で返す: {\"fr\":\"...\",\"kana\":\"...\"}",
        },
        { role: "user", content: jp },
      ],
      temperature: 0.2,
    });

    const raw = chat.choices[0]?.message?.content?.trim() || "";
    let fr = "", kana = "";
    try {
      const obj = JSON.parse(raw);
      fr = (obj.fr || "").trim();
      kana = (obj.kana || "").trim();
    } catch {
      // フォールバック（万一JSONじゃなかったら）
      fr = raw;
      kana = "";
    }
    if (!fr) return NextResponse.json({ error: "translation failed" }, { status: 500 });

    // 2) TTS（mp3生成）
    // @ts-expect-error 型定義のラグ回避
    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: fr,
      format: "mp3",
    });
    const mp3Array = await speech.arrayBuffer();
    const mp3Buffer = Buffer.from(mp3Array);

    // 3) Supabase クライアント（動的 import で安定化）
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseUrl = process.env.SUPABASE_URL!;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE!;
    const supabase = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

    // 4) ファイル名（Unicodeプロパティ不使用で安全化）
    const filenameSafe = fr
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 60);
    const objectName = `${Date.now()}_${filenameSafe || "phrase"}.mp3`;

    // 5) アップロード
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(objectName, mp3Buffer, { contentType: "audio/mpeg", upsert: false });
    if (upErr) {
      console.error("upload failed:", upErr);
      return NextResponse.json({ error: "upload failed", detail: String(upErr?.message || upErr) }, { status: 500 });
    }

    // 6) 公開URL
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(objectName);
    const audioUrl = pub?.publicUrl || "";

    // 7) 履歴に保存（jp, fr, kana, audio_url）
    try {
      await supabase.from("phrase_logs").insert({ jp, fr, kana, audio_url: audioUrl });
    } catch (e) {
      console.warn("insert log failed (ignored):", e);
    }

    return NextResponse.json({ fr, kana, audioUrl });
  } catch (e: any) {
    console.error("handler error:", e);
    return NextResponse.json({ error: "internal", detail: String(e?.message || e) }, { status: 500 });
  }
}
