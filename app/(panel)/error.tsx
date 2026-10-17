"use client";

// Panel sayfalarından biri çökerse genel "sayfa yüklenemedi" ekranı yerine asıl hatayı gösterir.
// Kenar çubuğu yerinde kalır, sayfa yeniden denenebilir.
export default function PanelError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const where = (error.stack ?? "").split("\n").slice(0, 4).join("\n");
  return (
    <div className="page">
      <section className="card" role="alert">
        <h1 className="h2">Bu sayfa yüklenemedi</h1>
        <p className="muted">{error.message || "Bilinmeyen hata"}</p>
        {where && (
          <pre className="muted small" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", marginTop: 8 }}>
            {where}
          </pre>
        )}
        {error.digest && <p className="muted small">Kod: {error.digest}</p>}
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={reset}>
            Yeniden dene
          </button>
        </div>
      </section>
    </div>
  );
}
