(function () {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(console.warn);
  let promptEvent;
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); promptEvent = e; });
  document.getElementById("admin-install").addEventListener("click", async () => {
    if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) {
      document.getElementById("notice").textContent = "Yönetim uygulaması zaten yüklü.";return;
    }
    if (promptEvent) { promptEvent.prompt(); await promptEvent.userChoice;promptEvent=null;return; }
    document.getElementById("notice").textContent = /iPhone|iPad/i.test(navigator.userAgent)
      ? "Safari'de Paylaş > Ana Ekrana Ekle yolunu kullan."
      : "Tarayıcı menüsünden Uygulamayı yükle / Ana ekrana ekle seç.";
  });
})();
