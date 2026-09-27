(function(){
  const api=window.acisuAdmin;if(!api)return;
  const form=document.getElementById("sponsor-form"), list=document.getElementById("sponsors-list"), preview=document.getElementById("sponsor-logo-preview");
  const esc=api.escapeHtml, notice=api.notice, db=api.db;
  if(!form||!list)return;
  const field=name=>form.elements.namedItem(name);
  const close=()=>{form.reset();field("id").value="";field("logo_url").value="";preview.src="";preview.classList.add("hidden");form.hidden=true;};
  const open=record=>{
    form.reset();field("id").value=record?.id||"";field("logo_url").value=record?.logo_url||"";
    field("name").value=record?.name||"";field("tier").value=record?.tier||"main";
    field("website_url").value=record?.website_url||"";field("sort_order").value=record?.sort_order??0;
    field("active").value=String(record?.active??true);field("starts_at").value=record?.starts_at||"";
    field("ends_at").value=record?.ends_at||"";preview.src=record?.logo_url||"";
    preview.classList.toggle("hidden",!record?.logo_url);
    document.getElementById("sponsor-form-title").textContent=record?"Sponsoru düzenle":"Sponsor ekle";
    form.hidden=false;form.scrollIntoView({behavior:"smooth",block:"start"});
  };
  const render=()=>{
    const records=api.getSponsors();
    document.getElementById("sponsor-count").textContent=records.length+" kayıt";
    list.innerHTML=records.map(s=>'<div class="list-row"><span class="flex items-center gap-3">'+(s.logo_url?'<img src="'+esc(s.logo_url)+'" alt="" class="w-12 h-12 rounded-lg bg-white/5 object-contain p-1">':'')+'<span><strong class="text-white">'+esc(s.name)+'</strong><span class="block muted text-xs mt-1">'+(s.tier==="main"?"Ana sponsor":"Destekçimiz")+" · "+(s.active?"Yayında":"Taslak")+(s.ends_at?" · "+esc(s.ends_at)+" tarihine kadar":"")+'</span></span></span><span class="list-actions"><button type="button" data-sponsor-edit="'+esc(s.id)+'">Düzenle</button><button type="button" data-sponsor-delete="'+esc(s.id)+'">Sil</button></span></div>').join("")||'<p class="muted py-5">Henüz sponsor eklenmedi.</p>';
  };
  document.getElementById("new-sponsor").addEventListener("click",()=>open(null));
  document.getElementById("cancel-sponsor").addEventListener("click",close);
  field("logo").addEventListener("change",()=>{const file=field("logo").files[0];if(!file){preview.classList.add("hidden");return;}preview.src=URL.createObjectURL(file);preview.classList.remove("hidden");});
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const file=field("logo").files[0], oldUrl=field("logo_url").value;
    if(file&&(!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)||file.size>5*1024*1024)){notice("Logo PNG, JPG, WebP veya SVG olmalı ve en fazla 5 MB olabilir.");return;}
    let logoUrl=oldUrl, objectPath="";
    try{
      if(file){
        const ext=({ "image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/svg+xml":"svg" })[file.type];
        objectPath="sponsors/"+crypto.randomUUID()+"."+ext;
        const {error:uploadError}=await db.storage.from("acisu-sponsor-logos").upload(objectPath,file,{cacheControl:"3600",upsert:false,contentType:file.type});
        if(uploadError)throw uploadError;
        logoUrl=db.storage.from("acisu-sponsor-logos").getPublicUrl(objectPath).data.publicUrl;
      }
      const payload={name:field("name").value.trim(),tier:field("tier").value,website_url:field("website_url").value.trim()||null,logo_url:logoUrl||null,sort_order:Number(field("sort_order").value||0),active:field("active").value==="true",starts_at:field("starts_at").value||null,ends_at:field("ends_at").value||null};
      const id=field("id").value;
      const result=id?await db.from("acisu_sponsors").update(payload).eq("id",id):await db.from("acisu_sponsors").insert(payload);
      if(result.error)throw result.error;
      if(file&&oldUrl){const marker="/acisu-sponsor-logos/";const at=oldUrl.indexOf(marker);if(at>=0)await db.storage.from("acisu-sponsor-logos").remove([oldUrl.slice(at+marker.length).split("?")[0]]);}
      close();await api.refresh();notice("Sponsor kaydedildi.");
    }catch(error){if(objectPath)await db.storage.from("acisu-sponsor-logos").remove([objectPath]);notice("Sponsor kaydedilemedi: "+error.message);}
  });
  list.addEventListener("click",async e=>{
    const edit=e.target.closest("[data-sponsor-edit]"),del=e.target.closest("[data-sponsor-delete]");
    if(edit){open(api.getSponsors().find(s=>s.id===edit.dataset.sponsorEdit));return;}
    if(del&&confirm("Bu sponsoru silmek istiyor musun?")){
      const sponsor=api.getSponsors().find(s=>s.id===del.dataset.sponsorDelete);
      const {error}=await db.from("acisu_sponsors").delete().eq("id",del.dataset.sponsorDelete);
      if(error){notice("Sponsor silinemedi: "+error.message);return;}
      if(sponsor?.logo_url){const marker="/acisu-sponsor-logos/";const at=sponsor.logo_url.indexOf(marker);if(at>=0)await db.storage.from("acisu-sponsor-logos").remove([sponsor.logo_url.slice(at+marker.length).split("?")[0]]);}
      await api.refresh();notice("Sponsor silindi.");
    }
  });
  window.addEventListener("acisu:admin-refreshed",render);
})();