(function () {
  const modal = document.getElementById("match-center");
  const content = document.getElementById("match-center-content");
  if (!modal || !content) return;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  const safeImage = value => {
    const image = String(value || "");
    return /^(?:[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp)|https:\/\/[a-zA-Z0-9.-]+\/[^\s"'<>]*)$/i.test(image) ? image : "image_09a3ea.png";
  };
  const dateText = (value, confirmed) => new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul", day: "numeric", month: "long", year: "numeric",
    ...(confirmed !== false ? { hour: "2-digit", minute: "2-digit" } : {})
  }).format(new Date(value));
  const formations = {
    "2-3-1": [[50,87,"K"],[34,68,"DF"],[66,68,"DF"],[20,48,"OS"],[50,51,"OS"],[80,48,"OS"],[50,29,"FV"]],
    "3-2-1": [[50,87,"K"],[20,69,"DF"],[50,71,"DF"],[80,69,"DF"],[35,49,"OS"],[65,49,"OS"],[50,29,"FV"]],
    "2-2-2": [[50,87,"K"],[34,69,"DF"],[66,69,"DF"],[34,49,"OS"],[66,49,"OS"],[34,29,"FV"],[66,29,"FV"]]
  };
  let data = window.acisuMatchCenterData || null;
  let activeId = null;
  let previousFocus = null;

  function crest(name, url, own) {
    return url || own
      ? `<img src="${esc(safeImage(own ? "image_09a3ea.png" : url))}" alt="${esc(name)} arması" class="mc-crest" loading="lazy">`
      : `<span class="mc-crest mc-crest-empty" aria-hidden="true">${esc(String(name || "?").slice(0, 2).toLocaleUpperCase("tr-TR"))}</span>`;
  }
  function jersey(number) {
    return `<svg class="mc-jersey" viewBox="0 0 48 48" aria-hidden="true"><path d="M14 5 5 9 1 20l8 4 3-5v24h24V19l3 5 8-4-4-11-9-4-5 5h-8z" fill="#eee4d5" stroke="#541820" stroke-width="2.5" stroke-linejoin="round"/><path d="M19 5q5 7 10 0" fill="none" stroke="#9a3540" stroke-width="3"/><text x="24" y="32" text-anchor="middle" font-size="14" font-weight="900" fill="#5c1a21">${esc(number ?? "")}</text></svg>`;
  }
  function playerButton(entry, role, field) {
    const p = entry.player || data.players.find(x => x.id === entry.player_id);
    if (!p) return `<span class="mc-empty-slot">Oyuncu seçiliyor</span>`;
    return `<button type="button" class="${field ? "mc-field-player" : "mc-bench-player"}" data-mc-player="${esc(entry.player_id)}" aria-label="${esc(p.name)} profilini aç">${jersey(p.number)}<span class="mc-player-name">${esc(p.name)}</span><span class="mc-player-role">${esc(role || p.position || "Yedek")}</span></button>`;
  }
  function lineupSection(match) {
    const rows = (data.lineup || []).filter(x => x.match_id === match.id);
    if (!rows.length) return `<section class="mc-panel"><h3>Maç kadrosu</h3><p class="mc-muted">Bu maçın kadrosu henüz paylaşılmadı.</p></section>`;
    const order = (a, b) => Number(a.slot_index || 99) - Number(b.slot_index || 99);
    const starters = rows.filter(x => x.role === "ilk11").sort(order).slice(0, 7);
    const bench = rows.filter(x => x.role === "yedek").sort(order).slice(0, 4);
    const formation = formations[match.lineup_formation] ? match.lineup_formation : "2-3-1";
    const bySlot = new Map(starters.map((entry, index) => [Number(entry.slot_index) || index + 1, entry]));
    const pitch = formations[formation].map(([x, y, role], index) => {
      const entry = bySlot.get(index + 1) || starters[index];
      return `<div class="mc-pitch-slot" style="left:${x}%;top:${y}%">${entry ? playerButton(entry, role, true) : `<span class="mc-empty-slot">${role}</span>`}</div>`;
    }).join("");
    return `<section class="mc-panel"><div class="mc-section-heading"><h3>Maç kadrosu</h3><span>${esc(formation)} · ${starters.length} ilk kadro</span></div>
      <div class="mc-pitch" aria-label="${esc(formation)} dizilişli saha"><div class="mc-pitch-box mc-pitch-box-top"></div><div class="mc-pitch-center"></div><div class="mc-pitch-box mc-pitch-box-bottom"></div><img src="image_09a3ea.png" alt="" class="mc-pitch-watermark">${pitch}</div>
      <h4 class="mc-subheading">Yedekler · ${bench.length}/4</h4><div class="mc-bench">${bench.length ? bench.map(x => playerButton(x, "Yedek", false)).join("") : `<p class="mc-muted">Yedek seçilmedi.</p>`}</div></section>`;
  }
  function goalSection(match) {
    if (!match.played && !match.is_live) return `<section class="mc-panel"><h3>Maç akışı</h3><p class="mc-muted">Maç başlayınca goller burada görünecek.</p></section>`;
    const goals = (data.goals || []).filter(x => x.match_id === match.id && x.side === "acisu");
    const players = new Map([...(data.goalPlayers || []), ...(data.players || [])].map(p => [p.id, p.name]));
    let rows = [];
    if (goals.length === Number(match.our_score || 0)) {
      rows = goals.map((x, index) => `<li class="mc-event"><span class="mc-event-icon">⚽</span><span><strong>${esc(players.get(x.scorer_id) || "Acısu United")}</strong>${x.assist_id ? `<small>Asist: ${esc(players.get(x.assist_id) || "Acısu oyuncusu")}</small>` : ""}</span><span class="mc-event-index">${index + 1}. gol</span></li>`);
    } else {
      rows = (data.stats || []).filter(x => x.match_id === match.id && Number(x.goals) > 0).map(x =>
        `<li class="mc-event"><span class="mc-event-icon">⚽</span><span><strong>${esc(players.get(x.player_id) || "Acısu oyuncusu")}</strong><small>${Number(x.goals)} gol${Number(x.assists) ? ` · ${Number(x.assists)} asist` : ""}</small></span></li>`);
      if (!rows.length && match.goal_scorers) rows = [`<li class="mc-event"><span class="mc-event-icon">⚽</span><span>${esc(match.goal_scorers)}</span></li>`];
    }
    const assists = rows.length ? "" : (data.stats || []).filter(x => x.match_id === match.id && Number(x.assists) > 0).map(x =>
      `<li class="mc-event"><span class="mc-event-icon">🎯</span><span><strong>${esc(players.get(x.player_id) || "Acısu oyuncusu")}</strong><small>${Number(x.assists)} asist</small></span></li>`).join("");
    return `<section class="mc-panel"><h3>Maç akışı</h3>${rows.length || assists ? `<ol class="mc-events">${rows.join("")}${assists}</ol>` : `<p class="mc-muted">Gol ve asist bilgisi henüz girilmedi.</p>`}</section>`;
  }
  function render() {
    if (!activeId || !data) return;
    const match = data.matches.find(x => String(x.id) === activeId);
    if (!match) {
      content.innerHTML = `<p class="mc-muted">Bu maç artık yayında değil.</p>`;
      return;
    }
    const our = {name:"Acısu United", own:true, score:match.our_score};
    const rival = {name:match.opponent, url:match.opponent_image_url, score:match.their_score};
    const left = match.home ? our : rival, right = match.home ? rival : our;
    const coach = (data.staff || []).find(x => x.id === match.head_coach_id);
    const state = match.is_live ? "🔴 CANLI" : match.played ? "MAÇ SONUCU" : "YAKLAŞAN MAÇ";
    content.innerHTML = `<div class="mc-status${match.is_live ? " mc-live" : ""}">${state}</div>
      <section class="mc-scoreboard" aria-label="Maç skoru">
        <div class="mc-team">${crest(left.name, left.url, left.own)}<strong>${esc(left.name)}</strong></div>
        <div class="mc-score">${match.played || match.is_live ? `${esc(left.score ?? 0)}<span>:</span>${esc(right.score ?? 0)}` : `<span>VS</span>`}</div>
        <div class="mc-team">${crest(right.name, right.url, right.own)}<strong>${esc(right.name)}</strong></div>
      </section>
      <p class="mc-detail">${esc(dateText(match.match_at, match.time_confirmed))}${match.venue ? ` · ${esc(match.venue)}` : ""}</p>
      ${coach ? `<button type="button" class="mc-coach" data-coach-id="${esc(coach.id)}">🧢 Teknik direktör: ${esc(coach.name)}</button>` : ""}
      ${goalSection(match)}${lineupSection(match)}`;
  }
  function urlFor(id) {
    const url = new URL(location.href);
    if (id) url.searchParams.set("mac", id); else url.searchParams.delete("mac");
    return url;
  }
  function open(id, updateUrl = true) {
    if (!data?.matches?.some(x => String(x.id) === String(id))) return;
    if (modal.hidden) previousFocus = document.activeElement;
    activeId = String(id);
    render();
    modal.hidden = false;
    document.body.classList.add("match-center-open");
    if (updateUrl) history.pushState({acisuMatch:activeId}, "", urlFor(activeId));
    document.getElementById("close-match-center").focus();
  }
  function close(updateUrl = true) {
    if (modal.hidden) return;
    activeId = null;
    modal.hidden = true;
    document.body.classList.remove("match-center-open");
    if (updateUrl) history.replaceState(history.state, "", urlFor(null));
    previousFocus?.focus?.();
  }
  document.addEventListener("acisu:matches-loaded", event => {
    data = event.detail;
    if (activeId) render();
    else {
      const id = new URLSearchParams(location.search).get("mac");
      if (id && data.matches.some(x => String(x.id) === id)) {
        window.showAcisuTab?.("fixtures", false);
        open(id, false);
      }
    }
  });
  document.getElementById("match-list")?.addEventListener("click", event => {
    const button = event.target.closest("[data-match-center-id]");
    if (button) open(button.dataset.matchCenterId);
  });
  content.addEventListener("click", event => {
    const player = event.target.closest("[data-mc-player]");
    if (player) window.openAcisuPlayerProfile?.(player.dataset.mcPlayer);
  });
  document.getElementById("close-match-center")?.addEventListener("click", () => close());
  modal.addEventListener("click", event => { if (event.target === modal) close(); });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modal.hidden && document.getElementById("player-profile-modal")?.hidden !== false) close();
  });
  window.addEventListener("popstate", () => {
    const id = new URLSearchParams(location.search).get("mac");
    if (id && data?.matches?.some(x => String(x.id) === id)) open(id, false);
    else close(false);
  });
  document.getElementById("share-match-center")?.addEventListener("click", async () => {
    if (!activeId) return;
    const match = data?.matches.find(x => String(x.id) === activeId);
    const title = `Acısu United - ${match?.opponent || "Maç Merkezi"}`;
    const link = urlFor(activeId).href;
    try {
      if (navigator.share) await navigator.share({title, url:link});
      else { await navigator.clipboard.writeText(link); showShareStatus("Bağlantı kopyalandı"); }
    } catch (error) { if (error.name !== "AbortError") showShareStatus("Paylaşım açılamadı"); }
  });
  function showShareStatus(message) {
    const status = document.getElementById("match-center-status");
    status.textContent = message;
    setTimeout(() => { if (status.textContent === message) status.textContent = ""; }, 2500);
  }
  if (data) {
    const id = new URLSearchParams(location.search).get("mac");
    if (id && data.matches.some(x => String(x.id) === id)) {
      window.showAcisuTab?.("fixtures", false);
      open(id, false);
    }
  }
})();
