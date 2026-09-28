(function () {
  const status = document.getElementById("admin-push-status");
  const enable = document.getElementById("admin-enable-push");
  const test = document.getElementById("admin-test-push");
  const remote = document.getElementById("admin-remote-test");
  const isInstalled = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const supported = () => "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
  const setStatus = message => { if (status) status.textContent = message; };
  const bytes = key => {
    const base64 = key.replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")), c => c.charCodeAt(0));
  };

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(console.warn);
  let promptEvent;
  window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); promptEvent = event; });
  document.getElementById("admin-install")?.addEventListener("click", async () => {
    if (isInstalled()) {
      document.getElementById("notice").textContent = "Yönetim uygulaması zaten yüklü."; return;
    }
    if (promptEvent) { promptEvent.prompt(); await promptEvent.userChoice; promptEvent = null; return; }
    document.getElementById("notice").textContent = isIOS
      ? "Safari'de Paylaş > Ana Ekrana Ekle yolunu kullan."
      : "Tarayıcı menüsünden Uygulamayı yükle / Ana ekrana ekle seç.";
  });

  async function refreshPushState() {
    if (!supported()) { setStatus("Bu tarayıcı bildirimleri desteklemiyor."); test.disabled = true; return; }
    if (isIOS && !isInstalled()) {
      setStatus("iPhone'da yönetim panelini ana ekrana ekleyip uygulamadan aç.");
      test.disabled = true; return;
    }
    test.disabled = Notification.permission !== "granted";
    if (Notification.permission === "denied") { setStatus("Bildirim izni kapalı. iPhone Ayarlar > Bildirimler > Acısu Admin bölümünden aç."); return; }
    if (Notification.permission !== "granted") { setStatus("Bu yönetim uygulamasında bildirimler henüz açılmadı."); return; }
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setStatus(subscription ? "Bu cihazın push aboneliği açık. Test bildirimiyle ekranı kontrol edebilirsin."
        : "İzin var, fakat bu yönetim uygulaması push bildirimlerine henüz kayıtlı değil. Bu cihazda aç'a dokun.");
    } catch (error) { setStatus("Bildirim durumu kontrol edilemedi: " + error.message); }
  }

  enable?.addEventListener("click", async () => {
    if (!supported()) { setStatus("Bu tarayıcı bildirimleri desteklemiyor."); return; }
    if (isIOS && !isInstalled()) { setStatus("Önce yönetim panelini ana ekrana ekleyip oradan aç."); return; }
    // iPhone izin penceresini doğrudan dokunuş sırasında aç.
    const permission = await Notification.requestPermission();
    if (permission !== "granted") { await refreshPushState(); return; }
    enable.disabled = true;
    setStatus("Bu cihaz push bildirimlerine kaydediliyor…");
    try {
      const db = window.acisuAdmin?.db;
      if (!db) throw new Error("Önce yönetici girişi yap.");
      const registration = await navigator.serviceWorker.ready;
      const { data: config, error: configError } = await db.functions.invoke("acisu-push", { body: { action: "config" } });
      if (configError || !config?.publicKey) throw configError || new Error("Bildirim anahtarı alınamadı.");
      const subscription = await registration.pushManager.getSubscription()
        || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(config.publicKey) });
      const { data, error } = await db.functions.invoke("acisu-push", {
        body: { action: "subscribe", subscription: subscription.toJSON() }
      });
      if (error || data?.error) throw error || new Error(data.error);
      setStatus("Bu cihaz push bildirimlerine kaydedildi. Şimdi test bildirimini göster.");
      test.disabled = false;
    } catch (error) { setStatus("Cihaz kaydedilemedi: " + (error.message || "Bilinmeyen hata")); }
    finally { enable.disabled = false; }
  });

  test?.addEventListener("click", async () => {
    if (!supported() || Notification.permission !== "granted") { setStatus("Önce bu cihazda bildirimleri aç."); return; }
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("Acısu United test", {
        body: "Bu bildirim görünüyorsa cihazın bildirim ekranı çalışıyor.",
        icon: "./image_09a3ea.png", tag: "acisu-local-test-" + Date.now(),
        data: { url: "./admin.html" }
      });
      setStatus("Test bildirimi telefona gösterilmek üzere verildi. Ekranı ve Bildirim Merkezi'ni kontrol et.");
    } catch (error) { setStatus("Test bildirimi gösterilemedi: " + (error.message || "Bilinmeyen hata")); }
  });
  remote?.addEventListener("click", async () => {
    if (!supported() || Notification.permission !== "granted") {
      setStatus("Önce bu cihazda bildirimleri aç."); return;
    }
    remote.disabled = true;
    try {
      const db = window.acisuAdmin?.db;
      if (!db) throw new Error("Önce yönetici girişi yap.");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) throw new Error("Bu cihaz kayıtlı değil. Önce 'Bu cihazda aç' düğmesine dokun.");
      const { data, error } = await db.functions.invoke("acisu-push", {
        body: { action: "test", endpoint: subscription.endpoint }
      });
      if (error || data?.error) throw error || new Error(data.error);
      setStatus(data?.accepted
        ? "Push servisi yalnızca bu cihazın testini kabul etti. Bildirim Merkezi'ni kontrol et."
        : "Push servisi bu cihazı reddetti (HTTP " + (data?.status || "?") + "). Yeniden bildirimleri açmayı dene.");
    } catch (error) {
      setStatus("Sunucu testi başarısız: " + (error.message || "Bilinmeyen hata"));
    } finally { remote.disabled = false; }
  });
  refreshPushState();
})();
