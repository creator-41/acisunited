(function () {
  const db = window.acisuDb;
  const bell = document.getElementById("enable-push");
  if (!db || !bell) return;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
  const style = document.createElement("style");
  style.textContent = `
    .acisu-inbox{position:fixed;z-index:110;top:max(88px,calc(env(safe-area-inset-top) + 70px));right:12px;width:min(420px,calc(100vw - 24px));max-height:min(70vh,640px);overflow:auto;background:#190e12;color:#f6efeb;border:1px solid #c1a57b;border-radius:18px;box-shadow:0 20px 60px #000c;padding:18px}
    .acisu-inbox[hidden]{display:none!important}.acisu-inbox-head{display:flex;justify-content:space-between;align-items:center;gap:12px}
    .acisu-inbox h2{font:700 23px Oswald,sans-serif;color:#e9cb9c}.acisu-inbox button{cursor:pointer}
    .acisu-inbox-close{border:1px solid #806768;border-radius:50%;width:36px;height:36px}
    .acisu-inbox-list{margin-top:14px;display:grid;gap:8px}.acisu-inbox-item{display:block;text-decoration:none;background:#2a161c;border:1px solid #5c343b;border-radius:12px;padding:12px;color:#fff}
    .acisu-inbox-item:focus-visible,.acisu-inbox-item:hover{outline:2px solid #c1a57b}.acisu-inbox-item strong{display:block;font-weight:700}.acisu-inbox-item span{display:block;font-size:12px;color:#c1a57b;margin-top:4px}.acisu-inbox-item p{font-size:13px;color:#d9d0ce;margin-top:5px}
    .acisu-inbox-permission{width:100%;background:#5c1a21;color:#fff;border:1px solid #c1a57b;border-radius:10px;padding:10px;margin-top:12px;font-weight:700}
  `;
  document.head.appendChild(style);
  const box = document.createElement("section");
  box.className = "acisu-inbox";
  box.hidden = true;
  box.setAttribute("aria-label","Bildirim geçmişi");
  box.innerHTML = '<div class="acisu-inbox-head"><h2>🔔 Bildirimler</h2><button type="button" class="acisu-inbox-close" aria-label="Bildirimleri kapat">×</button></div><button type="button" class="acisu-inbox-permission">Bildirimleri aç</button><div class="acisu-inbox-list" role="list">Yükleniyor…</div>';
  document.body.appendChild(box);
  const close = () => { box.hidden=true; bell.setAttribute("aria-expanded","false"); };
  const date = iso => new Intl.DateTimeFormat("tr-TR",{timeZone:"Europe/Istanbul",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(iso));
  async function loadInbox() {
    const list = box.querySelector(".acisu-inbox-list");
    const { data, error } = await db.from("acisu_notifications")
      .select("id,title,body,target_kind,target_id,created_at").order("created_at",{ascending:false}).limit(50);
    if (error) { list.textContent="Bildirimler yüklenemedi."; return; }
    list.innerHTML = data?.length ? data.map(row => {
      const link = row.target_kind === "news" ? "./?haber=" : "./?mac=";
      return `<a role="listitem" class="acisu-inbox-item" href="${link}${encodeURIComponent(row.target_id)}"><strong>${esc(row.title)}</strong><span>${esc(date(row.created_at))} · ${row.target_kind === "news" ? "Habere git" : "Maça git"}</span><p>${esc(row.body)}</p></a>`;
    }).join("") : '<p>Henüz bildirim yok.</p>';
  }
  bell.setAttribute("aria-label","Bildirim geçmişini aç");
  bell.setAttribute("title","Bildirimler");
  bell.setAttribute("aria-expanded","false");
  bell.addEventListener("click", () => {
    box.hidden = !box.hidden;
    bell.setAttribute("aria-expanded",String(!box.hidden));
    box.querySelector(".acisu-inbox-permission").hidden = window.Notification?.permission === "granted";
    if (!box.hidden) loadInbox();
  });
  box.querySelector(".acisu-inbox-close").addEventListener("click",close);
  box.querySelector(".acisu-inbox-permission").addEventListener("click",async () => {
    await window.acisuEnablePush?.();
    box.querySelector(".acisu-inbox-permission").hidden = window.Notification?.permission === "granted";
  });
  document.addEventListener("pointerdown",event => { if (!box.hidden && !box.contains(event.target) && !bell.contains(event.target)) close(); });
  document.addEventListener("keydown",event => { if (event.key === "Escape" && !box.hidden) {close();bell.focus();} });
  document.addEventListener("visibilitychange",() => { if (!document.hidden && !box.hidden) loadInbox(); });

  // Anonim cihaz kimliği: isim, IP, konum veya tarayıcı parmak izi toplanmaz.
  const getId = (storage,key) => {
    try { let id=storage.getItem(key); if(!id){id=crypto.randomUUID();storage.setItem(key,id);}return id; }
    catch { return crypto.randomUUID(); }
  };
  const visitor = getId(localStorage,"acisu_visitor_id");
  const session = getId(sessionStorage,"acisu_visit_session");
  const validSections = new Set(["home","squad","fixtures","lineup","stats","news","archive"]);
  let lastSection="";
  function logSection(section) {
    if (!validSections.has(section) || lastSection === section) return;
    lastSection = section;
    db.from("acisu_visits").insert({
      visitor_id:visitor,session_id:session,section,
      app_mode:window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true
    }).then(({error}) => { if(error) console.warn("Ziyaret kaydedilemedi",error.message); });
  }
  const params = new URLSearchParams(location.search);
  logSection(params.has("mac") ? "fixtures" : params.has("haber") ? "news" : "home");
  document.querySelectorAll("#site-tabbar [data-site-tab]").forEach(tab =>
    tab.addEventListener("click",() => logSection(tab.dataset.siteTab)));
})();