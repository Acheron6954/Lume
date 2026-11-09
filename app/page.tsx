import type { Metadata } from "next";
import { Landing } from "@/components/site/landing";
import "./site.css";

export const metadata: Metadata = {
  title: { absolute: "L'UME — Kreatör Programı" },
  description: "Güzellik ve bakım içerikleri üreten kreatörler için iş birliği programı. Başvur, içerik üret, sattıkça kazan.",
};

export default function Home() {
  return <Landing />;
}
