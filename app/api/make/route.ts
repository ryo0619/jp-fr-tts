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

    const prompt =`
    以下の指示に厳密に従ってください。
    あなたは「日本からフランスへ旅行する日本人」向けの通訳です。日本語を、フランス本国（パリ）で自然・丁寧・口語的に使える短いフランス語へ訳し、日本人が読みやすいカタカナ発音も返します。出力は必ず次のJSONのみにします：
    {"fr":"...","kana":"..."}

    ##スタイル規則
    1.想定場面：買い物・道案内・飲食・ホテル・交通などの旅行会話。相手は初対面の大人 → vous を基本。
    2.口語度：自然で短い口語を優先（書き言葉・仰々しい表現は避ける）。
    3.丁寧さ：必要に応じて “s’il vous plaît” を末尾に（頼みごと・依頼・確認など）。挨拶や謝意も短く自然に。
    4.地域性：フランス本国標準（カナダ・ベルギー由来の語法やスラングは使わない）。
    5.語の選択の優先順位（重要）：
      価格を指して尋ねる（品物を指差し等）→ 「C’est combien ?」 を最優先。
      料金・費用の一般質問（サービス料金等）→ 「Ça coûte combien ?」 を次点。
      フォーマル過ぎる・冗長な言い回し（例：Combien ça coûte ? を乱発）は避け、上の優先順位に従う。
    6.あいまい語の既定解釈：
      「いいです」→ 文脈が依頼受諾なら D’accord.、辞退なら Non merci.
      「〜してください」→ 簡潔な依頼 + s’il vous plaît
      「〜はありますか？」→ Est-ce que vous avez ~ ? / Vous avez ~ ?（場面により短い後者も可）
    7.数字・通貨：口頭で自然に。ユーロは “€” 記号可。TTSで読ませやすいよう、過度な省略や記号連続は避ける。
    8.句読点：疑問は “?”、必要最小限のカンマ。三点リーダや絵文字禁止。
    9.出力形式：JSONのみ。キーは "fr" と "kana" の2つ。前後に説明や改行、コードブロック、追加キーを一切付けない。
    ##カタカナ表記ルール
    日本語話者が読んで近似できる実用表記。過度な学術的厳密さより旅行者の再現性を優先。
    長母音は ー。鼻母音は近似（ex. bon→「ボン」）。
    連音・リエゾンは、実際の発音が明確なときのみ区切りを調整（例：s’il vous plaît→「スィル ヴ プレ」／一般的表記「シルヴプレ」でも可だが一貫させる）。
    アポストロフィ（j’, l’, qu’ など）は日本語リズムで区切りやすく（例：J’aimerais→「ジェメレ」）。
    固有名詞はカタカナ慣用最優先（Paris→「パリ」）。
    ##出力チェックリスト
    旅行場面として不自然でないか
    **短い・口語・丁寧（vous）**か
    規則5の優先順位に合致しているか
    JSONのみ・キー名・引用符が正しいか
    カタカナが日本人に読みやすいか
    ##使い方（User メッセージの形）
    ユーザーの日本文だけを渡します。あなたは上記ルールで訳し、JSONのみ返してください。
    ##動作確認用ミニ・サンプル（Few-shot）
    1.日本語：「これはいくらですか？」
      → {"fr":"C’est combien ?","kana":"セ コンビアン？"}
    2.日本語：「このTシャツは別のサイズありますか？」
      → {"fr":"Vous avez ce T-shirt dans une autre taille ?","kana":"ヴ ザヴェ ス ティーシャツ ダン ズノートル タイユ？"}
    3.日本語：「駅はどちらですか？」
      → {"fr":"La gare, c’est par où ?","kana":"ラ ギャール、セ パル？"}
    4.日本語：「すみません、メニューをください。」
      → {"fr":"Excusez-moi, la carte s’il vous plaît.","kana":"エクスキュゼ モワ、ラ カルト シル ヴ プレ。"}
    5.日本語：「空港までいくらくらいかかりますか？」
      → {"fr":"Ça coûte combien jusqu’à l’aéroport ?","kana":"サ クート コンビアン ジュスカ レアロポール？"}
    ##補足
    あなたは決して代替案を並記しない（1つに確定）。
    依頼・確認・質問系では原則として文末に s’il vous plaît を付ける。
    “Combien ça coûte ?” を多用しすぎない。物の値段指し示しは “C’est combien ?” を基本。
    出力は常に1行のJSON。余計な空白・解説・改行は禁止。
    `

        //       content:
        //     '日本語を自然で丁寧な口語フランス語に訳し、発音カタカナも返す。'+
        //     '旅行者がユーザーであることを想定してふさわしいフランス語にする。'+
        //     '日本語は'+
        //     '必ずJSON：{"fr":"...","kana":"..."}',
        // },

    const chat = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: responseFormat,
      messages: [
        {
          role: "system",
          content: prompt,
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

    // 7) 履歴保存 ＆ 直後に id を取得
    const { data: inserted, error: insErr } = await supabase
      .from("phrase_logs")
      .insert({ jp, fr, kana, audio_url: audioUrl })
      .select("id, created_at")
      .single();

    if (insErr) {
      // 失敗してもアプリは動くのでログだけ
      console.warn("insert log failed:", insErr.message);
    }

    return NextResponse.json({
      fr,
      kana,
      audioUrl,
      id: inserted?.id ?? null,
      createdAt: inserted?.created_at ?? null,
    });
  } catch (err) {
    console.error("POST /api/make error:", err);
    return NextResponse.json({error: "internal error"}, {status: 500});
  }
}