import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listMembers, type Member } from "@/lib/members-db";
import { isOwnerSession } from "@/lib/session";
import { d } from "@/lib/ui";
import { decide } from "./actions";

export const metadata: Metadata = { title: "Üyeler" };
export const dynamic = "force-dynamic";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" });
const STATUS: Record<Member["status"], string> = { pending: "Panel erişimi yok", approved: "Panel erişimi var", rejected: "Engellendi" };

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
        {m.status === "pending" && (
          <>
            <button type="submit" name="action" value="viewer" className="btn btn-primary btn-sm">Erişim ver (salt okunur)</button>
            <button type="submit" name="action" value="admin" className="btn btn-ghost btn-sm">Yönetici olarak erişim ver</button>
          </>
        )}
        {m.status === "approved" && m.role === "viewer" && (
          <button type="submit" name="action" value="admin" className="btn btn-ghost btn-sm">Yönetici yap</button>
        )}
        {m.status === "approved" && m.role === "admin" && (
          <button type="submit" name="action" value="viewer" className="btn btn-ghost btn-sm">Salt okunur yap</button>
        )}
        {m.status === "approved" && (
          <button type="submit" name="action" value="revoke" className="btn btn-ghost btn-sm">Erişimi kaldır</button>
        )}
        {m.status === "pending" && (
          <button type="submit" name="action" value="reject" className="btn btn-ghost btn-sm">Hesabı engelle</button>
        )}
        {m.status === "rejected" && (
          <button type="submit" name="action" value="revoke" className="btn btn-ghost btn-sm">Engeli kaldır</button>
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
      <section className="card rise" style={d(100)} aria-label="Panel erişimi olmayanlar">
        <div className="card-head">
          <h2 className="h2">Panel erişimi olmayanlar</h2>
          <span className="pill">{pending.length}</span>
        </div>
        {pending.length === 0 ? <p className="muted small">Erişim bekleyen üye yok.</p> : <ul className="recontact-list">{pending.map((m) => <Row key={m.id} m={m} />)}</ul>}
      </section>
      <section className="card rise" style={d(180)} aria-label="Erişimi olanlar ve engellenenler">
        <div className="card-head">
          <h2 className="h2">Erişimi olanlar ve engellenenler</h2>
        </div>
        {others.length === 0 ? <p className="muted small">Henüz erişim verilen ya da engellenen üye yok.</p> : <ul className="recontact-list">{others.map((m) => <Row key={m.id} m={m} />)}</ul>}
        <p className="muted small">Kayıt olan herkes siteye giriş yapabilir; paneli yalnızca erişim verdiğin üyeler görür. Erişim verdiğin üye paneli bir sonraki girişinde görür. Salt okunur üye her şeyi görür ama hiçbir şeyi değiştiremez ve kimseye mail/DM gönderemez. Erişimi kaldırılan üye bir sonraki sayfa açılışında paneli göremez; engellenen hesap hiç giriş yapamaz.</p>
      </section>
    </div>
  );
}
