(function(){
  const api=window.acisuAdmin;if(!api)return;
  const box=document.getElementById("overview-activity");if(!box)return;
  const esc=api.escapeHtml;
  const date=value=>{try{return new Intl.DateTimeFormat("tr-TR",{timeZone:"Europe/Istanbul",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value));}catch(_){return "";}};
  function render(){
    const matches=[...api.getMatches()].sort((a,b)=>new Date(b.match_at)-new Date(a.match_at));
    const live=matches.filter(m=>m.is_live),upcoming=matches.filter(m=>!m.played&&!m.is_live).sort((a,b)=>new Date(a.match_at)-new Date(b.match_at)).slice(0,2);
    const played=matches.filter(m=>m.played).slice(0,3);
    const row=(m,label)=>'<div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 py-3 last:border-0"><div><span class="text-[10px] uppercase tracking-widest text-altin">'+label+'</span><strong class="block text-white">'+esc(m.opponent||"Rakip")+'</strong><span class="muted text-xs">'+esc(date(m.match_at))+(m.venue?" · "+esc(m.venue):"")+'</span></div><strong class="font-baslik text-xl text-altin">'+(m.played||m.is_live?Number(m.our_score||0)+"–"+Number(m.their_score||0):"—")+'</strong></div>';
    box.innerHTML='<div class="flex items-center justify-between gap-3 mb-2"><h3 class="font-baslik text-xl">Son maçlar ve takvim</h3><button type="button" class="outline-action text-sm" id="overview-open-matches">Maçları aç</button></div>'
      +(live.length?'<div class="mb-2">'+live.map(m=>row(m,"🔴 CANLI")).join("")+'</div>':"")
      +(upcoming.length?'<div class="mb-2">'+upcoming.map(m=>row(m,"SIRADAKİ")).join("")+'</div>':"")
      +(played.length?'<div>'+played.map(m=>row(m,"SONUÇ")).join("")+'</div>':"")
      +(!live.length&&!upcoming.length&&!played.length?'<p class="muted text-sm py-3">Henüz maç kaydı yok.</p>':"");
    document.getElementById("overview-open-matches")?.addEventListener("click",()=>api.activateTab("matches"));
  }
  window.addEventListener("acisu:refreshed",render);
})();