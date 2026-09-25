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
      const score = m.played
        ? `<span class="text-4xl text-white font-bold">${m.our_score} <span class="text-gray-500">-</span> <span class="text-altin">${m.their_score}</span></span>`
        : '<span class="text-altin font-bold">Yaklaşan Maç</span>';
      return `<article class="bg-siyah border border-bordo/30 rounded-2xl p-6 mb-5">
        <p class="text-center text-sm text-gray-300 mb-5">${esc(dateText(m.match_at, m.time_confirmed))} · ${esc(m.venue)}</p>
        <div class="flex items-center justify-between gap-2 text-center font-baslik text-lg sm:text-2xl">
          <span class="w-1/3">${m.home ? "ACISU UNITED" : esc(m.opponent)}</span>
          <span class="w-1/3">${score}</span>
          <span class="w-1/3">${m.home ? esc(m.opponent) : "ACISU UNITED"}</span>
        </div>
        ${m.played && m.goal_scorers ? `<p class="text-center mt-5 text-sm text-altin">⚽ ${esc(m.goal_scorers)}</p>` : ""}
      </article>`;
    }).join("") : '<p class="text-center text-gray-300">Henüz maç eklenmedi.</p>';

    const next = [...matches].filter(m => !m.played).sort((a, b) =>
      new Date(a.match_at) - new Date(b.match_at))[0];
    const lineupBox = document.getElementById("lineup-content");
    if (!next) {
      lineupBox.textContent = "Yaklaşan maç kadrosu henüz paylaşılmadı.";
      return;
    }
    const { data: lineup, error } = await db.from("acisu_match_lineup")
      .select("role, player:acisu_players(name, number)")
      .eq("match_id", next.id);
    if (error) {
      lineupBox.textContent = "Maç kadrosu yüklenemedi.";
      return;
    }
    if (!lineup?.length) {
      lineupBox.textContent = "Yaklaşan maç kadrosu henüz paylaşılmadı.";
      return;
    }
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
