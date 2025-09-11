import "server-only";

export type Item = {
  id?: string;
  jp:string;
  fr: string;
  kana?: string;
  audio_url: string;
  created_at?: string;
};

// サーバーで直接Supabaseから取得
export async function fetchHistory(limit = 50): Promise<Item[]>{
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("phrase_logs")
    .select("id,jp,fr,kana,audio_url,created_at")
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 200));

  if (error) {
    console.error("history fetch error:", error.message);
    return [];
  }
  return data ?? [];

}