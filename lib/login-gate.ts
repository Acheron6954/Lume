// "Siteye her girişte şifre sor" kuralı. Tarayıcı sekmesi (sessionStorage) hangi sayfa yüklemesinde
// giriş yapıldığını hatırlar. Aynı yüklemede gezinmek, sayfayı yenilemek ya da geri/ileri gitmek giriş
// istemez; yeni sekme açmak veya adresi yeniden yazıp girmek ister.
const KEY = "lume-auth-doc";

/** Bu sayfa yüklemesinin kimliği (her tam yüklemede değişir). */
const docId = () => String(performance.timeOrigin);

/** Giriş formu gönderilirken çağrılır: bu yüklemeyi "giriş yapılmış" olarak işaretler. */
export function markLoggedIn(): void {
  try {
    sessionStorage.setItem(KEY, docId());
  } catch {}
}

/** Panel açıldığında çağrılır: true ise oturum kapatılıp giriş ekranı gösterilmeli. */
export function needsLogin(): boolean {
  try {
    const cur = docId();
    const stored = sessionStorage.getItem(KEY);
    if (stored === cur) return false;
    const type = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type;
    if (stored && (type === "reload" || type === "back_forward")) {
      sessionStorage.setItem(KEY, cur);
      return false;
    }
    return true;
  } catch {
    // Depolama kapalıysa kimin girdiği izlenemez; kullanıcıyı sonsuz döngüye sokmamak için geç.
    return false;
  }
}
