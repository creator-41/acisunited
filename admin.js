(function () {
  const $ = id => document.getElementById(id);
  let noticeTimer;
  const notice = message => {
    $("notice").textContent = message;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { $("notice").textContent = ""; }, 7000);
  };
  if (!window.ACISU_SUPABASE_URL || !window.ACISU_SUPABASE_KEY || !window.supabase) {
    notice("Önce supabase-config.js dosyasına Acısu projesinin URL ve publishable key değerlerini gir.");
    $("login-form").hidden = true;
    return;
  }
  const db = window.supabase.createClient(window.ACISU_SUPABASE_URL, window.ACISU_SUPABASE_KEY);
  const photoBucket = "acisu-player-photos";
  const mediaBucket = "acisu-site-media";
  const photoTypes = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const photoPrefix = `${window.ACISU_SUPABASE_URL}/storage/v1/object/public/${photoBucket}/`;
  const storedPhotoPath = url => url.startsWith(photoPrefix) ? url.slice(photoPrefix.length) : null;
  const mediaPrefix = `${window.ACISU_SUPABASE_URL}/storage/v1/object/public/${mediaBucket}/`;
  const storedMediaPath = url => url.startsWith(mediaPrefix) ? url.slice(mediaPrefix.length) : null;
  const validPhoto = file => !file || (photoTypes[file.type] && file.size > 0 && file.size <= 5 * 1024 * 1024);
  const previews = new Map();
  function showPreview(id, src, file) {
    if (previews.has(id)) URL.revokeObjectURL(previews.get(id));
    previews.delete(id);
    const image = $(id);
    image.hidden = !src && !file;
    if (file) {
      const url = URL.createObjectURL(file);
      previews.set(id, url);
      image.src = url;
    } else if (src) image.src = src;
    else image.removeAttribute("src");
  }
  async function uploadMedia(file, folder) {
    const path = `${folder}/${crypto.randomUUID()}.${photoTypes[file.type]}`;
    const { error } = await db.storage.from(mediaBucket).upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return { path, url: db.storage.from(mediaBucket).getPublicUrl(path).data.publicUrl };
  }
  async function removeMedia(url) {
    const path = storedMediaPath(url || "");
    if (!path) return;
    const { error } = await db.storage.from(mediaBucket).remove([path]);
    if (error) console.warn("Eski görsel silinemedi:", error);
  }
  let previewUrl;
  function showPhoto(src) {
    const preview = $("photo-preview");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    preview.hidden = !src;
    if (src) preview.src = src;
    else preview.removeAttribute("src");
  }
  $("player-form").addEventListener("reset", () => setTimeout(() => showPhoto(""), 0));
  $("player-form").elements.namedItem("photo").addEventListener("change", e => {
    const file = e.target.files?.[0];
    if (file) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(file);
      $("photo-preview").src = previewUrl;
      $("photo-preview").hidden = false;
    } else showPhoto($("player-form").elements.namedItem("image_url").value);
  });
  for (const [kind, preview, fileName, oldName] of [
    ["staff", "staff-photo-preview", "photo", "image_url"],
    ["match", "opponent-photo-preview", "opponent_photo", "opponent_image_url"]
  ]) {
    const form = $(kind + "-form");
    form.addEventListener("reset", () => setTimeout(() => showPreview(preview, ""), 0));
    if (kind === "match") form.addEventListener("reset", () => setTimeout(() => renderMatchGoalAssignments([]), 0));
    form.elements.namedItem(fileName).addEventListener("change", e =>
      showPreview(preview, form.elements.namedItem(oldName).value, e.target.files?.[0]));
  }
  let players = [], matches = [], staff = [], sponsors = [];
  let editingMatchId = null;
  let matchGoalRoster = [];
  let matchHasSpecificLineup = false;
  function setMatchFormMode(matchId = null) {
    const form = $("match-form");
    editingMatchId = matchId || null;
    matchGoalRoster = editingMatchId ? [] : players.filter(p => p.active).map(p => ({...p, role:""}));
    matchHasSpecificLineup = false;
    form.dataset.mode = editingMatchId ? "edit" : "create";
    form.elements.namedItem("id").value = editingMatchId || "";
  }
  const tabs = [...document.querySelectorAll("#admin-tabs [role=tab]")];
  function activateTab(name, focus = false) {
    for (const tab of tabs) {
      const active = tab.dataset.tab === name;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      $(tab.getAttribute("aria-controls")).hidden = !active;
      if (active && focus) tab.focus();
    }
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
    tab.addEventListener("keydown", e => {
      if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
      e.preventDefault();
      const target = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1
        : (index + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      activateTab(tabs[target].dataset.tab, true);
    });
  });
  function editor(kind, open, editing = false) {
    $(kind + "-editor").hidden = !open;
    $(kind + "-form-title").textContent = editing
      ? ({player:"Oyuncuyu düzenle",staff:"Kişiyi düzenle",match:"Maçı düzenle"})[kind]
      : ({player:"Yeni oyuncu",staff:"Yeni kişi",match:"Yeni maç"})[kind];
    if (open) $(kind + "-editor").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  document.querySelectorAll("[data-open-form]").forEach(button => button.addEventListener("click", () => {
    const kind = button.dataset.openForm;
    const targetTab = kind === "player" ? "players" : kind === "match" ? "matches" : kind === "staff" ? "staff" : null;
    if (targetTab) activateTab(targetTab);
    $(kind + "-form").reset();
    if (kind === "match") { setMatchFormMode(); renderMatchGoalAssignments([]); }
    editor(kind, true);
  }));
  document.querySelectorAll("[data-close-form]").forEach(button => button.addEventListener("click", () => {
    const kind = button.dataset.closeForm;
    if (kind === "match") { setMatchFormMode(); renderMatchGoalAssignments([]); }
    $(kind + "-form").reset();
    editor(kind, false);
  }));
  const formValue = (form, key) => form.elements.namedItem(key).value.trim();
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  function selectedMatchGoalEvents() {
    const box = $("match-goal-assignments");
    const scorers = [...box.querySelectorAll(".match-goal-scorer")];
    const assists = [...box.querySelectorAll(".match-goal-assist")];
    return scorers.map((scorer, index) => ({
      scorer_id: scorer.value || null, assist_id: assists[index]?.value || null
    }));
  }
  function renderMatchGoalAssignments(initialEvents) {
    const box = $("match-goal-assignments"), hint = $("match-goal-assignment-hint");
    const oldEvents = initialEvents ?? selectedMatchGoalEvents();
    const form = $("match-form");
    const count = form.elements.namedItem("played").checked
      ? Number(form.elements.namedItem("our_score").value || 0) : 0;
    box.replaceChildren();
    if (!count) {
      hint.textContent = matchGoalRoster.length
        ? matchHasSpecificLineup ? "Acısu golü yoksa oyuncu seçimi gerekmiyor." : "Bu maç için özel kadro yok; golcüleri aktif oyuncu listesinden seçebilirsin."
        : "Önce bu maçın kadrosunu Maç Kadrosu sekmesinden kaydet.";
      form.elements.namedItem("goal_scorers").value = "";
      return;
    }
    if (!matchGoalRoster.length) {
      hint.textContent = "Golcü ve asist seçmek için önce bu maçın kadrosunu Maç Kadrosu sekmesinden kaydet.";
      form.elements.namedItem("goal_scorers").value = "";
      return;
    }
    hint.textContent = `${matchHasSpecificLineup ? "Oyuncular bu maçın kadrosundan geliyor. " : "Bu maçta özel kadro seçilmedi; aktif oyuncular listeleniyor. "}Her Acısu golü için golcüyü seç. Asist yoksa ‘Asist yok’ kalsın.`;
    const options = matchGoalRoster.map(p => `<option value="${escapeHtml(p.id)}">#${p.number} ${escapeHtml(p.name)}${p.role === "yedek" ? " · Yedek" : ""}</option>`).join("");
    for (let i = 0; i < count; i++) {
      const event = oldEvents[i] || {};
      const row = document.createElement("div");
      row.className = "grid sm:grid-cols-2 gap-2 rounded-lg bg-white/5 p-3";
      row.innerHTML = `<label class="field text-xs">${i + 1}. gol · Golcü<select class="match-goal-scorer mt-1"><option value="">Oyuncu seç</option>${options}</select></label>
        <label class="field text-xs">Asist<select class="match-goal-assist mt-1"><option value="">Asist yok</option>${options}</select></label>`;
      row.querySelector(".match-goal-scorer").value = event.scorer_id || "";
      row.querySelector(".match-goal-assist").value = event.assist_id || "";
      box.appendChild(row);
    }
    updateMatchGoalScorersText();
  }
  function updateMatchGoalScorersText() {
    const groups = new Map();
    selectedMatchGoalEvents().forEach(event => {
      const player = matchGoalRoster.find(p => p.id === event.scorer_id);
      if (player) groups.set(player.id, { player, count: (groups.get(player.id)?.count || 0) + 1 });
    });
    $("match-form").elements.namedItem("goal_scorers").value = [...groups.values()]
      .map(({player,count}) => `${player.name}${count > 1 ? ` ${count}` : ""}`).join(", ");
  }
  async function loadMatchGoalAssignments(match) {
    const [lineupResult, eventResult, statsResult] = await Promise.all([
      db.from("acisu_match_lineup").select("player_id,role").eq("match_id", match.id),
      db.from("acisu_goal_log").select("side,scorer_id,assist_id,created_at").eq("match_id", match.id).eq("side", "acisu").order("created_at"),
      db.from("acisu_player_stats").select("player_id,goals,assists").eq("match_id", match.id)
    ]);
    if (lineupResult.error || eventResult.error || statsResult.error)
      throw lineupResult.error || eventResult.error || statsResult.error;
    const lineup = lineupResult.data || [];
    matchHasSpecificLineup = lineup.length > 0;
    matchGoalRoster = (matchHasSpecificLineup ? lineup.map(row => ({
      ...players.find(p => p.id === row.player_id), id: row.player_id, role: row.role
    })) : players.filter(p => p.active).map(p => ({...p, role:""})))
      .filter(p => p.name).sort((a,b) => a.number - b.number);
    const score = Number(match.our_score || 0), logged = eventResult.data || [];
    let events = logged.map(g => ({scorer_id:g.scorer_id, assist_id:g.assist_id}));
    if (events.length !== score) {
      const statMap = new Map((statsResult.data || []).map(s => [s.player_id, s]));
      const scorers = matchGoalRoster.flatMap(p => Array(Number(statMap.get(p.id)?.goals || 0)).fill(p.id));
      const assisters = matchGoalRoster.flatMap(p => Array(Number(statMap.get(p.id)?.assists || 0)).fill(p.id));
      const knownSingleAssist = score === 1 && assisters.length === 1 ? assisters[0] : "";
      events = Array.from({length:score}, (_,i) => ({scorer_id:scorers[i] || "", assist_id:knownSingleAssist}));
    }
    renderMatchGoalAssignments(events);
  }
  const localInput = iso => {
    const d = new Date(iso);
    const parts = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit",
      day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).format(d);
    return parts.replace(" ", "T");
  };
  const toIso = local => new Date(local + ":00+03:00").toISOString();
  $("match-form").addEventListener("input", e => {
    if (e.target.name === "our_score") renderMatchGoalAssignments();
  });
  $("match-form").addEventListener("change", e => {
    if (e.target.name === "played") renderMatchGoalAssignments();
    if (e.target.matches(".match-goal-scorer, .match-goal-assist")) updateMatchGoalScorersText();
  });

  async function refresh() {
    const [p, m, s, sp] = await Promise.all([
      db.from("acisu_players").select("*").order("number"),
      db.from("acisu_matches").select("*").order("match_at", { ascending: false }),
      db.from("acisu_staff").select("*").order("sort_order").order("created_at"),
      db.from("acisu_sponsors").select("*").order("sort_order")
    ]);
    if (p.error || m.error || s.error || sp.error) throw p.error || m.error || s.error || sp.error;
    players = p.data || []; matches = m.data || []; staff = s.data || []; sponsors = sp.data || [];
    $("player-count").textContent = players.length;
    $("staff-count").textContent = staff.length;
    $("match-count").textContent = matches.length;
    $("stat-players").textContent = players.filter(x => x.active).length;
    $("stat-matches").textContent = matches.length;
    $("stat-played").textContent = matches.filter(x => x.played).length;
    $("stat-live").textContent = matches.filter(x => x.is_live).length;
    $("stat-sponsors").textContent = sponsors.filter(x => x.active).length;
    window.dispatchEvent(new Event("acisu:admin-refreshed"));
    $("players-list").innerHTML = players.map(x => `<div class="list-row">
      <span><strong class="text-white">#${x.number} ${escapeHtml(x.name)}</strong><span class="block muted text-xs mt-1">${escapeHtml(x.position)} ${x.active ? "" : "· Gizli"}</span></span>
      <span class="list-actions"><button data-edit-player="${x.id}" type="button">Düzenle</button>
      <button data-delete-player="${x.id}" type="button">Sil</button></span></div>`).join("") || '<p class="muted py-5">Henüz oyuncu yok. Oyuncu ekle düğmesiyle başla.</p>';
    $("staff-list").innerHTML = staff.map(x => `<div class="list-row">
      <span><strong class="text-white">${escapeHtml(x.name)}</strong><span class="block muted text-xs mt-1">${escapeHtml(x.role)} ${x.active ? "" : "· Gizli"}</span></span>
      <span class="list-actions"><button data-edit-staff="${x.id}" type="button">Düzenle</button>
      <button data-delete-staff="${x.id}" type="button">Sil</button></span></div>`).join("") || '<p class="muted py-5">Henüz teknik heyet üyesi yok.</p>';
    const coachSelect = $("match-head-coach");
    const currentCoach = coachSelect.value;
    const availableStaff = staff.filter(x => x.active || x.id === currentCoach);
    coachSelect.replaceChildren(new Option("Teknik direktör seçilmedi", ""),
      ...availableStaff.map(x => new Option(`${x.name} · ${x.role}${x.active ? "" : " · Gizli"}`, x.id)));
    if (availableStaff.some(x => x.id === currentCoach)) coachSelect.value = currentCoach;
    $("matches-list").innerHTML = matches.map(x => `<div class="list-row">
      <span><strong class="text-white">${escapeHtml(x.opponent)}</strong><span class="block muted text-xs mt-1">${escapeHtml(new Date(x.match_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }))} · ${x.is_live ? `🔴 CANLI ${x.our_score}-${x.their_score}` : x.played ? `${x.our_score}-${x.their_score}` : "Yaklaşan"} ${x.published ? "" : "· Taslak"}</span></span>
      <span class="list-actions"><button data-edit-match="${x.id}" type="button">Düzenle</button>
      <button data-delete-match="${x.id}" type="button">Sil</button></span></div>`).join("") || '<p class="muted py-5">Henüz maç yok. Maç ekle düğmesiyle başla.</p>';
    const selectedMatch = $("lineup-match").value;
    $("lineup-match").replaceChildren(...matches.map(x => {
      const o = document.createElement("option");
      o.value = x.id; o.textContent = `${x.opponent} · ${localInput(x.match_at).replace("T", " ")}`;
      return o;
    }));
    if (matches.some(x => x.id === selectedMatch)) $("lineup-match").value = selectedMatch;
    await showLineup();
    window.dispatchEvent(new Event("acisu:refreshed"));
  }
  const sevenSideFormations = {
    "2-3-1": [{name:"GK",x:50,y:88},{name:"DF",x:34,y:69},{name:"DF",x:66,y:69},{name:"MF",x:20,y:48},{name:"MF",x:50,y:52},{name:"MF",x:80,y:48},{name:"FW",x:50,y:29}],
    "3-2-1": [{name:"GK",x:50,y:88},{name:"DF",x:20,y:69},{name:"DF",x:50,y:72},{name:"DF",x:80,y:69},{name:"MF",x:35,y:49},{name:"MF",x:65,y:49},{name:"FW",x:50,y:29}],
    "2-2-2": [{name:"GK",x:50,y:88},{name:"DF",x:34,y:69},{name:"DF",x:66,y:69},{name:"MF",x:34,y:49},{name:"MF",x:66,y:49},{name:"FW",x:34,y:29},{name:"FW",x:66,y:29}]
  };
  const lineupJersey = number => `<svg viewBox="0 0 48 48" class="h-8 w-8 drop-shadow" aria-hidden="true"><path d="M14 5 5 9 1 20l8 4 3-5v24h24V19l3 5 8-4-4-11-9-4-5 5h-8z" fill="#eee5d5" stroke="#641d27" stroke-width="2.5" stroke-linejoin="round"/><text x="24" y="32" text-anchor="middle" font-size="14" font-weight="900" fill="#5c1a21">${escapeHtml(number ?? "")}</text></svg>`;
  function renderLineupEditor(matchId, formation, slotAssignments) {
    const box = $("lineup-players");
    const playersMarkup = players.filter(p => p.active).sort((a,b)=>a.number-b.number)
      .map(p => `<option value="${escapeHtml(p.id)}">#${p.number} ${escapeHtml(p.name)}</option>`).join("");
    const slots = sevenSideFormations[formation] || sevenSideFormations["2-3-1"];
    const selector = (index, label, position, x, y) => `<label class="absolute z-10 flex w-[104px] -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-xl border border-white/15 bg-[#121116]/95 px-1 py-1 text-center shadow-lg" style="left:${x}%;top:${y}%">
      ${lineupJersey(slotAssignments.get(index) ? players.find(p=>p.id===slotAssignments.get(index))?.number : "")}
      <span class="mt-0.5 text-[9px] font-black text-[#f0cd91]">${label} · ${position}</span>
      <select data-lineup-slot="${index}" aria-label="${label} oyuncu seçimi" class="mt-1 w-full rounded-md border border-[#836b56] bg-[#1d171a] px-1 py-1 text-[10px] text-white">
       <option value="">Oyuncu seç</option>${playersMarkup}
      </select>
    </label>`;
    const fieldPlayers = slots.map((slot,index)=>selector(index+1,`Saha ${index+1}`,slot.name,slot.x,slot.y)).join("");
    const benchPlayers = Array.from({length:4},(_,i)=>selector(i+8,`Yedek ${i+1}`,"YEDEK",50,15+i*23).replace("absolute z-10 flex w-[104px] -translate-x-1/2 -translate-y-1/2","flex w-full").replace(`style="left:50%;top:${15+i*23}%"`,"")).join("");
    box.innerHTML = `<div class="flex flex-col gap-4 lg:flex-row lg:items-stretch">
      <div class="relative mx-auto h-[590px] w-full max-w-[360px] shrink-0 overflow-hidden rounded-[24px] border-[3px] border-white/80 bg-[#078b66]">
       <div class="absolute inset-0 bg-[repeating-linear-gradient(to_bottom,#0a9b71_0%,#0a9b71_8.33%,#078b66_8.33%,#078b66_16.66%)]"></div>
       <div class="absolute inset-x-[26%] top-0 h-[13%] border-x-2 border-b-2 border-white/80"></div><div class="absolute left-1/2 top-0 h-[7%] w-[42%] -translate-x-1/2 border-x-2 border-b-2 border-white/80"></div>
       <div class="absolute left-1/2 top-[12%] h-[11%] w-[32%] -translate-x-1/2 rounded-b-full border-b-2 border-x-2 border-white/80"></div>
       <div class="absolute inset-x-0 top-1/2 border-t-2 border-white/90"></div><div class="absolute left-1/2 top-1/2 h-[15%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/90"></div>
       <div class="absolute inset-x-[26%] bottom-0 h-[13%] border-x-2 border-t-2 border-white/80"></div><div class="absolute left-1/2 bottom-0 h-[7%] w-[42%] border-x-2 border-t-2 border-white/80 -translate-x-1/2"></div>
       <div class="absolute left-1/2 bottom-[12%] h-[11%] w-[32%] -translate-x-1/2 rounded-t-full border-t-2 border-x-2 border-white/80"></div>
       <div class="absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 opacity-[.13]"><img src="image_09a3ea.png" alt="" class="h-36 w-36 object-contain"></div>
       ${fieldPlayers}
      </div>
      <aside class="w-full rounded-2xl border border-white/10 bg-[#17151a] p-3 text-white lg:max-w-[190px]">
       <h3 class="mb-1 text-center text-sm font-black uppercase tracking-wide text-[#f0cd91]">Yedekler <span class="text-gray-400">(en fazla 4)</span></h3>
       <div class="grid grid-cols-2 gap-2 lg:grid-cols-1">${benchPlayers}</div>
      </aside>
     </div>`;
    for(const [index,id] of slotAssignments){const select=box.querySelector(`[data-lineup-slot="${index}"]`);if(select)select.value=id;}
  }
  async function showLineup() {
    const matchId = $("lineup-match").value;
    if (!matchId) { $("lineup-players").textContent = "Önce maç ekle."; return; }
    const { data, error } = await db.from("acisu_match_lineup").select("player_id,role,slot_index").eq("match_id", matchId).order("slot_index");
    if (error) { notice(error.message); return; }
    const match = matches.find(x=>x.id===matchId);
    const formation = match?.lineup_formation || "2-3-1";
    $("lineup-formation").value = formation;
    const rows=(data||[]).slice().sort((a,b)=>Number(a.slot_index||99)-Number(b.slot_index||99));
    const assignments=new Map();
    rows.forEach((row,index)=>assignments.set(Number(row.slot_index)||index+1,row.player_id));
    renderLineupEditor(matchId,formation,assignments);
  }
  async function boot() {
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user) { $("login-form").hidden = false; $("dashboard").hidden = true; $("logout").hidden = true; return; }
    const { data: admin, error: adminError } = await db.from("acisu_admins")
      .select("user_id").eq("user_id", user.id).maybeSingle();
    if (adminError || !admin) {
      await db.auth.signOut();
      $("dashboard").hidden = true; $("login-form").hidden = false; $("logout").hidden = true;
      notice("Bu hesap yönetici olarak tanımlı değil.");
      return;
    }
    $("login-form").hidden = true; $("dashboard").hidden = false; $("logout").hidden = false;
    try { await refresh(); }
    catch (e) { notice("Veriler yüklenemedi: " + e.message); }
  }
  $("login-form").addEventListener("submit", async e => {
    e.preventDefault();
    const form = e.currentTarget;
    const { error } = await db.auth.signInWithPassword({
      email: formValue(form, "email"), password: formValue(form, "password")
    });
    if (error) { notice(error.message); return; }
    form.reset(); await boot();
  });
  $("logout").addEventListener("click", async () => { await db.auth.signOut(); await boot(); notice("Çıkış yapıldı."); });
  $("player-form").addEventListener("submit", async e => {
    e.preventDefault(); const f = e.currentTarget;
    const file = f.elements.namedItem("photo").files?.[0];
    if (file && (!photoTypes[file.type] || file.size > 5 * 1024 * 1024 || !file.size)) {
      notice("JPG, PNG veya WebP fotoğraf seç; dosya en fazla 5 MB olmalı."); return;
    }
    const oldImage = formValue(f, "image_url");
    const payload = {
      name: formValue(f, "name"), number: Number(formValue(f, "number")),
      position: formValue(f, "position"), image_url: oldImage || null,
      rating: Number(formValue(f, "rating")), pace: Number(formValue(f, "pace")),
      passing: Number(formValue(f, "passing")), defense: Number(formValue(f, "defense")),
      active: f.elements.namedItem("active").checked
    };
    const id = formValue(f, "id");
    const submit = f.querySelector('[type="submit"]');
    submit.disabled = true; submit.textContent = file ? "Fotoğraf yükleniyor…" : "Kaydediliyor…";
    let uploadedPath, saved = false;
    try {
      if (file) {
        uploadedPath = `${crypto.randomUUID()}.${photoTypes[file.type]}`;
        const { error: uploadError } = await db.storage.from(photoBucket)
          .upload(uploadedPath, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        payload.image_url = db.storage.from(photoBucket).getPublicUrl(uploadedPath).data.publicUrl;
      }
      const { error } = id ? await db.from("acisu_players").update(payload).eq("id", id)
        : await db.from("acisu_players").insert(payload);
      if (error) throw error;
      saved = true;
      if (uploadedPath && storedPhotoPath(oldImage)) {
        const { error: cleanupError } = await db.storage.from(photoBucket).remove([storedPhotoPath(oldImage)]);
        if (cleanupError) console.warn("Eski fotoğraf silinemedi:", cleanupError);
      }
      f.reset(); editor("player", false); notice("Oyuncu ve fotoğrafı kaydedildi."); await refresh();
    } catch (error) {
      if (!saved && uploadedPath) await db.storage.from(photoBucket).remove([uploadedPath]);
      notice((saved ? "Oyuncu kaydedildi, liste yenilenemedi: " : "Oyuncu kaydedilemedi: ") + error.message);
    } finally {
      submit.disabled = false; submit.textContent = "Oyuncuyu kaydet";
    }
  });
  $("staff-form").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.currentTarget, file = f.elements.namedItem("photo").files?.[0];
    if (!validPhoto(file)) { notice("JPG, PNG veya WebP seç; dosya en fazla 5 MB olmalı."); return; }
    const id = formValue(f, "id"), oldImage = formValue(f, "image_url");
    const payload = {
      name: formValue(f, "name"), role: formValue(f, "role"),
      sort_order: Number(formValue(f, "sort_order")),
      rating: Number(formValue(f, "rating")), pace: Number(formValue(f, "pace")),
      passing: Number(formValue(f, "passing")), defense: Number(formValue(f, "defense")),
      image_url: oldImage || null, active: f.elements.namedItem("active").checked
    };
    const submit = f.querySelector('[type="submit"]');
    submit.disabled = true; submit.textContent = file ? "Fotoğraf yükleniyor…" : "Kaydediliyor…";
    let uploaded, saved = false;
    try {
      if (file) { uploaded = await uploadMedia(file, "staff"); payload.image_url = uploaded.url; }
      const { error } = id ? await db.from("acisu_staff").update(payload).eq("id", id)
        : await db.from("acisu_staff").insert(payload);
      if (error) throw error;
      saved = true;
      if (uploaded) await removeMedia(oldImage);
      f.reset(); editor("staff", false); notice("Teknik heyet kaydedildi."); await refresh();
    } catch (error) {
      if (!saved && uploaded) await removeMedia(uploaded.url);
      notice((saved ? "Kaydedildi, liste yenilenemedi: " : "Kaydedilemedi: ") + error.message);
    } finally { submit.disabled = false; submit.textContent = "Kişiyi kaydet"; }
  });
  $("match-form").addEventListener("submit", async e => {
    e.preventDefault(); const f = e.currentTarget;
    const id = f.dataset.mode === "edit" ? editingMatchId : "";
    if (f.dataset.mode === "edit" && !id) {
      notice("Düzenlenecek maç seçimi bulunamadı. Maçı listeden tekrar aç."); return;
    }
    if (matches.some(x => x.id === id && x.is_live)) {
      notice("Canlı maçın skorunu Canlı Maç sekmesinden yönet."); return;
    }
    const played = f.elements.namedItem("played").checked;
    if (played && (!formValue(f, "our_score") || !formValue(f, "their_score"))) {
      notice("Oynanan maçın iki skorunu da gir."); return;
    }
    const goalEvents = played ? selectedMatchGoalEvents() : [];
    if (played && Number(formValue(f, "our_score")) > 0) {
      if (!matchGoalRoster.length) {
        notice("Önce bu maçın kadrosunu Maç Kadrosu sekmesinden kaydet, sonra golcüleri seç."); return;
      }
      if (goalEvents.length !== Number(formValue(f, "our_score")) || goalEvents.some(g => !g.scorer_id)) {
        notice("Acısu'nun her golü için kadrodan golcü seç."); return;
      }
      if (goalEvents.some(g => g.assist_id && g.assist_id === g.scorer_id)) {
        notice("Golü atan oyuncu kendi golüne asist yapamaz."); return;
      }
    }
    const file = f.elements.namedItem("opponent_photo").files?.[0];
    if (!validPhoto(file)) { notice("Rakip arması JPG, PNG veya WebP olmalı; en fazla 5 MB."); return; }
    const oldImage = formValue(f, "opponent_image_url");
    const payload = {
      opponent: formValue(f, "opponent"), match_at: toIso(formValue(f, "match_at")), time_confirmed: true,
      opponent_image_url: oldImage || null,
      venue: formValue(f, "venue"), home: formValue(f, "home") === "true",
      played, is_live: false, published: f.elements.namedItem("published").checked,
      our_score: played ? Number(formValue(f, "our_score")) : null,
      their_score: played ? Number(formValue(f, "their_score")) : null,
      goal_scorers: played ? formValue(f, "goal_scorers") : "",
      head_coach_id: formValue(f, "head_coach_id") || null
    };
    const previous = matches.find(x => x.id === id);
    const reset = previous?.played && !played;
    if (reset && !confirm("Bu maçı Oynanmadı yaparsan maçın gol günlüğü, oyuncu istatistikleri ve bu maçtan gelen puanlar sıfırlanacak. Devam edilsin mi?")) return;
    const submit = f.querySelector('[type="submit"]');
    submit.disabled = true; submit.textContent = file ? "Arma yükleniyor…" : "Kaydediliyor…";
    let uploaded, saved = false, resetData;
    try {
      if (file) { uploaded = await uploadMedia(file, "opponents"); payload.opponent_image_url = uploaded.url; }
      if (reset) {
        const { data, error } = await db.rpc("acisu_reset_match", { p_match_id: id });
        if (error) throw error;
        resetData = data;
      }
      let savedMatchId = id;
      if (id) {
        const { error } = await db.from("acisu_matches").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await db.from("acisu_matches").insert(payload).select("id").single();
        if (error) throw error;
        savedMatchId = data.id;
      }
      saved = true;
      if (savedMatchId && played) {
        const { error: creditError } = await db.rpc("acisu_save_match_goal_events", {
          p_match_id: savedMatchId, p_goal_events: goalEvents
        });
        if (creditError) {
          notice("Maç bilgisi kaydedildi ama gol/asist bağlantıları kaydedilemedi: " + creditError.message);
          return;
        }
      }
      if (uploaded) await removeMedia(oldImage);
      setMatchFormMode(); f.reset(); editor("match", false);
      notice(reset ? `Maç sıfırlandı. ${Number(resetData?.goal_events_deleted || 0)} gol kaydı ve ${Number(resetData?.player_stat_rows_deleted || 0)} oyuncu istatistiği silindi.` : "Maç kaydedildi.");
      await refresh();
    } catch (error) {
      if (!saved && uploaded) await removeMedia(uploaded.url);
      notice(saved ? "Maç bilgisi kaydedildi, ek işlemler tamamlanamadı: " + error.message
        : (resetData ? "Maç sıfırlandı; diğer bilgiler kaydedilemedi: " : "Maç kaydedilemedi: ") + error.message);
      if (resetData) await refresh();
    } finally { submit.disabled = false; submit.textContent = "Maçı kaydet"; }
  });
  $("lineup-match").addEventListener("change", showLineup);
  $("lineup-formation").addEventListener("change", () => {
    const values=new Map([...$("lineup-players").querySelectorAll("[data-lineup-slot]")].map(x=>[Number(x.dataset.lineupSlot),x.value]).filter(x=>x[1]));
    renderLineupEditor($("lineup-match").value,$("lineup-formation").value,values);
  });
  $("save-lineup").addEventListener("click", async () => {
    const matchId = $("lineup-match").value;
    if (!matchId) return;
    const controls=[...$("lineup-players").querySelectorAll("[data-lineup-slot]")];
    const picked=controls.filter(x=>x.value).map(x=>({slot:Number(x.dataset.lineupSlot),player_id:x.value}));
    const starters=picked.filter(x=>x.slot<=7), reserves=picked.filter(x=>x.slot>=8);
    if(starters.length!==7){notice("Sahaya tam 7 oyuncu seçmelisin (kaleci dahil).");return;}
    if(reserves.length>4){notice("En fazla 4 yedek seçebilirsin.");return;}
    if(new Set(picked.map(x=>x.player_id)).size!==picked.length){notice("Aynı oyuncuyu birden fazla slota seçemezsin.");return;}
    const formation=$("lineup-formation").value;
    const {error:matchError}=await db.from("acisu_matches").update({lineup_formation:formation}).eq("id",matchId);
    if(matchError){notice("Diziliş kaydedilemedi: "+matchError.message);return;}
    const { error: delError } = await db.from("acisu_match_lineup").delete().eq("match_id", matchId);
    if (delError) { notice(delError.message); return; }
    const selected=picked.map(x=>({match_id:matchId,player_id:x.player_id,role:x.slot<=7?"ilk11":"yedek",slot_index:x.slot}));
    const { error } = await db.from("acisu_match_lineup").insert(selected);
    if (error) { notice("Kadro kaydedilemedi: " + error.message); return; }
    const match=matches.find(x=>x.id===matchId);if(match)match.lineup_formation=formation;
    notice("Maç kadrosu ve dizilişi kaydedildi.");
  });
  $("players-list").addEventListener("click", async e => {
    const edit = e.target.closest("[data-edit-player]");
    const del = e.target.closest("[data-delete-player]");
    if (edit) {
      const p = players.find(x => x.id === edit.dataset.editPlayer), f = $("player-form");
      for (const field of ["id", "name", "number", "position", "image_url", "rating", "pace", "passing", "defense"])
        f.elements.namedItem(field).value = p[field] ?? "";
      f.elements.namedItem("photo").value = "";
      showPhoto(p.image_url || "");
      f.elements.namedItem("active").checked = p.active;
      editor("player", true, true); return;
    }
    if (del && confirm("Oyuncu silinsin mi? Maç kadrolarından da kaldırılır.")) {
      const oldImage = players.find(x => x.id === del.dataset.deletePlayer)?.image_url || "";
      const { error } = await db.from("acisu_players").delete().eq("id", del.dataset.deletePlayer);
      if (!error && storedPhotoPath(oldImage)) {
        const { error: cleanupError } = await db.storage.from(photoBucket).remove([storedPhotoPath(oldImage)]);
        if (cleanupError) console.warn("Oyuncu fotoğrafı silinemedi:", cleanupError);
      }
      notice(error ? error.message : "Oyuncu silindi."); if (!error) await refresh();
    }
  });
  $("staff-list").addEventListener("click", async e => {
    const edit = e.target.closest("[data-edit-staff]");
    const del = e.target.closest("[data-delete-staff]");
    if (edit) {
      const person = staff.find(x => x.id === edit.dataset.editStaff), f = $("staff-form");
      for (const field of ["id", "name", "role", "sort_order", "image_url", "rating", "pace", "passing", "defense"])
        f.elements.namedItem(field).value = person[field] ?? "";
      f.elements.namedItem("photo").value = "";
      f.elements.namedItem("active").checked = person.active;
      showPreview("staff-photo-preview", person.image_url || "");
      editor("staff", true, true); return;
    }
    if (del && confirm("Bu kişi teknik heyetten silinsin mi?")) {
      const person = staff.find(x => x.id === del.dataset.deleteStaff);
      const { error } = await db.from("acisu_staff").delete().eq("id", del.dataset.deleteStaff);
      if (!error) await removeMedia(person?.image_url);
      notice(error ? error.message : "Kişi silindi."); if (!error) await refresh();
    }
  });
  $("matches-list").addEventListener("click", async e => {
    const edit = e.target.closest("[data-edit-match]");
    const del = e.target.closest("[data-delete-match]");
    if (edit) {
      const m = matches.find(x => x.id === edit.dataset.editMatch), f = $("match-form");
      if (!m) { notice("Maç bulunamadı. Listeyi yenileyip tekrar dene."); return; }
      setMatchFormMode(m.id);
      for (const field of ["id", "opponent", "opponent_image_url", "venue", "our_score", "their_score", "goal_scorers", "head_coach_id"])
        f.elements.namedItem(field).value = m[field] ?? "";
      f.elements.namedItem("opponent_photo").value = "";
      showPreview("opponent-photo-preview", m.opponent_image_url || "");
      f.elements.namedItem("match_at").value = localInput(m.match_at);
      f.elements.namedItem("home").value = String(m.home);
      f.elements.namedItem("played").checked = m.played;
      f.elements.namedItem("published").checked = m.published;
      renderMatchGoalAssignments([]);
      editor("match", true, true);
      try { await loadMatchGoalAssignments(m); }
      catch (error) { notice("Gol/asist bilgileri yüklenemedi: " + error.message); }
      return;
    }
    if (del && confirm("Maç ve maç kadrosu silinsin mi?")) {
      const match = matches.find(x => x.id === del.dataset.deleteMatch);
      const { error } = await db.from("acisu_matches").delete().eq("id", del.dataset.deleteMatch);
      if (!error) await removeMedia(match?.opponent_image_url);
      notice(error ? error.message : "Maç silindi."); if (!error) await refresh();
    }
  });
  window.acisuAdmin = { db, getPlayers: () => players, getMatches: () => matches, getSponsors: () => sponsors,
    refresh, notice, activateTab, escapeHtml };
  document.querySelectorAll("[data-tab-open]").forEach(button => button.addEventListener("click", () => activateTab(button.dataset.tabOpen)));
  $("download-admin-backup")?.addEventListener("click", async () => {
    const button = $("download-admin-backup");
    button.disabled = true; button.textContent = "Yedek hazırlanıyor…";
    try {
      const tables = ["acisu_players","acisu_matches","acisu_match_lineup","acisu_player_stats","acisu_goal_log","acisu_news","acisu_seasons","acisu_staff","acisu_sponsors"];
      const entries = await Promise.all(tables.map(async table => {
        const {data,error}=await db.from(table).select("*");
        if(error) throw new Error(table+": "+error.message);
        return [table,data||[]];
      }));
      const payload={project:"Acısu United",created_at:new Date().toISOString(),tables:Object.fromEntries(entries)};
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
      const url=URL.createObjectURL(blob), link=document.createElement("a");
      link.href=url; link.download="acisu-united-yedek-"+new Date().toISOString().slice(0,10)+".json";
      link.click(); setTimeout(()=>URL.revokeObjectURL(url),1500);
      notice("Acısu verileri JSON yedeği olarak indirildi.");
    } catch(error) { notice("Yedek alınamadı: "+error.message); }
    finally { button.disabled=false; button.textContent="⬇ Verileri yedekle"; }
  });
  activateTab("overview");
  boot();
})();
