# Katkı Kaydı

Bu dosya, Lume kreatör panelinin (bu depo: `uv-1`) hangi modüllerinin kim
tarafından, ne zaman geliştirildiğini belgelemek için tutulur. Kaynak: `git log`.

**Geliştirici:** Umut (GitHub: Acheron6954, e-posta: umutlume695418@gmail.com)
— depo başlangıcından bu yana tüm commit'lerin sahibi.

## Modül Geçmişi

| Tarih | Modül / Değişiklik |
|---|---|
| 2026-08-12 | İlk yükleme, site başlığı Lume olarak güncellendi |
| 2026-08-13 | Kullanıcılar, satın alma / sipariş geçmişi (eski POS modülü) |
| 2026-10-16 | Yeni Lume kreatör paneli: şifreli giriş, karadelik açılışı, influencer listesi, mail kontrol |
| 2026-10-16 | Instagram tarama: aday doğrulama ve etkileşim hesabı |
| 2026-10-16 | Paneli Supabase `influencers` tablosuna bağlama, etkileşim oranı hesaplama |
| 2026-10-16 | Günlük aday arama: Brave Search API + otomatik doğrulama |
| 2026-10-16 | Marka: favicon, başlık, Acheron ajan adı |
| 2026-10-16 | Influencer listesine sıralama düğmeleri |
| 2026-10-17 | Karadelik: WebGL ışık bükülmeli (gravitational lensing) yeni animasyon |
| 2026-10-17 | Salt okunur (viewer) kullanıcı rolü: görür, gezer, değiştiremez |
| 2026-10-17 | Giriş animasyonu her girişte oynar; siteye şifre koruması |
| 2026-10-18 | Bio linkinden TikTok ve e-posta bulma (Linkleri Tara) |
| 2026-10-18 | DM Kontrol sayfası: yarı otomatik Instagram/TikTok DM taslağı |
| 2026-10-18 | Gmail bağlantısı: OAuth ile bağlama ve onaylı mail gönderimi |
| 2026-10-19 | 404 sayfası, robots.txt |
| 2026-10-19 | KATKI.md: geliştirme katkı kaydı |
| 2026-10-19 | Güvenlik başlıkları: CSP, HSTS, X-Frame-Options, Permissions-Policy |
| 2026-11-09 | Yanıt takibi (gmail.metadata) ve DM kayıtlarının Supabase'e taşınması |
| 2026-11-09 | Gmail bağlama: hata nedeni panelde, Safari için Google dönüş ara sayfası |
| 2026-11-09 | SQL: gmail_auth, sent_mail, dm tabloları için sunucu yetkileri |
| 2026-11-09 | Herkese açık kreatör sitesi: tanıtım sayfası, kreatör başvuru formu, üye ol / giriş |
| 2026-11-09 | Panelde Başvurular ve Üyeler sayfaları; onaylı panel erişimi |
| 2026-11-23 | Site herkese açık: kayıtlı üye giriş yapar, panel yalnızca erişim verilen üyelere görünür |
| 2026-11-23 | Kayıt sonrası otomatik giriş; Üyeler sayfasında erişim ver / kaldır / engelle |
| 2026-11-23 | Bakım: lint düzeltmeleri, yerel ortam ayar şablonu, README |

## Not

Bu kayıt, geliştirme sürecinin dayanağıdır; `git log` ile tarihleri her an
doğrulanabilir. Projeye başka biri katkı verdiğinde adı ve tarihi buraya
eklenecektir.
