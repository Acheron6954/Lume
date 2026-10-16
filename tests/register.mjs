// Testleri uzantısız import'larla ("./influencer") çalıştırmak için. Kullanım:
//   node --import ./tests/register.mjs --test tests/*.test.mts
import { register } from "node:module";
register("./resolver.mjs", import.meta.url);
