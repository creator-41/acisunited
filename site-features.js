(function () {
  const $ = id => document.getElementById(id);
  const url = window.ACISU_SUPABASE_URL, key = window.ACISU_SUPABASE_KEY;
  const esc = v => String(v ?? "").replace(/[&<>"']/g, x =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[x]);
  const dateText = value => new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric"
  }).format(new Date(value));
  let scores = new Map(), initialized = false, installPrompt, audio, statusTimer;
  const status = message => {
    const el = $("app-status"); el.textContent = message;
    clearTimeout(statusTimer); statusTimer = setTimeout(() => { el.textContent = ""; }, 6500);
  };
  const pageIds = {
    home:["ana-sayfa","instagram","sponsorlar"], squad:["kadro","teknik-direktor"], fixtures:["fikstur"], lineup:["mac-kadrosu"],
    stats:["istatistik"], news:["haberler"], archive:["sezonlar"]
  };
  const pageForId = new Map(Object.entries(pageIds).flatMap(([key,ids]) => ids.map(id => [id,key])));
  for (const [key,ids] of Object.entries(pageIds)) for (const id of ids) {
    const page = $(id); if (page) { page.dataset.sitePage = key; page.hidden = key !== "home"; }
  }
  const footer = document.querySelector("body > footer");
  if (footer) { footer.dataset.sitePage = "home"; footer.hidden = false; }
  function showSiteTab(key, scroll = true) {
    if (!pageIds[key]) return;
    for (const page of document.querySelectorAll("[data-site-page]")) page.hidden = page.dataset.sitePage !== key;
    document.querySelectorAll("#site-tabbar [data-site-tab]").forEach(tab =>
      tab.setAttribute("aria-selected", String(tab.dataset.siteTab === key)));
    if (scroll) window.scrollTo({top:0,behavior:"smooth"});
  }
  document.querySelectorAll("#site-tabbar [data-site-tab], [data-site-tab]").forEach(button =>
    button.addEventListener("click", () => showSiteTab(button.dataset.siteTab)));
  document.querySelectorAll("#navbar a[href^='#']").forEach(link => {
    link.addEventListener("click", event => {
      const key = link.dataset.siteTabLink || pageForId.get(link.getAttribute("href").slice(1));
      if (!key) return;
      event.preventDefault(); showSiteTab(key);
    });
  });
  window.showAcisuTab = showSiteTab;
  // Sekme gezinmesi Supabase bağlantısından bağımsız çalışsın.
  if (!url || !key || !window.supabase) return;
  const db = window.acisuDb || (window.acisuDb = window.supabase.createClient(url, key));

  async function loadExtras() {
    const [p, s, n, a, m] = await Promise.all([
      db.from("acisu_players").select("id,name,number").eq("active",true),
      db.from("acisu_player_stats").select("player_id,played,goals,assists,yellow_cards,red_cards"),
      db.from("acisu_news").select("title,body,created_at").eq("published",true).order("created_at",{ascending:false}).limit(8),
      db.from("acisu_seasons").select("*").order("season_year",{ascending:false}),
      db.from("acisu_matches").select("id,our_score,their_score,is_live,played").eq("published",true)
    ]);
    if (p.error || s.error || n.error || a.error || m.error) {
      console.error("Acısu içerikleri yüklenemedi",p.error||s.error||n.error||a.error||m.error); return;
    }
    const rows = (p.data || []).map(player => {
      const own = (s.data || []).filter(x => x.player_id === player.id);
      const sum = field => own.reduce((total,x)=>total+Number(x[field]||0),0);
      const games = own.filter(x=>x.played).length;
      const goals = sum("goals"), assists = sum("assists"), yellow = sum("yellow_cards"), red = sum("red_cards");
      return {player,games,goals,assists,yellow,red,points:games*2+goals*5+assists*2-yellow-red*3};
    }).sort((x,y)=>y.points-x.points || y.goals-x.goals);
    $("public-stats").innerHTML = rows.length ? rows.map(x =>
      `<div class="bg-siyah border border-bordo/40 rounded-xl p-4 flex justify-between gap-3">
        <div><strong class="text-white">#${x.player.number} ${esc(x.player.name)}</strong>
          <p class="text-gray-300 text-xs mt-1">Maç ${x.games} · Gol ${x.goals} · Asist ${x.assists} · Sarı ${x.yellow} · Kırmızı ${x.red}</p></div>
        <strong class="text-altin font-baslik text-2xl">${x.points} P</strong></div>`).join("")
      : '<p class="text-gray-300">Henüz oyuncu istatistiği yok.</p>';
    $("public-news").innerHTML = (n.data || []).length ? n.data.map(x =>
      `<article class="bg-[#1c1215] border border-bordo/40 rounded-xl p-6">
        <small class="text-altin">${esc(dateText(x.created_at))}</small>
        <h3 class="font-baslik text-2xl mt-2 mb-3 text-white">${esc(x.title)}</h3>
        <p class="text-gray-300 text-sm whitespace-pre-line">${esc(x.body)}</p></article>`).join("")
      : '<p class="text-gray-300">Henüz haber yayımlanmadı.</p>';
    $("public-seasons").innerHTML = (a.data || []).length ? a.data.map(x =>
      `<article class="bg-siyah border border-bordo/40 rounded-xl p-6">
        <h3 class="font-baslik text-2xl text-altin mb-2">${x.season_year} Sezonu</h3>
        <p class="text-gray-200 text-sm">${x.matches_count} maç · ${x.wins} galibiyet · ${x.draws} beraberlik · ${x.losses} mağlubiyet</p>
        <p class="text-gray-300 text-sm mt-1">Gol: ${x.goals_for} - ${x.goals_against}</p>
        <p class="text-gray-300 text-sm mt-2">⚽ ${esc(x.top_scorer||"-")} · 🎯 ${esc(x.top_assister||"-")}</p>
        ${x.note ? `<p class="text-gray-400 text-sm mt-3">${esc(x.note)}</p>` : ""}</article>`).join("")
      : '<p class="text-gray-300">Sezon arşivi henüz oluşturulmadı.</p>';
    const current = new Map((m.data || []).map(x => [x.id,{
      us:Number(x.our_score || 0),them:Number(x.their_score || 0),live:x.is_live
    }]));
    if (initialized && [...current].some(([id, value]) => {
      const old = scores.get(id);
      return old?.live && value.us > old.us;
    })) goalFx();
    scores=current; initialized=true;
  }
  function unlockAudio() {
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
    } catch (_) {}
  }
  document.addEventListener("pointerdown",unlockAudio,{once:true});
  function goalFx() {
    if (document.hidden) return;
    navigator.vibrate?.(100);
    try {
      if (audio?.state === "running") {
        const now=audio.currentTime, gain=audio.createGain(), tone=audio.createOscillator();
        tone.type="triangle";tone.frequency.setValueAtTime(400,now);
        tone.frequency.exponentialRampToValueAtTime(800,now+.35);
        gain.gain.setValueAtTime(.001,now);gain.gain.exponentialRampToValueAtTime(.15,now+.05);
        gain.gain.exponentialRampToValueAtTime(.001,now+.9);
        tone.connect(gain);gain.connect(audio.destination);tone.start(now);tone.stop(now+1);
      }
    } catch (_) {}
    document.querySelector(".acisu-goal-flash")?.remove();
    const fx=document.createElement("div");fx.className="acisu-goal-flash";fx.textContent="⚽ GOL!";
    document.body.appendChild(fx);setTimeout(()=>fx.remove(),1700);
  }
  function urlBase64ToBytes(value) {
    const b64=value.replace(/-/g,"+").replace(/_/g,"/");
    return Uint8Array.from(atob(b64.padEnd(Math.ceil(b64.length/4)*4,"=")),c=>c.charCodeAt(0));
  }
  async function install() {
    if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) return;
    if (installPrompt) {
      installPrompt.prompt();const result=await installPrompt.userChoice;
      if (result.outcome === "accepted") $("install-app-banner").hidden = true;
      installPrompt=null;return;
    }
    status(/iPhone|iPad/i.test(navigator.userAgent)
      ? "Safari'de Paylaş → Ana Ekrana Ekle yolunu kullan."
      : "Tarayıcı menüsünden 'Uygulamayı yükle' veya 'Ana ekrana ekle' seç.");
  }
  function closeInstallPrompt() {
    $("install-app-banner").hidden = true;
    sessionStorage.setItem("acisu_install_prompt_closed", "1");
  }
  function closePushPrompt() {
    $("push-prompt").hidden = true;
    sessionStorage.setItem("acisu_push_prompt_closed", "1");
  }
  function showInstallPrompt() {
    if (sessionStorage.getItem("acisu_install_prompt_closed") === "1"
      || window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) return;
    if (/iPhone|iPad/i.test(navigator.userAgent))
      $("install-app-sub").textContent = "Safari Paylaş menüsünden Ana Ekrana Ekle.";
    setTimeout(() => { $("install-app-banner").hidden = false; }, 700);
  }
  function maybeShowPushPrompt() {
    if (sessionStorage.getItem("acisu_push_prompt_closed") === "1"
      || !window.Notification || Notification.permission !== "default"
      || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (/iPhone|iPad/i.test(navigator.userAgent)
      && !window.matchMedia("(display-mode: standalone)").matches && !window.navigator.standalone) return;
    setTimeout(() => { $("push-prompt").hidden = false; }, 1500);
  }
  function updateBell() {
    const bell = $("enable-push");
    const dot = bell?.querySelector("span");
    if (dot && window.Notification?.permission === "granted") dot.hidden = true;
  }
  async function enablePush() {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      status("Bu tarayıcı bildirimleri desteklemiyor.");return;
    }
    if (/iPhone|iPad/i.test(navigator.userAgent)
      && !window.matchMedia("(display-mode: standalone)").matches && !window.navigator.standalone) {
      status("iPhone'da önce siteyi ana ekrana ekleyip uygulamadan aç.");return;
    }
    try {
      const registration=await navigator.serviceWorker.ready;
      const permission=await Notification.requestPermission();
      if(permission!=="granted"){status("Bildirim izni verilmedi.");return;}
      const {data:config,error:configError}=await db.functions.invoke("acisu-push",{body:{action:"config"}});
      if(configError || !config?.publicKey) throw configError||new Error("Bildirim anahtarı alınamadı.");
      const subscription=await registration.pushManager.getSubscription()
        || await registration.pushManager.subscribe({userVisibleOnly:true,
          applicationServerKey:urlBase64ToBytes(config.publicKey)});
      const {data,error}=await db.functions.invoke("acisu-push",{body:{action:"subscribe",subscription:subscription.toJSON()}});
      if(error || data?.error) throw error||new Error(data.error);
      status("Bildirimler açıldı! 🔔");
    } catch(e) {status("Bildirim açılamadı: "+(e.message||"Bilinmeyen hata"));}
  }
  window.addEventListener("beforeinstallprompt", e=>{e.preventDefault();installPrompt=e;});
  $("install-app").addEventListener("click",install);
  $("close-install-banner").addEventListener("click",closeInstallPrompt);
  $("enable-push").addEventListener("click",enablePush);
  $("close-push-prompt").addEventListener("click",closePushPrompt);
  $("later-push-prompt").addEventListener("click",closePushPrompt);
  $("accept-push-prompt").addEventListener("click",async()=>{closePushPrompt();await enablePush();updateBell();});
  $("push-prompt").addEventListener("click",e=>{if(e.target.id==="push-prompt")closePushPrompt();});
  window.addEventListener("appinstalled",()=>{$("install-app-banner").hidden=true;});
  showInstallPrompt(); maybeShowPushPrompt(); updateBell();
  showSiteTab("home", false);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(console.warn);
  loadExtras();
  db.channel("acisu-live-site").on("postgres_changes",
    {event:"UPDATE",schema:"public",table:"acisu_matches"}, async () => {
      await window.acisuReloadSite?.();await loadExtras();
    }).subscribe();
  document.addEventListener("visibilitychange",()=>{
    if(!document.hidden){window.acisuReloadSite?.();loadExtras();}
  });
})();
