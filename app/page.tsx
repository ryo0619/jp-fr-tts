"use client";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, Trash2 } from "lucide-react";

type Item = {
  id?: string;
  jp: string;
  fr: string;
  kana?: string;
  audio_url: string;
  created_at?: string;
};

export default function Home() {
  const [jp, setJp] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [items, setItems] = useState<Item[]>([]);

  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const [playingId, setPlayingId] = useState<string | null>(null);

  const [volumeVisible, setVolumeVisible] = useState<Record<string, boolean>>({});
  const [volumes, setVolumes] = useState<Record<string, number>>({}); // 0.0~1.0

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/history");
        const json = await res.json();
        if (res.ok) setItems(json.items || []);
        else setErr(json.error || "failed to load history");
      } catch (e: any) {
        setErr(e.message ?? String(e));
      }
    })();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jp.trim()) return;
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/make", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jp }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "failed");
      const newItem: Item = { jp, fr: json.fr, kana: json.kana, audio_url: json.audioUrl };
      setItems((prev) => [newItem, ...prev]);
      setJp("");
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const onPlay = async (key: string) => {
    const el = audioRefs.current[key];
    if (!el) return;
    if (playingId && playingId !== key) {
      const cur = audioRefs.current[playingId];
      if (cur) cur.pause();
    }
    if (el.paused) {
      el.volume = volumes[key] ?? 1.0;
      await el.play();
      setPlayingId(key);
    } else {
      el.pause();
      setPlayingId(null);
    }
  };

  const toggleVolumeBar = (key: string) => {
    setVolumeVisible((m) => ({ ...m, [key]: !m[key] }));
    const el = audioRefs.current[key];
    if (el) el.volume = volumes[key] ?? 1.0;
  };

  const onVolumeChange = (key: string, value: number) => {
    setVolumes((m) => ({ ...m, [key]: value }));
    const el = audioRefs.current[key];
    if (el) el.volume = value;
  };

  const onDelete = async (id?: string) => {
    if (!id) return;
    if (!confirm("削除しますか？")) return;
    try {
      const res = await fetch(`/api/history?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "failed");
      setItems((prev) => prev.filter((p) => p.id !== id));
    } catch (e: any) {
      alert("削除失敗: " + (e.message ?? String(e)));
    }
  };

  const volumeIcon = (v: number | undefined) => {
    const val = v ?? 1.0;
    if (val === 0) return "🔇";
    if (val < 0.34) return "🔈";
    if (val < 0.67) return "🔉";
    return "🔊";
  };

  return (
    <main className="mx-auto max-w-[720px] px-4 pb-24">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 -mx-4 mb-4 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-[720px] px-4 py-3">
          <h1 className="text-lg font-semibold">JP → FR ＋ TTS（履歴つき）</h1>
        </div>
      </header>

      {/* 入力フォーム */}
      <form onSubmit={onSubmit} className="grid gap-3">
        <textarea
          value={jp}
          onChange={(e) => setJp(e.target.value)}
          placeholder="日本語を入力（例：地下鉄の駅はどこですか？）"
          rows={3}
          className="w-full resize-y rounded-xl border border-neutral-200 bg-white p-3 text-base shadow-sm outline-none ring-0 focus:border-neutral-300"
        />
        <button
          disabled={loading || !jp.trim()}
          className="inline-flex items-center justify-center rounded-xl bg-neutral-900 px-4 py-3 text-white disabled:opacity-50"
        >
          {loading ? "生成中…" : "翻訳＆音声生成"}
        </button>
      </form>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      {/* 履歴カード */}
      <section className="mt-5 grid gap-3">
        {items.map((it, idx) => {
          const key = it.id || `${it.jp}-${idx}`;
          const vol = volumes[key] ?? 1.0;
          return (
            <article
              key={key}
              className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs text-neutral-500">
                  {it.created_at ? new Date(it.created_at).toLocaleString() : ""}
                </div>
                {it.id && (
                  <button
                    onClick={() => onDelete(it.id)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100"
                    aria-label="削除"
                    title="削除"
                  >
                    <Trash2 className="h-4 w-4" />
                    削除
                  </button>
                )}
              </div>

              <div className="space-y-1 text-[15px] leading-relaxed">
                <div>
                  <span className="mr-1 inline-block w-16 text-neutral-500">日本語</span>：{it.jp}
                </div>
                <div>
                  <span className="mr-1 inline-block w-16 text-neutral-500">仏語</span>　：
                  <span className="font-medium">{it.fr}</span>
                </div>
                <div>
                  <span className="mr-1 inline-block w-16 text-neutral-500">ｶﾀｶﾅ</span>：
                  {it.kana || "（生成できない場合あり）"}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3">
                {/* 再生/停止 */}
                <button
                  onClick={() => onPlay(key)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-sm active:scale-95"
                  aria-label="再生/一時停止"
                  title="再生/一時停止"
                >
                  {playingId === key ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </button>

                {/* 音量アイコン（押すとスライダー表示切替） */}
                <button
                  onClick={() => toggleVolumeBar(key)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-sm active:scale-95"
                  aria-label="音量"
                  title="音量"
                >
                  <Volume2 className="h-5 w-5" />
                </button>

                {/* スライダー（スマホでも触りやすい幅） */}
                {volumeVisible[key] && (
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(vol * 100)}
                    onChange={(e) => onVolumeChange(key, Number(e.target.value) / 100)}
                    className="h-3 w-40 cursor-pointer accent-neutral-900"
                    aria-label="音量"
                    title="音量"
                  />
                )}

                {/* 実体のaudio（UI非表示） */}
                <audio
                  ref={(el) => (audioRefs.current[key] = el)}
                  src={it.audio_url}
                  preload="none"
                  onEnded={() => setPlayingId(null)}
                  className="hidden"
                />
              </div>
            </article>
          );
        })}

        {items.length === 0 && (
          <p className="text-sm text-neutral-500">
            まだ履歴はありません。上で日本語を入力して「翻訳＆音声生成」を押してください。
          </p>
        )}
      </section>
    </main>
  );
}
