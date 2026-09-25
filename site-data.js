(function () {
  const url = window.ACISU_SUPABASE_URL;
  const key = window.ACISU_SUPABASE_KEY;
  if (!url || !key || !window.supabase) return;

  const db = window.supabase.createClient(url, key);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  const safeImage = value => {
    const image = String(value || "");
    return /^(?:[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp)|https:\/\/[a-zA-Z0-9.-]+\/[^\s"'<>]*)$/i.test(image)
      ? image : "image_09a3ea.png";
  };
  const dateText = (value, timeConfirmed = true) => new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit",
    year: "numeric", ...(timeConfirmed ? { hour: "2-digit", minute: "2-digit" } : {})
  }).format(new Date(value));

  async function load() {
    const [playersResult, matchesResult] = await Promise.all([
      db.from("acisu_players").select("*").eq("active", true).order("number"),
      db.from("acisu_matches").select("*").eq("published", true).order("match_at", { ascending: false })
    ]);
    if (playersResult.error || matchesResult.error) {
      console.error("Acısu verileri yüklenemedi", playersResult.error || matchesResult.error);
      return;
    }
    const players = playersResult.data || [];
    window.teamSquad = players.map(p => ({
      name: esc(p.name), pos: esc(p.position),
      img: esc(safeImage(p.image_url)), number: p.number,
      ovr: p.rating, pace: p.pace, pas: p.passing, def: p.defense
    }));
    window.renderSquad();

    const matches = matchesResult.data || [];
    const list = document.getElementById("match-list");
    const fallback = document.getElementById("match-fallback");
    fallback.hidden = true;
    list.innerHTML = matches.length ? matches.map(m => {
      const ourTeam = `<div class="flex flex-col items-center w-full md:w-1/3">
          <img src="image_09a3ea.png" alt="Acısu United" class="w-20 h-20 object-contain mb-4">
          <h3 class="font-baslik text-2xl font-bold text-white text-center">ACISU UNITED</h3></div>`;
      const opponent = `<div class="flex flex-col items-center w-full md:w-1/3">
          <div class="w-20 h-20 rounded-full bg-yellow-900/20 border border-yellow-700/30 flex items-center justify-center mb-4">
            <span class="font-baslik text-sm text-yellow-600 text-center break-words px-1">${esc(m.opponent)}</span>
          </div><h3 class="font-baslik text-2xl font-bold text-gray-400 text-center">${esc(m.opponent)}</h3></div>`;
      const score = m.played
        ? `<div class="bg-siyah border-2 border-white/10 px-8 py-4 rounded-xl flex items-center gap-4 shadow-inner">
             <span class="font-baslik text-5xl font-bold text-white">${m.home ? m.our_score : m.their_score}</span>
             <span class="text-gray-500 text-2xl">-</span>
             <span class="font-baslik text-5xl font-bold text-altin">${m.home ? m.their_score : m.our_score}</span>
           </div>`
        : '<div class="bg-siyah border-2 border-white/10 px-5 py-4 rounded-xl text-altin font-bold">VS</div>';
      return `<article class="bg-siyah border border-bordo/30 rounded-2xl p-6 md:p-10 mb-5 shadow-[0_0_30px_rgba(92,26,33,0.2)] relative overflow-hidden">
        <img src="image_09a3ea.png" alt="" class="absolute -right-20 -bottom-20 w-96 opacity-5 pointer-events-none">
        <div class="text-center mb-6 relative">
          <span class="bg-bordo text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">${m.played ? "Maç Sonucu" : "Yaklaşan Maç"}</span>
          <p class="text-gray-400 text-sm mt-3">${esc(m.venue)} · ${esc(dateText(m.match_at, m.time_confirmed))}</p>
        </div>
        <div class="flex flex-col md:flex-row items-center justify-between gap-8 relative">
          ${m.home ? ourTeam : opponent}
          <div class="flex flex-col items-center w-full md:w-1/3">${score}</div>
          ${m.home ? opponent : ourTeam}
        </div>
        ${m.played && m.goal_scorers ? `<div class="mt-10 pt-6 border-t border-white/10 text-center relative">
          <h4 class="text-altin font-bold text-sm uppercase tracking-widest mb-4">Acısu United Golleri</h4>
          <p class="text-gray-300">⚽ ${esc(m.goal_scorers)}</p></div>` : ""}
      </article>`;
    }).join("") : '<p class="text-center text-gray-300">Henüz maç eklenmedi.</p>';

    const lineupBox = document.getElementById("lineup-content");
    const { data: allLineup, error } = await db.from("acisu_match_lineup")
      .select("match_id, role, player:acisu_players(name, number)");
    if (error) {
      lineupBox.textContent = "Maç kadrosu yüklenemedi.";
      return;
    }
    const withLineup = new Set((allLineup || []).map(x => x.match_id));
    const candidates = matches.filter(m => withLineup.has(m.id));
    const upcoming = candidates.filter(m => new Date(m.match_at) >= new Date())
      .sort((a, b) => new Date(a.match_at) - new Date(b.match_at));
    const next = upcoming[0] || candidates.sort((a, b) =>
      new Date(b.match_at) - new Date(a.match_at))[0];
    if (!next) {
      lineupBox.textContent = "Maç kadrosu henüz paylaşılmadı.";
      return;
    }
    const lineup = allLineup.filter(x => x.match_id === next.id);
    const group = role => lineup.filter(x => x.role === role && x.player)
      .sort((a, b) => a.player.number - b.player.number)
      .map(x => `<li class="py-2 border-b border-white/10">#${x.player.number} ${esc(x.player.name)}</li>`).join("");
    lineupBox.innerHTML = `<h3 class="text-xl text-altin mb-3">${esc(next.opponent)} · ${esc(dateText(next.match_at))}</h3>
      <div class="grid sm:grid-cols-2 gap-8 text-left">
        <div><h4 class="font-bold mb-2">İlk kadro</h4><ul>${group("ilk11") || "Henüz seçilmedi"}</ul></div>
        <div><h4 class="font-bold mb-2">Yedekler</h4><ul>${group("yedek") || "Henüz seçilmedi"}</ul></div>
      </div>`;
  }
  load();
})();
