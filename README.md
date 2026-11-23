# L'UME — Kreatör sitesi ve paneli

lume1.com.tr'nin kaynak kodu. Next.js 16 (App Router) + Supabase, Vercel'de yayında.

- **Herkese açık site** (`/`): kreatör programının tanıtımı ve başvuru formu.
- **Üyelik** (`/kayit`, `/giris`): kayıt olan herkes giriş yapar. Kreatör paneline yalnızca site sahibinin
  Üyeler sayfasından erişim verdiği üyeler girebilir; diğerleri paneli hiç görmez.
- **Kreatör paneli** (`/panel`, `/influencerlar`, `/mailler`, `/dm`, `/basvurular`, `/uyeler`): influencer bulma,
  tarama, onaylı mail/DM, başvurular ve üye yönetimi.

Kural: hiçbir mail ya da DM, site sahibinin son onayı olmadan gönderilmez.

## Yerelde çalıştırma

```bash
npm install
npm run dev          # http://localhost:3000
```

Ayarlar `.env.local` dosyasında (git'e girmez). Eksik anahtarlar dosyada boş satır olarak işaretli;
değerleri Vercel > Project > Settings > Environment Variables'dan kopyala.

Yönetici şifresini değiştirmek: `npm run hash -- "yeni-uzun-sifre"` çıktısındaki `LUME_PASS_HASH`
satırını hem `.env.local`'e hem Vercel'e yaz.

## Kontroller

```bash
npx tsc --noEmit
npm run lint
node --import ./tests/register.mjs --test tests/*.test.mts
```

## Yapı

| Klasör | İçerik |
|---|---|
| `app/` | Sayfalar ve API rotaları (`app/(panel)` = kreatör paneli) |
| `components/` | Arayüz bileşenleri (`components/site` = herkese açık site) |
| `lib/` | Oturum, Supabase, Gmail, Instagram, arama ve tarama mantığı |
| `sql/` | Supabase tablo betikleri |
| `tests/` | Birim testleri |
| `proxy.ts` | Oturum ve erişim kontrolü (Next 16'da middleware) |

Geliştirme geçmişi: `KATKI.md`.
