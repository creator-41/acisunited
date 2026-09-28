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
    let visualUrl=null,visualBlob=null;
    const close = () => { modal.hidden = true; document.body.classList.remove("overflow-hidden"); if(visualUrl){URL.revokeObjectURL(visualUrl);visualUrl=null;} };
    document.getElementById("close-player-profile")?.addEventListener("click", close);
    modal?.addEventListener("click", event => { if (event.target === modal) close(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && !modal.hidden) close(); });
    const createPlayerVisual = async player => {
      const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=1350;
      const ctx=canvas.getContext("2d");
      const gradient=ctx.createLinearGradient(0,0,1080,1350);
      gradient.addColorStop(0,"#10090d");gradient.addColorStop(.52,"#471923");gradient.addColorStop(1,"#09080a");
      ctx.fillStyle=gradient;ctx.fillRect(0,0,1080,1350);
      const crest=new Image();crest.src="image_09a3ea.png";
      try{await crest.decode();}catch{}
      ctx.save();ctx.globalAlpha=.13;if(crest.complete&&crest.naturalWidth){ctx.drawImage(crest,530,350,500,500);}ctx.restore();
      ctx.strokeStyle="#c7a878";ctx.lineWidth=4;ctx.strokeRect(48,48,984,1254);
      ctx.strokeStyle="#e0bc81";ctx.lineWidth=8;
      for(const [x,y,dx,dy] of [[48,48,1,1],[1032,48,-1,1],[48,1302,1,-1],[1032,1302,-1,-1]]){ctx.beginPath();ctx.moveTo(x+dx*54,y);ctx.lineTo(x,y);ctx.lineTo(x,y+dy*54);ctx.stroke();}
      if(crest.complete&&crest.naturalWidth)ctx.drawImage(crest,82,78,100,100);
      ctx.textAlign="left";ctx.font='700 50px "Oswald",Impact,sans-serif';ctx.fillStyle="#f7f1e7";ctx.fillText("ACISU",208,142);ctx.fillStyle="#c7a878";ctx.fillText("UNITED",362,142);
      ctx.fillStyle="#c7a878";ctx.fillRect(86,204,908,2);
      ctx.textAlign="center";ctx.font='700 43px "Oswald",Impact,sans-serif';ctx.fillText("OYUNCU PROFİLİ",540,286);
      const photo=new Image();photo.crossOrigin="anonymous";photo.src=safeImage(player.image_url);
      try{await photo.decode();}catch{}
      ctx.save();ctx.beginPath();ctx.arc(540,492,170,0,Math.PI*2);ctx.clip();
      if(photo.complete&&photo.naturalWidth)ctx.drawImage(photo,370,322,340,340);
      else if(crest.complete&&crest.naturalWidth)ctx.drawImage(crest,370,322,340,340);
      else{ctx.fillStyle="#26141a";ctx.fillRect(370,322,340,340);}
      ctx.restore();ctx.strokeStyle="#dfbd85";ctx.lineWidth=9;ctx.beginPath();ctx.arc(540,492,174,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle="#e4c48f";ctx.font='700 33px "Oswald",Impact,sans-serif';ctx.fillText("#"+(player.number??"—")+"  ·  "+(player.position||"OYUNCU").toLocaleUpperCase("tr-TR"),540,725);
      let nameSize=82;ctx.font='700 '+nameSize+'px "Oswald",Impact,sans-serif';
      while(ctx.measureText(player.name||"").width>890&&nameSize>48){nameSize-=2;ctx.font='700 '+nameSize+'px "Oswald",Impact,sans-serif';}
      ctx.fillStyle="#fff";ctx.fillText((player.name||"").toLocaleUpperCase("tr-TR"),540,817);
      const own=profileData.stats.filter(s=>s.player_id===player.id),sum=k=>own.reduce((n,r)=>n+Number(r[k]||0),0),games=own.filter(r=>r.played).length;
      const values=[[games,"MAÇ"],[sum("goals"),"GOL"],[sum("assists"),"ASİST"],[games*2+sum("goals")*5+sum("assists")*2-sum("yellow_cards")-sum("red_cards")*3,"PUAN"]];
      values.forEach((v,i)=>{const x=76+i*232;ctx.fillStyle="rgba(255,255,255,.075)";ctx.beginPath();ctx.roundRect(x,925,210,162,20);ctx.fill();ctx.fillStyle="#dfbd85";ctx.font='700 61px "Oswald",Impact,sans-serif';ctx.fillText(String(v[0]),x+105,1000);ctx.fillStyle="#fff";ctx.font='700 27px "Oswald",Impact,sans-serif';ctx.fillText(v[1],x+105,1050);});
      ctx.fillStyle="#e8d8bf";ctx.font='600 30px "Montserrat",Arial,sans-serif';ctx.fillText("Birlikte, daha güçlü.",540,1185);
      ctx.fillStyle="rgba(255,255,255,.65)";ctx.font='700 19px "Oswald",Impact,sans-serif';ctx.fillText("ACISU UNITED  ·  #ACISUUNITED",540,1260);
      return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Görsel hazırlanamadı.")),"image/png"));
    };
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
        <img src="${esc(safePic)}" alt="${esc(player.name)}" class="w-28 h-28 rounded-full object-cover mx-auto border-2 border-altin/70 shadow-lg" style="object-position:50% 8%" onerror="this.onerror=null;this.src='image_09a3ea.png'">
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
        <button id="profile-share-player" type="button" class="mt-5 w-full rounded-xl border border-altin/40 py-3 text-altin font-bold">Paylaşım görseli oluştur</button><div id="player-share-actions" hidden class="mt-4 space-y-3"><img id="player-share-image" alt="Oyuncu paylaşım görseli" class="w-full rounded-xl border border-altin/40"><div class="grid grid-cols-2 gap-2"><button id="player-share-native" type="button" class="rounded-xl bg-bordo px-3 py-3 font-bold text-white">Paylaş</button><button id="player-share-download" type="button" class="rounded-xl border border-altin/50 px-3 py-3 font-bold text-altin">İndir</button></div></div>`;
      if(visualUrl){URL.revokeObjectURL(visualUrl);visualUrl=null;}visualBlob=null;
      const share=document.getElementById("profile-share-player");
      share?.addEventListener("click",async()=>{
        const original=share.textContent;share.disabled=true;share.textContent="Görsel hazırlanıyor…";
        try{
          visualBlob=await createPlayerVisual(player);
          visualUrl=URL.createObjectURL(visualBlob);
          const image=document.getElementById("player-share-image");
          image.src=visualUrl;
          document.getElementById("player-share-actions").hidden=false;
          share.textContent="Görseli yenile";
        }catch(error){share.textContent=original;alert("Oyuncu görseli hazırlanamadı. Tekrar dener misin?");}
        finally{share.disabled=false;}
      });
      document.getElementById("player-share-download")?.addEventListener("click",()=>{
        if(!visualBlob)return;const a=document.createElement("a");a.href=visualUrl;a.download="acisu-united-"+(player.name||"oyuncu").toLocaleLowerCase("tr-TR").replace(/[^a-z0-9]+/gi,"-")+".png";a.click();
      });
      document.getElementById("player-share-native")?.addEventListener("click",async()=>{
        if(!visualBlob)return;
        const file=new File([visualBlob],"acisu-united-oyuncu.png",{type:"image/png"});
        if(navigator.share&&navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:player.name+" · Acısu United"});}catch(error){if(error.name!=="AbortError")alert("Paylaşım açılamadı; görseli indirip paylaşabilirsin.");}}
        else alert("Bu tarayıcı doğrudan görsel paylaşımını desteklemiyor. Görseli indirip paylaşabilirsin.");
      });
      modal.hidden=false; document.body.classList.add("overflow-hidden");
    };
    box.addEventListener("click",event=>{const card=event.target.closest("[data-player-id]");if(card)show(card.dataset.playerId);});
    document.getElementById("lineup-content")?.addEventListener("click",event=>{const card=event.target.closest("[data-player-id]");if(card)show(card.dataset.playerId);});
    box.addEventListener("keydown",event=>{if((event.key==="Enter"||event.key===" ")&&event.target.matches("[data-player-id]")){event.preventDefault();show(event.target.dataset.playerId);}});
  }

  function wireCoachProfiles(staff, matches) {
    window.acisuPublicStaff=staff;
    window.acisuPublicMatches=matches;
    const modal=document.getElementById("player-profile-modal");
    const content=document.getElementById("player-profile-content");
    if(!modal||!content||modal.dataset.coachProfileWired)return;
    modal.dataset.coachProfileWired="1";
    const open=coachId=>{
      const coach=(window.acisuPublicStaff||[]).find(x=>x.id===coachId);
      if(!coach)return;
      const history=(window.acisuPublicMatches||[]).filter(m=>m.head_coach_id===coachId&&m.played&&!m.is_live)
        .sort((a,b)=>new Date(b.match_at)-new Date(a.match_at));
      const wins=history.filter(m=>Number(m.our_score)>Number(m.their_score)).length;
      const draws=history.filter(m=>Number(m.our_score)===Number(m.their_score)).length;
      const losses=history.length-wins-draws;
      const scored=history.reduce((n,m)=>n+Number(m.our_score||0),0);
      const conceded=history.reduce((n,m)=>n+Number(m.their_score||0),0);
      const points=wins*3+draws,rate=history.length?Math.round(wins*100/history.length):0;
      const recent=history.slice(0,5).map(m=>{
        const own=Number(m.our_score||0),rival=Number(m.their_score||0);
        const result=own>rival?"Galibiyet":own<rival?"Mağlubiyet":"Beraberlik";
        const color=own>rival?"text-green-300":own<rival?"text-red-300":"text-altin";
        return `<li class="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3">
          <span class="min-w-0"><strong class="block truncate text-sm text-white">${esc(m.opponent)}</strong><small class="text-xs text-gray-400">${esc(dateText(m.match_at,m.time_confirmed))}</small></span>
          <span class="shrink-0 text-right"><strong class="block font-baslik text-xl text-altin">${own}–${rival}</strong><small class="text-xs ${color}">${result}</small></span>
        </li>`;
      }).join("");
      content.innerHTML=`<div class="pt-3 text-center">
        <img src="${esc(safeImage(coach.image_url))}" alt="${esc(coach.name)}" class="mx-auto h-28 w-28 rounded-full border-2 border-altin/70 object-cover shadow-lg" onerror="this.onerror=null;this.src='image_09a3ea.png'">
        <p class="mt-3 font-baslik text-lg text-altin">${esc(coach.role)}</p>
        <h2 id="profile-name" class="mt-1 font-baslik text-3xl uppercase text-white">${esc(coach.name)}</h2>
        <p class="mt-2 text-xs text-gray-400">ACISU UNITED · TEKNİK HEYET</p>
       </div>
       <div class="mt-6 grid grid-cols-2 gap-3">
        <div class="rounded-xl border border-white/10 bg-white/5 p-4 text-center"><p class="text-xs font-bold text-gray-400">OYNANAN MAÇ</p><strong class="mt-1 block font-baslik text-3xl text-altin">${history.length}</strong></div>
        <div class="rounded-xl border border-white/10 bg-white/5 p-4 text-center"><p class="text-xs font-bold text-gray-400">GALİBİYET</p><strong class="mt-1 block font-baslik text-3xl text-green-300">${wins}</strong></div>
        <div class="rounded-xl border border-white/10 bg-white/5 p-4 text-center"><p class="text-xs font-bold text-gray-400">BERABERLİK</p><strong class="mt-1 block font-baslik text-3xl text-altin">${draws}</strong></div>
        <div class="rounded-xl border border-white/10 bg-white/5 p-4 text-center"><p class="text-xs font-bold text-gray-400">MAĞLUBİYET</p><strong class="mt-1 block font-baslik text-3xl text-red-300">${losses}</strong></div>
        <div class="rounded-xl border border-white/10 bg-white/5 p-4 text-center"><p class="text-xs font-bold text-gray-400">ATILAN GOL</p><strong class="mt-1 block font-baslik text-3xl text-altin">${scored}</strong></div>
        <div class="rounded-xl border border-white/10 bg-white/5 p-4 text-center"><p class="text-xs font-bold text-gray-400">YENİLEN GOL</p><strong class="mt-1 block font-baslik text-3xl text-altin">${conceded}</strong></div>
        <div class="rounded-xl border border-white/10 bg-white/5 p-4 text-center"><p class="text-xs font-bold text-gray-400">TAKIM PUANI</p><strong class="mt-1 block font-baslik text-3xl text-altin">${points}</strong></div>
        <div class="rounded-xl border border-white/10 bg-white/5 p-4 text-center"><p class="text-xs font-bold text-gray-400">GALİBİYET ORANI</p><strong class="mt-1 block font-baslik text-3xl text-altin">% ${rate}</strong></div>
       </div>
       <section class="mt-6"><h3 class="mb-3 font-baslik text-lg text-white">Son maçlar</h3><ul class="space-y-2">${recent||'<li class="rounded-xl bg-white/5 p-4 text-sm text-gray-400">Teknik direktör olarak seçildiği oynanmış maç bulunmuyor.</li>'}</ul></section>`;
      modal.hidden=false;document.body.classList.add("overflow-hidden");
    };
    document.addEventListener("click",event=>{
      const card=event.target.closest("[data-coach-id]");
      if(card)open(card.dataset.coachId);
    });
    document.addEventListener("keydown",event=>{
      if(event.key!=="Enter"&&event.key!==" ")return;
      const card=event.target.closest("[data-coach-id]");
      if(card&&card.getAttribute("role")==="button"){event.preventDefault();open(card.dataset.coachId);}
    });
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
    const matches = matchesResult.data || [];
    const coachRecord = coachId => {
      const history=matches.filter(m=>m.head_coach_id===coachId&&m.played&&!m.is_live)
        .sort((a,b)=>new Date(b.match_at)-new Date(a.match_at));
      const wins=history.filter(m=>Number(m.our_score)>Number(m.their_score)).length;
      const draws=history.filter(m=>Number(m.our_score)===Number(m.their_score)).length;
      const losses=history.length-wins-draws;
      return {
        played:history.length,wins,draws,losses,
        scored:history.reduce((n,m)=>n+Number(m.our_score||0),0),
        conceded:history.reduce((n,m)=>n+Number(m.their_score||0),0),
        points:wins*3+draws,
        winRate:history.length?Math.round(wins*100/history.length):0,
        recent:history.slice(0,5)
      };
    };
    window.technicalStaff = (staffResult.data || []).map(p => ({
      id:p.id,name:esc(p.name),pos:esc(p.role),img:esc(safeImage(p.image_url)),
      ...coachRecord(p.id)
    }));
    window.renderCoach();
    const profileStats = statsResult.data || [];
    renderPublicSponsors(sponsorsResult.data || []);
    wirePlayerProfiles(players, matches, profileStats);
    wireCoachProfiles(staffResult.data || [], matches);
    const namesById = new Map((goalPlayersResult.data || []).map(p => [p.id, p.name]));
    const coachById = new Map((staffResult.data || []).map(p => [p.id, p]));
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
      const matchCoach=coachById.get(m.head_coach_id);
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
          <p class="text-gray-400 text-sm mt-3">${esc(m.venue)} · ${esc(dateText(m.match_at, m.time_confirmed))}</p>${matchCoach?`<button type="button" data-coach-id="${esc(matchCoach.id)}" class="mt-2 rounded-full border border-altin/30 bg-white/5 px-3 py-1 text-xs text-altin hover:bg-white/10">🧢 Teknik direktör: ${esc(matchCoach.name)}</button>`:""}
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
      .select("match_id, player_id, role, slot_index, player:acisu_players(name, number, position)");
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
    const lineup = allLineup.filter(x => x.match_id === next.id && x.player);
    const orderBySlot=(a,b)=>Number(a.slot_index||99)-Number(b.slot_index||99)||Number(a.player.number)-Number(b.player.number);
    const firstEleven=lineup.filter(x=>x.role==="ilk11").sort(orderBySlot);
    const substitutes=lineup.filter(x=>x.role==="yedek").sort(orderBySlot).slice(0,4);
    const formation=next.lineup_formation||"2-3-1";
    const formations={
      "2-3-1":[{role:"K",x:50,y:88},{role:"DF",x:34,y:69},{role:"DF",x:66,y:69},{role:"OS",x:20,y:48},{role:"OS",x:50,y:52},{role:"OS",x:80,y:48},{role:"FV",x:50,y:29}],
      "3-2-1":[{role:"K",x:50,y:88},{role:"DF",x:20,y:69},{role:"DF",x:50,y:72},{role:"DF",x:80,y:69},{role:"OS",x:35,y:49},{role:"OS",x:65,y:49},{role:"FV",x:50,y:29}],
      "2-2-2":[{role:"K",x:50,y:88},{role:"DF",x:34,y:69},{role:"DF",x:66,y:69},{role:"OS",x:34,y:49},{role:"OS",x:66,y:49},{role:"FV",x:34,y:29},{role:"FV",x:66,y:29}]
    };
    const slots=(formations[formation]||formations["2-3-1"]).map((slot,index)=>({...slot,index:index+1}));
    const assignedBySlot=new Map(firstEleven.map((entry,index)=>[Number(entry.slot_index)||index+1,entry]));
    const placed=slots.map(slot=>({slot,entry:assignedBySlot.get(slot.index)||firstEleven[slot.index-1]||null}));
    const jersey=number=>`<svg viewBox="0 0 48 48" class="w-10 h-10 drop-shadow-[0_3px_3px_rgba(0,0,0,.8)]" aria-hidden="true"><path d="M14 5 5 9 1 20l8 4 3-5v24h24V19l3 5 8-4-4-11-9-4-5 5h-8z" fill="#e9e1d2" stroke="#541820" stroke-width="2.5" stroke-linejoin="round"/><path d="M19 5q5 7 10 0" fill="none" stroke="#9a3540" stroke-width="3"/><text x="24" y="32" text-anchor="middle" font-size="14" font-weight="900" fill="#5c1a21">${esc(number)}</text></svg>`;
    const playerToken=({slot,entry})=>entry?`<button type="button" data-player-id="${esc(entry.player_id)}" class="absolute z-10 flex w-[82px] -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-xl px-1 py-1 text-white transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-altin" style="left:${slot.x}%;top:${slot.y}%" aria-label="#${esc(entry.player.number)} ${esc(entry.player.name)}, ${slot.role}">
        ${jersey(entry.player.number)}<span class="mt-1 max-w-full truncate rounded-full border border-altin/70 bg-[#171118]/95 px-2 py-1 text-[10px] font-extrabold shadow-lg">${esc(entry.player.name)}</span><span class="mt-0.5 rounded-full bg-bordo/95 px-2 py-0.5 text-[9px] font-black text-[#f4d59d]">${slot.role}</span>
      </button>`:`<div class="absolute z-10 flex w-[82px] -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-xl border border-dashed border-white/45 bg-[#111a2a]/85 px-1 py-1 text-center text-white/80" style="left:${slot.x}%;top:${slot.y}%"><span class="grid h-10 w-10 place-items-center rounded-full border border-white/30 text-xl">+</span><span class="mt-1 max-w-full text-[9px] font-bold">Oyuncu seçiliyor</span><span class="mt-0.5 rounded-full bg-bordo/80 px-2 py-0.5 text-[9px] font-black text-[#f4d59d]">${slot.role}</span></div>`;
    const benchList=substitutes.length?substitutes.map(x=>`<button type="button" data-player-id="${esc(x.player_id)}" class="flex min-h-[88px] flex-col items-center justify-center rounded-xl border border-white/10 bg-[#111a2a] px-2 py-2 text-center hover:border-altin/70">
      ${jersey(x.player.number)}<span class="mt-1 max-w-full truncate text-[11px] font-bold text-white">${esc(x.player.name)}</span><span class="mt-0.5 text-[9px] text-altin">${esc(x.player.position||"Yedek")}</span></button>`).join(""):'<p class="col-span-2 py-5 text-center text-sm text-gray-400">Yedek seçilmedi</p>';
    const matchTime=dateText(next.match_at);
    const lineupCoach=coachById.get(next.head_coach_id);
    const opponentCrest=next.opponent_image_url?`<img src="${esc(next.opponent_image_url)}" alt="${esc(next.opponent)} arması" class="h-12 w-12 rounded-full border border-white/20 bg-white/10 object-contain p-1">`:`<span class="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-white/5 text-sm font-black text-gray-300">${esc(String(next.opponent||"?").slice(0,2).toLocaleUpperCase("tr-TR"))}</span>`;
    lineupBox.className="overflow-hidden rounded-3xl border border-[#574348] bg-[#0d0c11] p-3 shadow-[0_20px_55px_rgba(0,0,0,.45)] sm:p-5";
    lineupBox.innerHTML=`<header class="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-altin/35 bg-gradient-to-r from-[#171217] via-[#26151a] to-[#171217] px-3 py-3 sm:px-5">
      <img src="image_09a3ea.png" alt="Acısu United arması" class="h-12 w-12 rounded-full object-contain drop-shadow-[0_0_12px_rgba(193,165,123,.4)] sm:h-16 sm:w-16">
      <div class="min-w-0 text-center"><p class="font-baslik text-lg font-bold tracking-wide text-altin sm:text-2xl">ACISU UNITED</p><p class="mt-1 truncate text-xs font-bold text-white sm:text-sm">VS · ${esc(next.opponent)}</p><p class="mt-1 text-[10px] text-gray-300 sm:text-xs">${esc(formation)} · ${esc(matchTime)} · ${esc(next.venue||"Maç kadrosu")}</p>${lineupCoach?`<button type="button" data-coach-id="${esc(lineupCoach.id)}" class="mt-1 rounded-full border border-altin/30 bg-white/5 px-3 py-1 text-[10px] text-altin">🧢 ${esc(lineupCoach.name)} · ${esc(lineupCoach.role)}</button>`:""}</div>
      ${opponentCrest}
    </header>
    <div class="flex flex-col gap-4 md:flex-row md:items-stretch">
      <div class="relative mx-auto aspect-[0.61] min-h-[550px] w-full max-w-[390px] overflow-hidden rounded-[24px] border-[3px] border-white/85 bg-[#078b66] shadow-[inset_0_0_28px_rgba(0,0,0,.25)] sm:min-h-[620px]">
        <div class="absolute inset-0 bg-[repeating-linear-gradient(to_bottom,#0a9b71_0%,#0a9b71_8.33%,#078b66_8.33%,#078b66_16.66%)]"></div>
        <div class="absolute inset-x-[26%] top-0 h-[13%] border-x-2 border-b-2 border-white/80"></div><div class="absolute left-1/2 top-0 h-[7%] w-[42%] -translate-x-1/2 border-x-2 border-b-2 border-white/80"></div>
        <div class="absolute left-1/2 top-[12%] h-[11%] w-[32%] -translate-x-1/2 rounded-b-full border-b-2 border-x-2 border-white/80"></div>
        <div class="absolute inset-x-0 top-1/2 border-t-2 border-white/90"></div><div class="absolute left-1/2 top-1/2 h-[15%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/90"></div>
        <div class="absolute inset-x-[26%] bottom-0 h-[13%] border-x-2 border-t-2 border-white/80"></div><div class="absolute left-1/2 bottom-0 h-[7%] w-[42%] -translate-x-1/2 border-x-2 border-t-2 border-white/80"></div>
        <div class="absolute left-1/2 bottom-[12%] h-[11%] w-[32%] -translate-x-1/2 rounded-t-full border-t-2 border-x-2 border-white/80"></div>
        <div class="absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 opacity-[.16]"><img src="image_09a3ea.png" alt="" class="h-36 w-36 object-contain sm:h-48 sm:w-48"></div>
        ${placed.map(playerToken).join("")}
      </div>
      <aside class="w-full rounded-2xl border border-white/10 bg-[#182234] p-3 text-white md:w-32 md:shrink-0">
        <h4 class="mb-3 text-center text-xs font-black uppercase tracking-wider text-gray-300">Yedekler</h4>
        <div class="grid grid-cols-2 gap-2 md:grid-cols-1">${benchList}</div>
      </aside>
    </div>
    <p class="mt-3 text-center text-[10px] text-gray-400">Oyuncu kartına dokunarak profilini görüntüleyebilirsin.</p>`;

  }
  window.acisuReloadSite = load;
  load();
})();
