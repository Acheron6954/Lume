# Lume paneli: uv-1'e kurulum

1. `uv-1` içindeki eski `app/`, `components/`, `lib/` klasörlerini ve varsa eski `middleware.ts`/`proxy.ts` dosyasını sil (yedeğin var).
2. Bu klasörün içindekileri (`app`, `components`, `lib`, `scripts`, `tests`, `proxy.ts`) `uv-1` içine kopyala. `package.json`, `next.config`, `tsconfig.json`, `postcss.config.mjs` kalsın.
3. `package.json` içindeki `"scripts"` bölümüne şunu ekle: `"hash": "node scripts/hash-password.mjs"`
4. `lume-env.txt` içindeki 3 satırı `uv-1/.env.local` dosyasına yapıştır. Aynı 3 satırı Vercel > Project > Settings > Environment Variables bölümüne de ekle (Production, Preview, Development).
5. `npm run dev` ile aç: http://localhost:3000 → giriş ekranına yönlenir.
6. Şifreyi değiştirmek için: `npm run hash -- "yeni-uzun-sifre"` çıktısındaki `LUME_PASS_HASH` satırını iki yerde de güncelle.

Test: `node --import ./tests/register.mjs --test tests/*.test.mts`
