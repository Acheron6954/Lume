import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listMembers, type Member } from "@/lib/members-db";
import { isOwnerSession } from "@/lib/session";
import { d } from "@/lib/ui";
import { decide } from "./actions";

export const metadata: Metadata = { title: "Üyeler" };
export const dynamic = "force-dynamic";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" });
const STATUS: Record<Member["status"], string> = { pending: "Onay bekliyor", approved: "Onaylı", rejected: "Reddedildi" };

function Row({ m }: { m: Member }) {
  return (
    <li className="row recontact-row">
      <span className="avatar" aria-hidden="true">{m.name.slice(0, 1).toUpperCase()}</span>
      <div className="who">
        <p className="who-name">{m.name}</p>
        <p className="who-sub">
          <span>{m.email}</span>
          <span className="dotsep">·</span>
          <span>{STATUS[m.status]}{m.status === "approved" ? ` (${m.role === "admin" ? "yönetici" : "salt okunur"})` : ""}</span>
          <span className="dotsep">·</span>
          <span>{fmt(m.created_at)}</span>
        </p>
      </div>
      <form action={decide} className="recontact-actions" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <input type="hidden" name="id" value={m.id} />
        {m.status !== "approved" && (
          <>
            <button type="submit" name="action" value="viewer" className="btn btn-primary btn-sm">Onayla (salt okunur)</button>
            <button type="submit" name="action" value="admin" className="btn btn-ghost btn-sm">Yönetici olarak onayla</button>
          </>
        )}
        {m.status === "approved" && m.role === "viewer" && (
          <button type="submit" name="action" value="admin" className="btn btn-ghost btn-sm">Yönetici yap</button>
        )}
        {m.status === "approved" && m.role === "admin" && (
          <button type="submit" name="action" value="viewer" className="btn btn-ghost btn-sm">Salt okunur yap</button>
        )}
        {m.status !== "rejected" && (
          <button type="submit" name="action" value="reject" className="btn btn-ghost btn-sm">{m.status === "approved" ? "Erişimi kaldır" : "Reddet"}</button>
        )}
      </form>
    </li>
  );
}

export default async function MembersPage() {
  if (!(await isOwnerSession())) notFound();
  const { members, error } = await listMembers();
  const pending = members.filter((m) => m.status === "pending");
  const others = members.filter((m) => m.status !== "pending");
  return (
    <div className="page">
      <header className="page-head rise" style={d(0)}>
        <div>
          <p className="eyebrow">Erişim</p>
          <h1 className="h1">Üyeler</h1>
        </div>
      </header>
      {error && <p className="issue" role="alert">Üye listesi okunamadı.</p>}
      <section className="card rise" style={d(100)} aria-label="Onay bekleyenler">
        <div className="card-head">
          <h2 className="h2">Onay bekleyenler</h2>
          <span className="pill">{pending.length}</span>
        </div>
        {pending.length === 0 ? <p className="muted small">Bekleyen üyelik yok.</p> : <ul className="recontact-list">{pending.map((m) => <Row key={m.id} m={m} />)}</ul>}
      </section>
      <section className="card rise" style={d(180)} aria-label="Tüm üyeler">
        <div className="card-head">
          <h2 className="h2">Onaylanan ve reddedilenler</h2>
        </div>
        {others.length === 0 ? <p className="muted small">Henüz karar verilmiş üyelik yok.</p> : <ul className="recontact-list">{others.map((m) => <Row key={m.id} m={m} />)}</ul>}
        <p className="muted small">Salt okunur üye her şeyi görür ama hiçbir şeyi değiştiremez ve kimseye mail/DM gönderemez. Erişimi kaldırılan üye bir sonraki sayfa açılışında dışarıda kalır.</p>
      </section>
    </div>
  );
}
