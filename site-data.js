(function () {
  const url = window.ACISU_SUPABASE_URL;
  const key = window.ACISU_SUPABASE_KEY;
  if (!url || !key || !window.supabase) return;

  const db = window.acisuDb || (window.acisuDb = window.supabase.createClient(url, key));
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


  let profileData = { players: [], matches: [], stats: [] };
  function renderPublicSponsors(records) {
    const box = document.getElementById("public-sponsors");
    if (!box) return;
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const today = `${parts.find(x=>x.type==="year").value}-${parts.find(x=>x.type==="month").value}-${parts.find(x=>x.type==="day").value}`;
    const sponsors = records.filter(s => s.active && (!s.starts_at || s.starts_at <= today)
      && (!s.ends_at || s.ends_at >= today))
      .sort((a,b) => (a.tier === "main" ? -1 : 1) - (b.tier === "main" ? -1 : 1) || a.sort_order-b.sort_order);
    if (!sponsors.length) {
      box.innerHTML = '<p class="text-gray-400">Sponsorlarımız çok yakında burada.</p>';
      return;
    }
    box.innerHTML = sponsors.map(s => {
      const website = (() => { try { const u=new URL(s.website_url); return u.protocol==="https:" ? u.href : ""; } catch (_) { return ""; } })();
      const logo = s.logo_url ? `<img src="${esc(safeImage(s.logo_url))}" alt="${esc(s.name)} logosu" class="max-w-48 h-20 object-contain mb-3" loading="lazy">` : "";
      const content = `<span class="text-xs text-gray-400 uppercase tracking-widest mb-2">${s.tier==="main"?"Ana Sponsor":"Destekçimiz"}</span>${logo}<h3 class="font-baslik text-2xl sm:text-3xl font-bold text-white text-center">${esc(s.name)}</h3>`;
      return website
        ? `<a href="${esc(website)}" target="_blank" rel="noopener noreferrer" class="bg-white/5 border border-white/10 min-w-56 px-8 py-7 rounded-2xl hover:bg-white/10 transition-colors flex flex-col items-center">${content}<span class="sr-only">Sponsor sitesini yeni sekmede aç</span></a>`
        : `<div class="bg-white/5 border border-white/10 min-w-56 px-8 py-7 rounded-2xl flex flex-col items-center">${content}</div>`;
    }).join("");
  }
  function wirePlayerProfiles(players, matches, stats) {
    profileData = { players, matches, stats };
    const box = document.getElementById("squad-container");
    if (!box || box.dataset.profileWired) return;
    box.dataset.profileWired = "1";
    const modal = document.getElementById("player-profile-modal");
    const content = document.getElementById("player-profile-content");
    const close = () => { modal.hidden = true; document.body.classList.remove("overflow-hidden"); };
    document.getElementById("close-player-profile")?.addEventListener("click", close);
    modal?.addEventListener("click", event => { if (event.target === modal) close(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && !modal.hidden) close(); });
    const show = playerId => {
      const { players, matches, stats } = profileData;
      const player = players.find(p => p.id === playerId);
      if (!player) return;
      const own = stats.filter(s => s.player_id === playerId);
      const total = key => own.reduce((sum,s) => sum + Number(s[key] || 0),0);
      const games = own.filter(s => s.played).length, goals=total("goals"), assists=total("assists");
      const points=games*2+goals*5+assists*2-total("yellow_cards")-total("red_cards")*3;
      const seasonMap = new Map();
      for (const stat of own) {
        const match = matches.find(m => m.id === stat.match_id);
        if (!match) continue;
        const year = new Intl.DateTimeFormat("en-US",{year:"numeric",timeZone:"Europe/Istanbul"}).format(new Date(match.match_at));
        const row=seasonMap.get(year)||{year,games:0,goals:0,assists:0};
        if(stat.played) row.games++;
        row.goals+=Number(stat.goals||0); row.assists+=Number(stat.assists||0); seasonMap.set(year,row);
      }
      const recent = own.map(stat => ({stat,match:matches.find(m=>m.id===stat.match_id)}))
        .filter(x=>x.match && (x.match.played || x.match.is_live))
        .sort((a,b)=>new Date(b.match.match_at)-new Date(a.match.match_at)).slice(0,5);
      const safePic = safeImage(player.image_url);
      content.innerHTML = `<div class="text-center pt-3">
        <img src="${esc(safePic)}" alt="${esc(player.name)}" class="w-28 h-28 rounded-full object-cover mx-auto border-2 border-altin/70 shadow-lg" onerror="this.onerror=null;this.src='image_09a3ea.png'">
        <p class="text-altin font-baslik text-lg mt-3">#${player.number} · ${esc(player.position)}</p>
        <h2 id="profile-name" class="font-baslik text-3xl text-white uppercase mt-1">${esc(player.name)}</h2>
        <p class="text-gray-400 text-xs mt-2">ACISU UNITED OYUNCU PROFİLİ</p></div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6">
          ${[[games,"MAÇ"],[goals,"GOL"],[assists,"ASİST"],[points+" P","PUAN"]].map(([v,l])=>`<div class="rounded-xl border border-white/10 bg-white/5 text-center py-3"><strong class="font-baslik text-2xl text-altin">${v}</strong><span class="block text-[10px] text-gray-400 tracking-wider">${l}</span></div>`).join("")}
        </div>
        <div class="mt-6"><h3 class="font-baslik text-xl text-altin mb-2">Sezonlara göre</h3>
          <div class="divide-y divide-white/10">${[...seasonMap.values()].sort((a,b)=>b.year-a.year).map(x=>`<div class="py-2 flex justify-between gap-2 text-sm"><strong>${x.year}</strong><span class="text-gray-300">${x.games} maç · ${x.goals} gol · ${x.assists} asist</span></div>`).join("")||'<p class="text-gray-400 text-sm">Henüz sezon istatistiği yok.</p>'}</div></div>
        <div class="mt-5"><h3 class="font-baslik text-xl text-altin mb-2">Son maç katkıları</h3>
          <div class="space-y-2">${recent.map(({stat:s,match:m})=>`<div class="rounded-lg bg-white/5 p-3 flex justify-between gap-3 text-sm"><span>${esc(m.opponent)}<small class="block text-gray-500">${esc(dateText(m.match_at,false))} · ${m.our_score??0}-${m.their_score??0}</small></span><span class="text-right text-gray-300">${s.played?"Oynadı":"-"}${s.goals?" · ⚽ "+s.goals:""}${s.assists?" · 🅰 "+s.assists:""}</span></div>`).join("")||'<p class="text-gray-400 text-sm">Henüz maç katkısı yok.</p>'}</div></div>
        <button id="profile-share-player" type="button" class="mt-5 w-full rounded-xl border border-altin/40 py-3 text-altin font-bold">Oyuncu görseli hazırla</button>`;
      const share=document.getElementById("profile-share-player");
      share?.addEventListener("click",()=>{close();window.dispatchEvent(new CustomEvent("acisu:share-player",{detail:{playerId}}));});
      modal.hidden=false; document.body.classList.add("overflow-hidden");
    };
    box.addEventListener("click",event=>{const card=event.target.closest("[data-player-id]");if(card)show(card.dataset.playerId);});
    box.addEventListener("keydown",event=>{if((event.key==="Enter"||event.key===" ")&&event.target.matches("[data-player-id]")){event.preventDefault();show(event.target.dataset.playerId);}});
  }

  async function load() {
    const [playersResult, matchesResult, goalResult, goalPlayersResult, staffResult, statsResult, sponsorsResult] = await Promise.all([
      db.from("acisu_players").select("*").eq("active", true).order("number"),
      db.from("acisu_matches").select("*").eq("published", true).order("match_at", { ascending: false }),
      db.from("acisu_goal_log").select("match_id,side,scorer_id,assist_id,created_at").order("created_at"),
      db.from("acisu_players").select("id,name"),
      db.from("acisu_staff").select("*").eq("active", true).order("sort_order").order("created_at"),
      db.from("acisu_player_stats").select("match_id,player_id,played,goals,assists,yellow_cards,red_cards"),
      db.from("acisu_sponsors").select("*").order("sort_order")
    ]);
    if (playersResult.error || matchesResult.error || goalResult.error || goalPlayersResult.error || staffResult.error || statsResult.error || sponsorsResult.error) {
      console.error("Acısu verileri yüklenemedi", playersResult.error || matchesResult.error || goalResult.error || goalPlayersResult.error || staffResult.error || statsResult.error || sponsorsResult.error);
      return;
    }
    const players = playersResult.data || [];
    window.teamSquad = players.map(p => ({
      id: p.id, name: esc(p.name), pos: esc(p.position),
      img: esc(safeImage(p.image_url)), number: p.number,
      ovr: p.rating, pace: p.pace, pas: p.passing, def: p.defense
    }));
    window.renderSquad();
    window.technicalStaff = (staffResult.data || []).map(p => ({
      name: esc(p.name), pos: esc(p.role), img: esc(safeImage(p.image_url)),
      ovr: p.rating, pace: p.pace, pas: p.passing, def: p.defense
    }));
    window.renderCoach();

    const matches = matchesResult.data || [];
    const profileStats = statsResult.data || [];
    renderPublicSponsors(sponsorsResult.data || []);
    wirePlayerProfiles(players, matches, profileStats);
    const namesById = new Map((goalPlayersResult.data || []).map(p => [p.id, p.name]));
    const goalsByMatch = new Map();
    for (const goal of goalResult.data || []) {
      if (goal.side !== "acisu") continue;
      const bucket = goalsByMatch.get(goal.match_id) || [];
      bucket.push(goal);
      goalsByMatch.set(goal.match_id, bucket);
    }
    const statsByMatch = new Map();
    for (const stat of statsResult.data || []) {
      const bucket = statsByMatch.get(stat.match_id) || [];
      bucket.push(stat);
      statsByMatch.set(stat.match_id, bucket);
    }
    const list = document.getElementById("match-list");
    const fallback = document.getElementById("match-fallback");
    fallback.hidden = true;
    list.innerHTML = matches.length ? matches.map(m => {
      const ourTeam = `<div class="flex flex-col items-center w-full md:w-1/3">
          <img src="image_09a3ea.png" alt="Acısu United" class="w-20 h-20 object-contain mb-4">
          <h3 class="font-baslik text-2xl font-bold text-white text-center">ACISU UNITED</h3></div>`;
      const opponent = `<div class="flex flex-col items-center w-full md:w-1/3">
          ${m.opponent_image_url
            ? `<img src="${esc(safeImage(m.opponent_image_url))}" alt="${esc(m.opponent)} arması" class="w-20 h-20 object-contain mb-4" onerror="this.onerror=null;this.src='image_09a3ea.png'">`
            : `<div class="w-20 h-20 rounded-full bg-yellow-900/20 border border-yellow-700/30 flex items-center justify-center mb-4"><span class="font-baslik text-sm text-yellow-600 text-center break-words px-1">${esc(m.opponent)}</span></div>`}
          <h3 class="font-baslik text-2xl font-bold text-gray-400 text-center">${esc(m.opponent)}</h3></div>`;
      const score = m.played || m.is_live
        ? `<div class="bg-siyah border-2 border-white/10 px-8 py-4 rounded-xl flex items-center gap-4 shadow-inner">
             <span class="font-baslik text-5xl font-bold text-white">${m.home ? m.our_score : m.their_score}</span>
             <span class="text-gray-500 text-2xl">-</span>
             <span class="font-baslik text-5xl font-bold text-altin">${m.home ? m.their_score : m.our_score}</span>
           </div>`
        : '<div class="bg-siyah border-2 border-white/10 px-5 py-4 rounded-xl text-altin font-bold">VS</div>';
      const goalGroups = new Map();
      const matchGoalRows = goalsByMatch.get(m.id) || [];
      for (const goal of matchGoalRows) {
        const key = `${goal.scorer_id || ""}|${goal.assist_id || ""}`;
        const group = goalGroups.get(key) || { scorer_id: goal.scorer_id, assist_id: goal.assist_id, count: 0 };
        group.count++;
        goalGroups.set(key, group);
      }
      const loggedScorers = [...goalGroups.values()].map(g => {
        const name = namesById.get(g.scorer_id) || "Acısu oyuncusu";
        const assist = namesById.get(g.assist_id);
        return `<li class="flex items-start justify-center gap-2 text-gray-200"><span class="text-altin" aria-hidden="true">⚽</span><span><strong>${esc(name)}</strong>${g.count > 1 ? ` <span class="text-altin">× ${g.count}</span>` : ""}${assist ? ` <span class="text-gray-400">(asist: ${esc(assist)})</span>` : ""}</span></li>`;
      }).join("");
      const matchStats = statsByMatch.get(m.id) || [];
      const scored = matchGoalRows.length === Number(m.our_score || 0) ? loggedScorers : "";
      const statsGoals = matchStats.filter(s => Number(s.goals) > 0).map(s => {
        const name = namesById.get(s.player_id) || "Acısu oyuncusu";
        return `<li class="flex items-start justify-center gap-2 text-gray-200"><span class="text-altin" aria-hidden="true">⚽</span><span><strong>${esc(name)}</strong>${Number(s.goals) > 1 ? ` <span class="text-altin">× ${Number(s.goals)}</span>` : ""}</span></li>`;
      }).join("");
      const statsAssists = matchStats.filter(s => Number(s.assists) > 0).map(s => {
        const name = namesById.get(s.player_id) || "Acısu oyuncusu";
        return `<li class="flex items-start justify-center gap-2 text-gray-400"><span aria-hidden="true">🅰️</span><span><strong>${esc(name)}</strong>${Number(s.assists) > 1 ? ` × ${Number(s.assists)}` : ""}</span></li>`;
      }).join("");
      const statsDetails = statsGoals || statsAssists ? `${statsGoals}${statsAssists}` : "";
      const legacyScorers = !scored && !statsDetails && m.goal_scorers ? `<li class="text-gray-300">⚽ ${esc(m.goal_scorers)}</li>` : "";
      const goalDetails = scored || statsDetails || legacyScorers;
      const goalHeading = !scored && statsAssists ? "Acısu United Golleri ve Asistler" : "Acısu United Golleri";
      return `<article class="bg-siyah border border-bordo/30 rounded-2xl p-6 md:p-10 mb-5 shadow-[0_0_30px_rgba(92,26,33,0.2)] relative overflow-hidden">
        <img src="image_09a3ea.png" alt="" class="absolute -right-20 -bottom-20 w-96 opacity-5 pointer-events-none">
        <div class="text-center mb-6 relative">
          <span class="${m.is_live ? "bg-red-600 live-pulse" : "bg-bordo"} text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">${m.is_live ? "🔴 CANLI" : m.played ? "Maç Sonucu" : "Yaklaşan Maç"}</span>
          <p class="text-gray-400 text-sm mt-3">${esc(m.venue)} · ${esc(dateText(m.match_at, m.time_confirmed))}</p>
        </div>
        <div class="flex flex-col md:flex-row items-center justify-between gap-8 relative">
          ${m.home ? ourTeam : opponent}
          <div class="flex flex-col items-center w-full md:w-1/3">${score}</div>
          ${m.home ? opponent : ourTeam}
        </div>
        ${goalDetails ? `<div class="mt-8 pt-5 border-t border-white/10 text-center relative">
          <h4 class="text-altin font-bold text-sm uppercase tracking-widest mb-3">${goalHeading}</h4>
          <ul class="grid gap-2">${scored || statsDetails || legacyScorers}</ul></div>` : ""}
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
  window.acisuReloadSite = load;
  load();
})();
