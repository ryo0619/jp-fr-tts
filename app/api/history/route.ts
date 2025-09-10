import { NextResponse } from "next/server";

export const runtime = "nodejs";

// GET /api/history?limit=50
export async function GET(req: Request) {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!, {
      auth: { persistSession: false },
    });

    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Number(limitParam ?? 50), 200);

    const { data, error } = await supabase
      .from("phrase_logs")
      .select("id,jp,fr,kana,audio_url,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/history?id=xxx
export async function DELETE(req: Request) {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!, {
      auth: { persistSession: false },
    });

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const { error } = await supabase.from("phrase_logs").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
