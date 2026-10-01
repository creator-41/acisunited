(function () {
  const KEY = "acisu_privacy_choices_v1";
  const $ = (selector, root=document) => root.querySelector(selector);
  const read = () => {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || "null");
      return value && value.version === 1 ? value : null;
    } catch (_) { return null; }
  };
  const save = analytics => {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        version: 1, necessary: true, analytics: !!analytics, savedAt: new Date().toISOString()
      }));
      return true;
    } catch (_) { return false; }
  };
  let current = read();
  const style = document.createElement("style");
  style.textContent = `
    .acisu-consent-backdrop{position:fixed;inset:0;z-index:500;background:#000b;display:flex;align-items:flex-end;justify-content:center;padding:16px}
    .acisu-consent-backdrop[hidden]{display:none!important}
    .acisu-consent-panel{width:min(100%,760px);max-height:min(86vh,720px);overflow:auto;background:#160f11;color:#f5eee8;border:1px solid #c1a57b;border-radius:20px;padding:22px;box-shadow:0 20px 70px #000c}
    .acisu-consent-panel h2{font:700 25px Oswald, sans-serif;color:#e9cb9c;margin:0 0 8px}
    .acisu-consent-panel p{font:14px/1.55 Montserrat,sans-serif;color:#d7ceca;margin:8px 0}
    .acisu-consent-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:17px}
    .acisu-consent-actions button,.acisu-consent-panel button{border:1px solid #c1a57b;border-radius:11px;padding:11px 14px;font-weight:700;cursor:pointer}
    .acisu-consent-primary{background:#5c1a21;color:white}.acisu-consent-secondary{background:#24171a;color:#f5eee8}
    .acisu-consent-link{color:#e9cb9c;text-decoration:underline}
    .acisu-consent-toggle{display:flex;align-items:center;gap:12px;background:#24171a;border:1px solid #53363b;border-radius:12px;padding:13px;margin-top:13px}
    .acisu-consent-toggle input{width:20px;height:20px;accent-color:#c1a57b}
    .acisu-consent-close{float:right;background:transparent;color:white}
    @media(min-width:700px){.acisu-consent-backdrop{align-items:center}}
  `;
  document.head.appendChild(style);
  const layer = document.createElement("div");
  layer.className = "acisu-consent-backdrop";
  layer.hidden = true;
  layer.innerHTML = `<section class="acisu-consent-panel" role="dialog" aria-modal="true" aria-labelledby="acisu-consent-title">
    <button class="acisu-consent-close acisu-consent-secondary" type="button" data-close aria-label="Kapat">×</button>
    <h2 id="acisu-consent-title">Gizlilik ve çerez tercihleri</h2>
    <p>Siteyi çalıştırmak için gerekli tarayıcı depolaması kullanılır. İsteğe bağlı site kullanım ölçümü; rastgele ziyaretçi ve oturum kodu, ziyaret edilen bölüm, genel cihaz kategorisi, trafik kaynağı kategorisi ve sponsor gösterim/tıklama olaylarını Acısu United’ın Supabase projesine kaydeder.</p>
    <p>Sayfanın görünmesi ve çalışması için Google Fonts, Tailwind CDN ve jsDelivr’den dosyalar istenir; bu bağlantılarda sağlayıcılar IP adresi gibi ağ metaverisini görebilir. Bu istekler tercih düğmesiyle engellenmez. Düğme yalnızca Acısu United’ın kendi ziyaret ve sponsor ölçümünü açıp kapatır. Ayrıntılar: <a class="acisu-consent-link" href="gizlilik.html">gizlilik ve çerez metni</a>.</p>
    <p>Aydınlatma metnini okumak için onay vermen gerekmez. Tercihin, istediğin zaman bu sayfanın altındaki “Tercihleri düzenle” bağlantısından değiştirilebilir. <a class="acisu-consent-link" href="gizlilik.html">Gizlilik ve çerez metnini oku</a>.</p>
    <label class="acisu-consent-toggle"><input type="checkbox" data-analytics><span><strong>İsteğe bağlı kullanım ölçümü</strong><br><small>Zorunlu değildir; reddedince ziyaret ve sponsor analitiği kaydedilmez.</small></span></label>
    <div class="acisu-consent-actions">
      <button class="acisu-consent-secondary" type="button" data-reject>Yalnızca gerekli olanlar</button>
      <button class="acisu-consent-secondary" type="button" data-save>Seçimlerimi kaydet</button>
      <button class="acisu-consent-primary" type="button" data-accept>Tümünü kabul et</button>
    </div>
  </section>`;
  document.body.appendChild(layer);
  const box = $(".acisu-consent-panel", layer);
  const setVisible = open => { layer.hidden = !open; document.body.style.overflow = open ? "hidden" : ""; };
  const savedAnalytics = () => !!read()?.analytics;
  const show = () => { $("[data-analytics]",box).checked = savedAnalytics(); setVisible(true); };
  const finish = analytics => {
    const previous = savedAnalytics();
    if (!save(analytics)) {
      alert("Tercihin bu cihazda kaydedilemedi. Tarayıcı depolama ayarlarını kontrol edip yeniden dene.");
      return;
    }
    current = read();
    setVisible(false);
    if (previous !== !!analytics) location.reload();
  };
  layer.addEventListener("click", event => { if (event.target === layer) setVisible(false); });
  $("[data-close]",box).addEventListener("click",()=>setVisible(false));
  $("[data-reject]",box).addEventListener("click",()=>finish(false));
  $("[data-accept]",box).addEventListener("click",()=>finish(true));
  $("[data-save]",box).addEventListener("click",()=>finish($("[data-analytics]",box).checked));
  document.addEventListener("click",event => {
    if (event.target.closest("[data-acisu-privacy-settings]")) { event.preventDefault(); show(); }
  });
  window.AcisuPrivacy = {
    allowsAnalytics: savedAnalytics,
    openPreferences: show,
    getPreferences: read
  };
  if (!current) setTimeout(show, 450);
})();