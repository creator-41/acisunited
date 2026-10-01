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
      const link = row.target_kind === "news" ? "./?haber=" : row.target_kind === "player" ? "./?oyuncu=" : "./?mac=";
      return `<a role="listitem" class="acisu-inbox-item" href="${link}${encodeURIComponent(row.target_id)}"><strong>${esc(row.title)}</strong><span>${esc(date(row.created_at))} · ${row.target_kind === "news" ? "Habere git" : row.target_kind === "player" ? "Oyuncu profiline git" : "Maça git"}</span><p>${esc(row.body)}</p></a>`;
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
  // Sponsor ölçümleri oturum başına tekilleştirilir; kişi adı, IP veya tam cihaz modeli alınmaz.
  const sponsorFallbackLogged = new Set();
  function logSponsorEvent(card, eventType) {
    const sponsorId=card?.dataset.sponsorId, sponsorName=card?.dataset.sponsorName;
    if (!sponsorId || !sponsorName) return;
    const key=`acisu_sponsor_${eventType}_${sponsorId}`;
    let already=false;
    try {
      already=sessionStorage.getItem(key)==="1";
      if (!already) sessionStorage.setItem(key,"1");
    } catch {
      if (sponsorFallbackLogged.has(key)) return;
      sponsorFallbackLogged.add(key);
    }
    if (already) return;
    db.from("acisu_sponsor_events").insert({sponsor_id:sponsorId,sponsor_name:sponsorName,visitor_id:visitor,session_id:session,event_type:eventType})
      .then(({error}) => {
        if (error && error.code!=="23505") {
          try { sessionStorage.removeItem(key); } catch { sponsorFallbackLogged.delete(key); }
          console.warn("Sponsor etkileşimi kaydedilemedi",error.message);
        }
      });
  }
  const sponsorBox=document.getElementById("public-sponsors");
  if (sponsorBox && "IntersectionObserver" in window) {
    const sponsorObserver=new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio>=0.25) {
          logSponsorEvent(entry.target,"impression");
          sponsorObserver.unobserve(entry.target);
        }
      });
    },{threshold:[0.25]});
    const observeSponsorCards=()=>sponsorBox.querySelectorAll("[data-sponsor-id]").forEach(card=>sponsorObserver.observe(card));
    observeSponsorCards();
    new MutationObserver(observeSponsorCards).observe(sponsorBox,{childList:true,subtree:true});
  }
  document.addEventListener("click",event => {
    const card=event.target.closest?.('#public-sponsors a[data-sponsor-id]');
    if (card) logSponsorEvent(card,"click");
  },true);
  // Sadece genel cihaz kategorisi kaydedilir; ham user-agent ve cihaz modeli tutulmaz.
  const agent = navigator.userAgent || "";
  const deviceLabel = /iPhone/i.test(agent) ? "iPhone"
    : /iPad/i.test(agent) || (/Macintosh/i.test(agent) && navigator.maxTouchPoints > 1) ? "iPad"
    : /SamsungBrowser|SAMSUNG|\bSM-[A-Z0-9]+\b/i.test(agent) ? "Samsung"
    : /Android/i.test(agent) ? "Android"
    : /Windows/i.test(agent) ? "Windows"
    : /Macintosh|Mac OS X/i.test(agent) ? "Mac"
    : /Linux/i.test(agent) ? "Linux" : "Diğer";
  function detectSource() {
    try {
      const host=new URL(document.referrer).hostname.toLowerCase();
      if(!host) return "Doğrudan";
      if(host==="acisunited.com.tr" || host==="www.acisunited.com.tr" || host.endsWith(".github.io")) return "Site içi";
      if(/instagram/.test(host)) return "Instagram";
      if(/whatsapp|wa\.me/.test(host)) return "WhatsApp";
      if(/google\./.test(host)) return "Google";
      if(/facebook|fb\.me/.test(host)) return "Facebook";
      if(/tiktok/.test(host)) return "TikTok";
      if(/youtube|youtu\.be/.test(host)) return "YouTube";
      return "Diğer site";
    } catch { return "Doğrudan"; }
  }
  let sourceLabel;
  try {
    sourceLabel=sessionStorage.getItem("acisu_visit_source");
    if(!sourceLabel) { sourceLabel=detectSource(); sessionStorage.setItem("acisu_visit_source",sourceLabel); }
  } catch { sourceLabel=detectSource(); }
  const validSections = new Set(["home","squad","fixtures","lineup","stats","news","archive"]);
  let lastSection="";
  function logSection(section) {
    if (!validSections.has(section) || lastSection === section) return;
    lastSection = section;
    db.from("acisu_visits").insert({
      visitor_id:visitor,session_id:session,section,device_label:deviceLabel,source_label:sourceLabel,
      app_mode:window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true
    }).then(({error}) => { if(error) console.warn("Ziyaret kaydedilemedi",error.message); });
  }
  const params = new URLSearchParams(location.search);
  logSection(params.has("mac") ? "fixtures" : params.has("haber") ? "news" : params.has("oyuncu") ? "squad" : "home");
  document.querySelectorAll("#site-tabbar [data-site-tab]").forEach(tab =>
    tab.addEventListener("click",() => logSection(tab.dataset.siteTab)));
})();