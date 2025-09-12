// app/page.tsx
import { fetchHistory } from "@/lib/history";
import HistoryClient from "./HistoryClient";

export const revalidate = 0; // いつも最新（SSR）

export default async function Page() {
  const items = await fetchHistory(50);
  return <HistoryClient initialItems={items} />;
}
