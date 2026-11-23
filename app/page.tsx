import type { Metadata } from "next";
import { Landing } from "@/components/site/landing";
import { currentSession } from "@/lib/session";
import "./site.css";

export const metadata: Metadata = {
  title: { absolute: "L'UME — Kreatör Programı" },
  description: "Güzellik ve bakım içerikleri üreten kreatörler için iş birliği programı. Başvur, içerik üret, sattıkça kazan.",
};

export default async function Home() {
  // Giriş yapılmışsa menüde hesap gösterilir; panel bağlantısı yalnızca erişimi olanlara görünür.
  const s = await currentSession();
  const account = s ? { user: s.user, panel: s.role !== "member" } : null;
  return <Landing account={account} />;
}
