// Kullanım:
//   npm run hash -- "yeni-sifre"            → LUME_PASS_HASH satırını yazdırır
//   npm run hash -- "yeni-sifre" --secret   → ayrıca yeni bir SESSION_SECRET üretir
// Çıkan satırları .env.local dosyasına (ve Vercel > Settings > Environment Variables) koy.
import { randomBytes, scryptSync } from "node:crypto";

const args = process.argv.slice(2);
const password = args.find((a) => !a.startsWith("--"));
if (!password) {
  console.error('Şifre ver: npm run hash -- "şifren"');
  process.exit(1);
}
const salt = randomBytes(16);
const key = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
console.log(`LUME_PASS_HASH=scrypt:${salt.toString("hex")}:${key.toString("hex")}`);
if (args.includes("--secret")) console.log(`SESSION_SECRET=${randomBytes(48).toString("hex")}`);
