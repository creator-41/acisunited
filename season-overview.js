(function () {
  const box = document.getElementById("public-stats");
  if (!box) return;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const yearInTurkey = value => Number(new Intl.DateTimeFormat("en-US", {
    year: "numeric", timeZone: "Europe/Istanbul"
  }).format(new Date(value)));
  const year = yearInTurkey(new Date());

  function render(data) {
    if (!data?.matches || !data?.stats) return;
    const completed = data.matches.filter(match => match.published !== false && match.played && !match.is_live && yearInTurkey(match.match_at) === year);
    const upcoming = data.matches.filter(match => match.published !== false && !match.played && !match.is_live && yearInTurkey(match.match_at) === year).length;
    const matchIds = new Set(completed.map(match => match.id));
    const wins = completed.filter(m => Number(m.our_score) > Number(m.their_score)).length;
    const draws = completed.filter(m => Number(m.our_score) === Number(m.their_score)).length;
    const losses = completed.length - wins - draws;
    const scored = completed.reduce((sum, m) => sum + Number(m.our_score || 0), 0);
    const conceded = completed.reduce((sum, m) => sum + Number(m.their_score || 0), 0);
    const people = new Map([...(data.goalPlayers || []), ...(data.players || [])].map(p => [p.id, p.name]));
    const players = new Map();
    for (const stat of data.stats.filter(s => matchIds.has(s.match_id))) {
      const row = players.get(stat.player_id) || { id: stat.player_id, name: people.get(stat.player_id) || "Oyuncu", goals: 0, assists: 0 };
      row.goals += Number(stat.goals || 0);
      row.assists += Number(stat.assists || 0);
      players.set(stat.player_id, row);
    }
    const leaders = field => [...players.values()].filter(p => p[field] > 0)
      .sort((a, b) => b[field] - a[field] || a.name.localeCompare(b.name, "tr"))
      .slice(0, 5);
    const statCard = (value, label, color = "text-white") => `<div class="rounded-2xl border border-altin/20 bg-[#1c1215] p-3 text-center"><strong class="block font-baslik text-3xl ${color}">${esc(value)}</strong><span class="text-[11px] text-gray-300">${label}</span></div>`;
    const leaderboard = (title, icon, field) => {
      const rows = leaders(field);
      return `<section class="rounded-2xl border border-altin/25 bg-[#1c1215] p-5">
        <h3 class="font-baslik text-2xl text-altin">${icon} ${title}</h3>
        ${rows.length ? `<ol class="mt-4 divide-y divide-white/10">${rows.map((p, index) =>
          `<li class="flex items-center gap-3 py-3 text-sm"><span class="w-6 text-altin font-bold">${index + 1}.</span><span class="min-w-0 flex-1 truncate text-white">${esc(p.name)}</span><strong class="font-baslik text-xl text-altin">${p[field]}</strong></li>`).join("")}</ol>`
          : `<p class="mt-4 text-sm text-gray-300">Henüz kayıtlı ${field === "goals" ? "gol" : "asist"} yok.</p>`}</section>`;
    };
    box.innerHTML = `<div class="relative overflow-hidden rounded-3xl border border-altin/40 bg-gradient-to-br from-[#361820] via-[#1c1115] to-[#0e0b0c] p-5 sm:p-8">
      <img src="image_09a3ea.png" alt="" class="pointer-events-none absolute -right-12 -top-12 w-48 opacity-10 sm:w-64">
      <div class="relative"><p class="text-xs font-bold uppercase tracking-[.25em] text-altin">Acısu United · ${year}</p>
        <h3 class="mt-2 font-baslik text-3xl text-white sm:text-4xl">SEZONUN DURUMU</h3>
        <p class="mt-2 text-sm text-gray-300">${completed.length} tamamlanan maç${upcoming ? ` · ${upcoming} oynanacak maç` : ""}</p>
        <div class="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">${statCard(completed.length, "MAÇ")}${statCard(wins, "GALİBİYET", "text-emerald-300")}${statCard(draws, "BERABERLİK", "text-altin")}${statCard(losses, "MAĞLUBİYET", "text-red-300")}${statCard(scored, "ATILAN GOL")}${statCard(conceded, "YENİLEN GOL")}</div>
        <p class="mt-4 text-sm text-gray-300">Averaj <strong class="text-white">${scored - conceded > 0 ? "+" : ""}${scored - conceded}</strong> · Maç başına <strong class="text-white">${completed.length ? (scored / completed.length).toLocaleString("tr-TR", {maximumFractionDigits: 1}) : "0"}</strong> gol</p>
      </div></div>
      <div class="grid gap-4 md:grid-cols-2">${leaderboard("Gol krallığı", "⚽", "goals")}${leaderboard("Asist liderleri", "🎯", "assists")}</div>
      <p class="text-center text-xs text-gray-400">Yalnızca tamamlanan ve yayımlanmış maçlar hesaplanır. Geçmiş sezonlar Arşiv sekmesinde yer alır.</p>`;
  }
  document.addEventListener("acisu:matches-loaded", event => render(event.detail));
  if (window.acisuMatchCenterData) render(window.acisuMatchCenterData);
})();
