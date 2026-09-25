(function () {
  const api = window.acisuAdmin;
  if (!api) return;
  const { db, getPlayers, getMatches, refresh, notice, escapeHtml: esc } = api;
  const $ = id => document.getElementById(id);
  let stats = [], goals = [], news = [], seasons = [];
  const dateText = iso => new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  }).format(new Date(iso));
  const matchText = m => `${m.opponent} · ${dateText(m.match_at)}`;
  const playerName = id => getPlayers().find(p => p.id === id)?.name || "Oyuncu";
  const points = s => (s.played ? 2 : 0) + s.goals * 5 + s.assists * 2
    - s.yellow_cards - s.red_cards * 3;
  const opt = (value, label) => `<option value="${esc(value)}">${esc(label)}</option>`;
  const playerOptions = () => getPlayers().filter(p => p.active)
    .map(p => opt(p.id, `#${p.number} ${p.name}`)).join("");
  let loading = false;
  async function reload() {
    if (loading || $("dashboard").hidden) return;
    loading = true;
    try {
      const [s, g, n, a] = await Promise.all([
        db.from("acisu_player_stats").select("*"),
        db.from("acisu_goal_log").select("*").order("created_at", { ascending: false }),
        db.from("acisu_news").select("*").order("created_at", { ascending: false }),
        db.from("acisu_seasons").select("*").order("season_year", { ascending: false })
      ]);
      if (s.error || g.error || n.error || a.error) throw s.error || g.error || n.error || a.error;
      stats = s.data || []; goals = g.data || []; news = n.data || []; seasons = a.data || [];
      renderAll();
    } catch (e) { notice("Yeni bölümler yüklenemedi: " + e.message); }
    finally { loading = false; }
  }
  function fillMatches(id, filter = () => true, blank = false) {
    const el = $(id), previous = el.value;
    const ms = getMatches().filter(filter);
    el.innerHTML = (blank ? opt("", "Maç seçme") : "") + ms.map(m => opt(m.id, matchText(m))).join("");
    if (ms.some(m => m.id === previous)) el.value = previous;
  }
  function renderAll() {
    const next = [...getMatches()].filter(m => !m.played && !m.is_live)
      .sort((a, b) => new Date(a.match_at) - new Date(b.match_at))[0];
    const live = getMatches().find(m => m.is_live);
    $("overview-next").innerHTML = live
      ? `🔴 <strong>Canlı:</strong> ${esc(live.opponent)} · ${live.our_score}-${live.their_score} <button id="overview-live" class="text-altin underline ml-2">Yönet</button>`
      : next ? `<strong class="text-altin">Sıradaki maç:</strong> ${esc(matchText(next))}`
        : "Yaklaşan maç bulunmuyor.";
    fillMatches("live-match");
    fillMatches("stats-match");
    fillMatches("news-match", () => true, true);
    fillMatches("auto-news-match", m => m.played);
    renderLive(); renderStats(); renderPoints(); renderNews(); renderSeasons();
  }
  function renderLive() {
    const box = $("live-panel"), m = getMatches().find(x => x.id === $("live-match").value);
    if (!m) { box.innerHTML = '<p class="muted">Önce maç ekle ve burada seç.</p>'; return; }
    const action = m.is_live ? `
      <div class="grid sm:grid-cols-2 gap-3 mb-4">
        <label class="field">Golü atan<select id="live-scorer">${playerOptions()}</select></label>
        <label class="field">Asist (isteğe bağlı)<select id="live-assist">${opt("", "Asist yok")}${playerOptions()}</select></label>
      </div>
      <button class="action w-full mb-3" data-live="goal">⚽ Acısu golü · Skoru artır</button>
      <button class="outline-action w-full mb-3" data-live="opponent">Rakip golü · Skoru artır</button>
      <button class="outline-action w-full" data-live="finish">🏁 Maçı bitir</button>`
      : m.played ? '<p class="muted text-center">Bu maç tamamlandı.</p>'
        : '<button class="action w-full" data-live="start">🔴 Canlı maçı başlat</button>';
    box.innerHTML = `<div class="text-center bg-[#120e10] rounded-xl p-5 mb-4">
      <p class="muted text-xs mb-3">${esc(dateText(m.match_at))}</p>
      <div class="font-baslik text-2xl">ACISU UNITED <span class="text-altin">${m.is_live || m.played ? `${m.our_score} - ${m.their_score}` : "VS"}</span> ${esc(m.opponent)}</div>
      <p class="mt-2 ${m.is_live ? "text-red-400" : "muted"} text-sm">${m.is_live ? "🔴 CANLI" : m.played ? "Maç bitti" : "Başlamadı"}</p>
      </div>${action}<div id="live-goals" class="muted text-xs mt-4">${goals.filter(g => g.match_id === m.id).map(g =>
        `<div class="border-t border-white/10 py-2">⚽ ${g.side === "opponent" ? esc(m.opponent) : esc(playerName(g.scorer_id))}${g.assist_id ? " · Asist: " + esc(playerName(g.assist_id)) : ""}</div>`).join("")}</div>`;
  }
  function renderStats() {
    const matchId = $("stats-match").value, box = $("stats-player-list");
    if (!matchId) { box.textContent = "Önce maç ekle."; return; }
    const match = getMatches().find(m => m.id === matchId);
    box.innerHTML = getPlayers().map(p => {
      const s = stats.find(x => x.match_id === matchId && x.player_id === p.id) || {};
      const cell = (key, label, max = 99) => `<label class="field">${label}<input name="${key}" type="number" min="0" max="${max}" value="${s[key] || 0}" required></label>`;
      return `<form data-stat-player="${p.id}" class="lineup-item">
        <div class="flex justify-between items-center gap-2 mb-3"><strong>#${p.number} ${esc(p.name)}</strong>
          <label class="text-xs flex items-center gap-2"><input name="played" type="checkbox" ${s.played ? "checked" : ""}> Oynadı</label></div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">${cell("goals","Gol")}${cell("assists","Asist")}${cell("yellow_cards","Sarı kart",9)}${cell("red_cards","Kırmızı kart",9)}</div>
        <div class="flex items-center justify-between mt-3"><span class="muted text-xs">Puan: ${points({played:s.played||false,goals:s.goals||0,assists:s.assists||0,yellow_cards:s.yellow_cards||0,red_cards:s.red_cards||0})}</span><button class="outline-action" type="submit">Kaydet</button></div>
      </form>`;
    }).join("") || '<p class="muted">Oyuncu ekle.</p>';
    if (match?.is_live) box.insertAdjacentHTML("afterbegin", '<p class="text-altin text-xs mb-3">Canlı golü Canlı Maç ekranından gir; burada kartları ve oynama durumunu düzenle.</p>');
  }
  function renderPoints() {
    const rows = getPlayers().map(p => {
      const own = stats.filter(x => x.player_id === p.id);
      return {p,played:own.filter(x => x.played).length,
        goals:own.reduce((sum,x) => sum+x.goals,0), assists:own.reduce((sum,x) => sum+x.assists,0),
        yellow_cards:own.reduce((sum,x) => sum+x.yellow_cards,0),red_cards:own.reduce((sum,x) => sum+x.red_cards,0)};
    }).sort((a,b) => points({...b,played:false})+b.played*2 - (points({...a,played:false})+a.played*2));
    $("points-list").innerHTML = rows.map(x => `<div class="list-row">
      <div><strong>#${x.p.number} ${esc(x.p.name)}</strong><div class="muted text-xs mt-1">Maç ${x.played} · Gol ${x.goals} · Asist ${x.assists} · Sarı ${x.yellow_cards} · Kırmızı ${x.red_cards}</div></div>
      <strong class="font-baslik text-xl text-altin">${x.played*2+x.goals*5+x.assists*2-x.yellow_cards-x.red_cards*3} P</strong></div>`).join("") || '<p class="muted">İstatistik kaydı yok.</p>';
  }
  function renderNews() {
    $("news-list").innerHTML = news.map(n => `<div class="list-row"><div><strong>${esc(n.title)}</strong><div class="muted text-xs mt-1">${esc(dateText(n.created_at))} · ${n.published ? "Yayında" : "Taslak"}${n.auto_generated ? " · Otomatik" : ""}</div></div>
      <div class="list-actions"><button data-edit-news="${n.id}">Düzenle</button><button data-delete-news="${n.id}">Sil</button></div></div>`).join("") || '<p class="muted">Henüz haber yok.</p>';
  }
  function renderSeasons() {
    $("seasons-list").innerHTML = seasons.map(s => `<div class="border-t border-white/10 py-4"><strong class="text-altin">${s.season_year} sezonu</strong>
      <div class="muted text-xs mt-2">${s.matches_count} maç · ${s.wins}G ${s.draws}B ${s.losses}M · ${s.goals_for}-${s.goals_against}</div>
      <div class="muted text-xs mt-1">Gol: ${esc(s.top_scorer||"-")} · Asist: ${esc(s.top_assister||"-")}</div>
      <button class="text-xs text-red-300 mt-2 underline" data-delete-season="${s.season_year}">Arşivden kaldır</button></div>`).join("") || '<p class="muted">Henüz arşiv yok.</p>';
  }
  async function push(title, body, silent = false) {
    try {
      const { data, error } = await db.functions.invoke("acisu-push", { body: { action: "send", title, body } });
      if (error || data?.error) throw error || new Error(data.error);
      if (!silent) notice(`Bildirim gönderildi: ${data?.sent || 0} cihaz.`);
      return true;
    } catch (e) { if (!silent) notice("Bildirim gönderilemedi: " + e.message); return false; }
  }
  async function autoNews(match) {
    if (!match?.played) return false;
    const own = Number(match.our_score), rival = Number(match.their_score);
    const title = own > rival ? `Acısu United, ${match.opponent} karşısında galip!` :
      own < rival ? `Acısu United - ${match.opponent} maçında son düdük` : `Acısu United ile ${match.opponent} berabere kaldı`;
    const scorers = stats.filter(s => s.match_id === match.id && s.goals > 0)
      .map(s => `${playerName(s.player_id)} (${s.goals})`).join(", ");
    const body = `Acısu United, ${match.opponent} ile oynadığı maçı ${own}-${rival} tamamladı.${scorers ? " Goller: " + scorers + "." : match.goal_scorers ? " Goller: " + match.goal_scorers + "." : ""}`;
    const previous = news.find(n => n.match_id === match.id && n.auto_generated);
    const payload = {title,body,match_id:match.id,published:true,auto_generated:true};
    const { error } = previous
      ? await db.from("acisu_news").update(payload).eq("id",previous.id)
      : await db.from("acisu_news").insert(payload);
    if (error) { notice("Haber üretilemedi: " + error.message); return false; }
    return true;
  }
  function seasonSummary(year) {
    const yearMatches = getMatches().filter(m => m.played &&
      Number(new Intl.DateTimeFormat("en-US",{year:"numeric",timeZone:"Europe/Istanbul"}).format(new Date(m.match_at)))===year);
    const tally = (key) => {
      const grouped = new Map();
      stats.filter(s => yearMatches.some(m => m.id === s.match_id)).forEach(s =>
        grouped.set(s.player_id,(grouped.get(s.player_id)||0)+s[key]));
      const best = [...grouped].sort((a,b)=>b[1]-a[1])[0];
      return best?.[1] > 0 ? `${playerName(best[0])} (${best[1]})` : null;
    };
    return {season_year:year,matches_count:yearMatches.length,
      wins:yearMatches.filter(m=>m.our_score>m.their_score).length,
      draws:yearMatches.filter(m=>m.our_score===m.their_score).length,
      losses:yearMatches.filter(m=>m.our_score<m.their_score).length,
      goals_for:yearMatches.reduce((n,m)=>n+Number(m.our_score),0),
      goals_against:yearMatches.reduce((n,m)=>n+Number(m.their_score),0),
      top_scorer:tally("goals"),top_assister:tally("assists")};
  }
  async function runLive(action) {
    const match = getMatches().find(m => m.id === $("live-match").value);
    if (!match) return;
    let error, pushFailed = false, newsFailed = false;
    if (action === "start") {
      if (!confirm(`${match.opponent} maçını canlı başlat?`)) return;
      ({error} = await db.from("acisu_matches").update({is_live:true,played:false,our_score:0,their_score:0}).eq("id",match.id).eq("played",false));
      if (!error) pushFailed = !(await push("🔴 Maç başladı!", `Acısu United - ${match.opponent} şimdi canlı!`, true));
    } else if (action === "finish") {
      if (!confirm(`Maçı ${match.our_score}-${match.their_score} skoruyla bitir?`)) return;
      ({error} = await db.from("acisu_matches").update({is_live:false,played:true}).eq("id",match.id).eq("is_live",true));
      if (!error) {
        newsFailed = !(await autoNews({...match,played:true}));
        pushFailed = !(await push("🏁 Maç sonucu", `Acısu United ${match.our_score}-${match.their_score} ${match.opponent}`, true));
      }
    } else {
      const scorer = action === "goal" ? $("live-scorer")?.value : null;
      const assist = action === "goal" ? ($("live-assist")?.value || null) : null;
      if (action === "goal" && (!scorer || scorer === assist)) { notice("Gol atan oyuncuyu ve farklı bir asist yapanı seç."); return; }
      ({error} = await db.rpc("acisu_record_live_goal", {p_match_id:match.id,p_side:action === "goal" ? "acisu" : "opponent",p_scorer_id:scorer,p_assist_id:assist}));
      if (!error) {
        const us = Number(match.our_score)+(action === "goal" ? 1 : 0), them = Number(match.their_score)+(action === "opponent" ? 1 : 0);
        pushFailed = !(await push("⚽ GOOOL!", `${action === "goal" ? playerName(scorer) : match.opponent} · Acısu United ${us}-${them} ${match.opponent}`, true));
      }
    }
    if (error) { notice(error.message); return; }
    await refresh();
    notice(`Maç güncellendi.${newsFailed ? " Haber oluşturulamadı." : ""}${pushFailed ? " Bildirim gönderilemedi." : ""}`);
  }
  $("overview-next").addEventListener("click", e => { if (e.target.id === "overview-live") api.activateTab("live"); });
  $("live-match").addEventListener("change", renderLive);
  $("live-panel").addEventListener("click", e => { const a=e.target.closest("[data-live]"); if(a) runLive(a.dataset.live); });
  $("stats-match").addEventListener("change", renderStats);
  $("stats-player-list").addEventListener("submit", async e => {
    e.preventDefault();
    const f=e.target.closest("form[data-stat-player]"); if(!f) return;
    const value = name => Number(f.elements.namedItem(name).value);
    const payload={match_id:$("stats-match").value,player_id:f.dataset.statPlayer,
      played:f.elements.namedItem("played").checked,goals:value("goals"),assists:value("assists"),
      yellow_cards:value("yellow_cards"),red_cards:value("red_cards")};
    const button=f.querySelector("button"); button.disabled=true;
    const { error }=await db.from("acisu_player_stats").upsert(payload,{onConflict:"match_id,player_id"});
    button.disabled=false;
    if(error){notice(error.message);return;}
    notice("Oyuncu istatistiği kaydedildi."); await reload();
  });
  $("news-form").addEventListener("reset", () => setTimeout(() => $("news-form-title").textContent="Haber oluştur",0));
  $("news-form").addEventListener("submit", async e => {
    e.preventDefault(); const f=e.currentTarget;
    const id=f.elements.namedItem("id").value;
    const payload={title:f.elements.namedItem("title").value.trim(),body:f.elements.namedItem("body").value.trim(),
      published:f.elements.namedItem("published").checked,match_id:f.elements.namedItem("match_id").value||null};
    const {error}=id?await db.from("acisu_news").update(payload).eq("id",id):await db.from("acisu_news").insert(payload);
    if(error){notice(error.message);return;}
    f.reset(); notice("Haber kaydedildi."); await reload();
  });
  $("news-list").addEventListener("click", async e => {
    const edit=e.target.closest("[data-edit-news]"), del=e.target.closest("[data-delete-news]");
    if(edit){
      const n=news.find(x=>x.id===edit.dataset.editNews), f=$("news-form");
      for(const field of ["id","title","body"])f.elements.namedItem(field).value=n[field];
      f.elements.namedItem("match_id").value=n.match_id||"";
      f.elements.namedItem("published").checked=n.published;
      $("news-form-title").textContent="Haberi düzenle";
      f.scrollIntoView({behavior:"smooth",block:"start"});
    }
    if(del && confirm("Haber silinsin mi?")){
      const {error}=await db.from("acisu_news").delete().eq("id",del.dataset.deleteNews);
      if(error)notice(error.message);else{notice("Haber silindi.");await reload();}
    }
  });
  $("generate-news").addEventListener("click", async () => {
    const m=getMatches().find(x=>x.id===$("auto-news-match").value);
    if(!m){notice("Önce oynanmış bir maç seç.");return;}
    const created = await autoNews(m); await reload();
    if (created) notice("Maç haberi oluşturuldu.");
  });
  $("preview-season").addEventListener("click", () => {
    const s=seasonSummary(Number($("season-form").elements.namedItem("year").value));
    $("season-preview").textContent=`${s.matches_count} maç · ${s.wins} galibiyet · ${s.draws} beraberlik · ${s.losses} mağlubiyet · Gol ${s.goals_for}-${s.goals_against} · Gol kralı: ${s.top_scorer||"-"} · Asist: ${s.top_assister||"-"}`;
  });
  $("season-form").addEventListener("submit", async e => {
    e.preventDefault();const f=e.currentTarget, year=Number(f.elements.namedItem("year").value);
    const s=seasonSummary(year);
    if(!s.matches_count){notice("Bu yıl oynanmış maç yok.");return;}
    const {error}=await db.from("acisu_seasons").upsert({...s,note:f.elements.namedItem("note").value.trim()});
    if(error)notice(error.message);else{notice("Sezon arşivlendi.");await reload();}
  });
  $("seasons-list").addEventListener("click",async e=>{
    const b=e.target.closest("[data-delete-season]");
    if(!b||!confirm("Sezonu arşivden kaldır?"))return;
    const {error}=await db.from("acisu_seasons").delete().eq("season_year",Number(b.dataset.deleteSeason));
    if(error)notice(error.message);else{notice("Arşiv kaydı kaldırıldı.");await reload();}
  });
  const presets={goal:["⚽ GOOOL!","Acısu United gol attı!"],lineup:["📋 Maç kadrosu","Yeni maç kadromuz yayımlandı."],
    start:["🔴 Maç başladı","Acısu United maçı şimdi canlı!"],result:["🏁 Maç sonucu","Maç sonucunu siteden görebilirsin."]};
  document.querySelectorAll("[data-preset]").forEach(b=>b.addEventListener("click",()=>{
    const [title,body]=presets[b.dataset.preset];const f=$("push-form");
    f.elements.namedItem("title").value=title;f.elements.namedItem("body").value=body;
  }));
  $("push-form").addEventListener("submit",async e=>{
    e.preventDefault();const f=e.currentTarget, button=f.querySelector('[type="submit"]');
    button.disabled=true;
    const sent=await push(f.elements.namedItem("title").value.trim(),f.elements.namedItem("body").value.trim());
    $("push-result").textContent=sent?"Bildirim isteği işlendi.":"Gönderim başarısız.";
    button.disabled=false;
  });
  window.addEventListener("acisu:refreshed", reload);
})();
