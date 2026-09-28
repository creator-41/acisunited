(function () {
  const app = window.acisuAdmin;
  if (!app) return;
  const db = app.db;
  const $ = id => document.getElementById(id);
  const esc = app.escapeHtml;
  const matchSelect = $("goal-video-match");
  const playerSelect = $("goal-video-player");
  const form = $("goal-video-form");
  const list = $("goal-video-list");
  let scorers = new Map();
  let editingId = null;

  function renderMatches() {
    const selected = matchSelect.value;
    const matches = app.getMatches().filter(m => m.played || m.is_live);
    matchSelect.replaceChildren(new Option("Maç seç", ""), ...matches.map(m =>
      new Option(`${m.opponent} · ${new Intl.DateTimeFormat("tr-TR", {timeZone:"Europe/Istanbul",day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(m.match_at))}`, m.id)
    ));
    if (matches.some(m => m.id === selected)) matchSelect.value = selected;
    if (matchSelect.value !== selected) loadVideos();
  }
  async function loadVideos() {
    editingId = null;
    form.reset();
    playerSelect.replaceChildren(new Option("Önce maç seç", ""));
    scorers = new Map();
    const matchId = matchSelect.value;
    list.textContent = matchId ? "Gol kayıtları yükleniyor…" : "Önce maç seç.";
    if (!matchId) return;
    const [goalsResult, videosResult] = await Promise.all([
      db.from("acisu_goal_log").select("scorer_id").eq("match_id", matchId).eq("side", "acisu"),
      db.from("acisu_goal_videos").select("id,match_id,player_id,title,video_url,created_at").eq("match_id", matchId).order("created_at")
    ]);
    if (goalsResult.error || videosResult.error) {
      list.textContent = "Videolar yüklenemedi: " + (goalsResult.error || videosResult.error).message;
      return;
    }
    const names = new Map(app.getPlayers().map(p => [p.id, p.name]));
    for (const goal of goalsResult.data || []) {
      if (goal.scorer_id) scorers.set(goal.scorer_id, (scorers.get(goal.scorer_id) || 0) + 1);
    }
    playerSelect.replaceChildren(new Option(scorers.size ? "Golcüyü seç" : "Bu maçta golcü kaydı yok", ""));
    for (const [id, count] of scorers) playerSelect.add(new Option(`${names.get(id) || "Oyuncu"} · ${count} gol`, id));
    const videos = videosResult.data || [];
    list.innerHTML = videos.length ? videos.map(v => `<div class="list-row">
      <span><strong>${esc(names.get(v.player_id) || "Oyuncu")} · ${esc(v.title)}</strong>
        <small class="block muted mt-1">${scorers.has(v.player_id) ? "" : "⚠ Bu oyuncunun mevcut gol kaydı yok; video sitede gizli. "}
        <a href="${esc(safeUrl(v.video_url))}" target="_blank" rel="noopener noreferrer" class="underline text-altin">Videoyu aç</a></small></span>
      <span class="list-actions"><button type="button" data-edit-video="${esc(v.id)}">Düzenle</button>
        <button type="button" data-delete-video="${esc(v.id)}">Sil</button></span></div>`).join("") : '<p class="muted py-4">Bu maça henüz video bağlantısı eklenmedi.</p>';
    list._videos = videos;
  }
  function safeUrl(value) {
    try { const u = new URL(value); return u.protocol === "https:" ? u.href : "#"; }
    catch { return "#"; }
  }
  matchSelect.addEventListener("change", loadVideos);
  window.addEventListener("acisu:admin-refreshed", renderMatches);
  document.querySelector('[data-tab="goal-videos"]')?.addEventListener("click", renderMatches);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const url = form.elements.namedItem("video_url").value.trim();
    if (safeUrl(url) === "#") { app.notice("Video bağlantısı https:// ile başlamalı."); return; }
    const payload = {
      match_id: matchSelect.value, player_id: playerSelect.value,
      title: form.elements.namedItem("title").value.trim() || "Gol videosu", video_url: url
    };
    if (!payload.match_id || !scorers.has(payload.player_id)) { app.notice("Bu maçta gol atan oyuncuyu seç."); return; }
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    const result = editingId
      ? await db.from("acisu_goal_videos").update(payload).eq("id", editingId)
      : await db.from("acisu_goal_videos").insert(payload);
    button.disabled = false;
    if (result.error) { app.notice("Video kaydedilemedi: " + result.error.message); return; }
    app.notice("Gol videosu kaydedildi.");
    await loadVideos();
  });
  list.addEventListener("click", async event => {
    const edit = event.target.closest("[data-edit-video]");
    if (edit) {
      const video = (list._videos || []).find(v => v.id === edit.dataset.editVideo);
      if (!video) return;
      editingId = video.id;
      playerSelect.value = scorers.has(video.player_id) ? video.player_id : "";
      form.elements.namedItem("title").value = video.title;
      form.elements.namedItem("video_url").value = video.video_url;
      form.scrollIntoView({behavior:"smooth",block:"nearest"});
      return;
    }
    const del = event.target.closest("[data-delete-video]");
    if (!del || !confirm("Bu gol videosu bağlantısını silmek istiyor musun?")) return;
    const {error} = await db.from("acisu_goal_videos").delete().eq("id", del.dataset.deleteVideo);
    if (error) app.notice("Video silinemedi: " + error.message);
    else { app.notice("Video bağlantısı silindi."); await loadVideos(); }
  });
  $("goal-video-cancel")?.addEventListener("click", () => { editingId = null; form.reset(); });
  renderMatches();
})();
