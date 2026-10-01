(function () {
  const api=window.acisuAdmin;
  const root=document.getElementById("visitor-panel");
  if(!api || !root) return;
  const {db}=api;
  const $=id=>document.getElementById(id);
  const escape=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const labels={home:"Ana sayfa",squad:"Takım",fixtures:"Fikstür",lineup:"Maç kadrosu",stats:"İstatistik",news:"Haberler",archive:"Arşiv"};
  const localDate=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"});
  const localStamp=iso=>new Intl.DateTimeFormat("tr-TR",{timeZone:"Europe/Istanbul",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(iso));
  function dateKey(value){return localDate.format(new Date(value));}
  function startAt(days) {
    const [y,m,d]=dateKey(Date.now()).split("-").map(Number);
    return new Date(Date.UTC(y,m-1,d-days+1,-3)).toISOString();
  }
  let range=7,loaded=false,busy=false;
  async function load() {
    if(busy || $("dashboard").hidden || $("tab-visitors").hidden) return;
    busy=true;root.textContent="Ziyaretler yükleniyor…";
    try {
      const since=startAt(range), rows=[];
      for(let page=0;page<10;page++) {
        const {data,error}=await db.from("acisu_visits")
          .select("created_at,visitor_id,session_id,section,app_mode,device_label,source_label")
          .gte("created_at",since).order("created_at",{ascending:false})
          .range(page*1000,page*1000+999);
        if(error) throw error;
        rows.push(...(data||[]));
        if(!data || data.length<1000) break;
      }
      const people=new Set(rows.map(x=>x.visitor_id)).size;
      const sessions=new Set(rows.map(x=>x.session_id)).size;
      const grouped=new Map();
      for(const row of rows){
        const key=range===1 ? localStamp(row.created_at).split(" ")[1].slice(0,2)+":00" : dateKey(row.created_at);
        const group=grouped.get(key)||{visitors:new Set(),views:0};
        group.views++;group.visitors.add(row.visitor_id);grouped.set(key,group);
      }
      const deviceGroups=new Map();
      for (const row of rows) {
        const label=row.device_label||"Bilinmiyor";
        if (!deviceGroups.has(label)) deviceGroups.set(label,new Set());
        deviceGroups.get(label).add(row.visitor_id);
      }
      const devices=[...deviceGroups].sort((a,b)=>b[1].size-a[1].size);
      const sourceGroups=new Map(), sectionGroups=new Map();
      for (const row of rows) {
        const source=row.source_label||"Eski kayıt";
        if (!sourceGroups.has(source)) sourceGroups.set(source,new Set());
        sourceGroups.get(source).add(row.session_id);
        const section=labels[row.section]||row.section;
        const group=sectionGroups.get(section)||{sessions:new Set(),views:0};
        group.sessions.add(row.session_id);group.views++;sectionGroups.set(section,group);
      }
      const sources=[...sourceGroups].sort((a,b)=>b[1].size-a[1].size);
      const popularSections=[...sectionGroups].sort((a,b)=>b[1].sessions.size-a[1].sessions.size||b[1].views-a[1].views);
      const sorted=[...grouped].sort((a,b)=>a[0].localeCompare(b[0]));
      const max=Math.max(1,...sorted.map(([,g])=>g.views));
      root.innerHTML=`
        <div class="grid grid-cols-3 gap-2 text-center mb-6">
          <div class="surface p-3"><strong class="block text-altin text-2xl">${people}</strong><span class="muted text-xs">Tekil cihaz</span></div>
          <div class="surface p-3"><strong class="block text-altin text-2xl">${sessions}</strong><span class="muted text-xs">Oturum</span></div>
          <div class="surface p-3"><strong class="block text-altin text-2xl">${rows.length}${rows.length===10000?"+":""}</strong><span class="muted text-xs">Sayfa açılışı</span></div>
        </div>
        <div class="surface p-4 mb-5"><h3 class="font-baslik text-xl mb-3">${range===1?"Saatlik":"Günlük"} trafik</h3>
          ${sorted.length ? sorted.map(([key,g])=>`<div class="grid grid-cols-[80px_1fr_50px] items-center gap-2 text-xs mb-2"><span>${escape(key)}</span><div class="h-5 bg-[#322329] rounded-full overflow-hidden"><div class="h-full bg-[#c1a57b]" style="width:${g.views/max*100}%"></div></div><span class="text-right">${g.visitors.size} / ${g.views}</span></div>`).join("") : '<p class="muted">Bu dönemde henüz ziyaret kaydı yok.</p>'}
          <p class="muted text-xs mt-3">Çubuklar sayfa açılışını gösterir. Sağda tekil cihaz / sayfa açılışı yazıyor.</p>
        </div>
        <div class="grid lg:grid-cols-2 gap-4 mb-5">
          <div class="surface p-4"><h3 class="font-baslik text-xl mb-3">Nereden geldiler?</h3>
            ${sources.length?sources.map(([label,ids])=>`<div class="flex justify-between gap-3 border-t border-white/10 py-2 text-sm"><span>${escape(label)}</span><strong class="text-altin">${ids.size} oturum</strong></div>`).join(""):'<p class="muted">Bu dönemde kaynak kaydı yok.</p>'}
            <p class="muted text-xs mt-2">Kaynak, tarayıcının ilettiği site adına göre tahmin edilir. Gizlilik ayarları kaynağı saklayabilir.</p>
          </div>
          <div class="surface p-4"><h3 class="font-baslik text-xl mb-3">En çok açılan bölümler</h3>
            ${popularSections.length?popularSections.map(([label,g])=>`<div class="flex justify-between gap-3 border-t border-white/10 py-2 text-sm"><span>${escape(label)}</span><strong class="text-altin">${g.sessions.size} oturum · ${g.views} açılış</strong></div>`).join(""):'<p class="muted">Bu dönemde sayfa kaydı yok.</p>'}
          </div>
        </div>
        <div class="surface p-4 mb-5"><h3 class="font-baslik text-xl mb-3">Cihaz türleri</h3>
          ${devices.length ? devices.map(([label,ids])=>`<div class="flex justify-between gap-3 border-t border-white/10 py-2 text-sm"><span>${escape(label)}</span><strong class="text-altin">${ids.size} cihaz</strong></div>`).join("") : '<p class="muted">Henüz cihaz verisi yok.</p>'}
          <p class="muted text-xs mt-2">Cihaz bilgisi tarayıcının verdiği kategoriye göre gösterilir; kesin model bilgisi değildir.</p>
        </div>
        <div class="surface p-4"><h3 class="font-baslik text-xl mb-3">Son girişler</h3>
          ${rows.slice(0,50).map(row=>`<div class="border-t border-white/10 py-2 flex justify-between gap-3 text-xs"><span>${escape(localStamp(row.created_at))} · ${escape(labels[row.section]||row.section)} · ${escape(row.device_label||"Bilinmiyor")}${row.app_mode?" · Uygulama":""}</span><span class="text-altin whitespace-nowrap">Cihaz ${escape(row.visitor_id.slice(0,8))}</span></div>`).join("") || '<p class="muted">Kayıt yok.</p>'}
        </div>
        ${rows.length===10000?'<p class="text-amber-300 text-xs mt-3">Çok yoğun trafik: ilk 10.000 kayıt gösteriliyor.</p>':""}`;
      loaded=true;
    } catch(error) {root.textContent="Trafik verileri yüklenemedi: "+error.message;}
    finally {busy=false;}
  }
  document.querySelectorAll("[data-visitor-range]").forEach(button=>button.addEventListener("click",()=>{
    range=Number(button.dataset.visitorRange);
    document.querySelectorAll("[data-visitor-range]").forEach(x=>x.setAttribute("aria-pressed",String(x===button)));
    load();
  }));
  $("tab-button-visitors").addEventListener("click",()=>{setTimeout(load,0);});
  window.addEventListener("acisu:refreshed",()=>{if(!loaded)load();});
})();