(function(){
  const api=window.acisuAdmin;if(!api)return;
  const form=document.getElementById("share-form");if(!form)return;
  const kind=form.elements.namedItem("kind"),matchSelect=form.elements.namedItem("match_id"),playerSelect=form.elements.namedItem("player_id");
  const matchField=document.getElementById("share-match-field"),playerField=document.getElementById("share-player-field");
  const preview=document.getElementById("share-preview"),download=document.getElementById("download-share");
  let canvas=null, currentPlayerId=null;
  const esc=api.escapeHtml;
  const dateText=value=>{if(!value)return "";try{return new Intl.DateTimeFormat("tr-TR",{timeZone:"Europe/Istanbul",day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(value));}catch(_){return "";}};
  const refreshOptions=()=>{
    const matches=api.getMatches(),players=api.getPlayers();
    const oldMatch=matchSelect.value,oldPlayer=playerSelect.value;
    matchSelect.innerHTML=matches.map(m=>'<option value="'+esc(m.id)+'">'+esc(m.opponent)+" · "+esc(dateText(m.match_at))+"</option>").join("")||'<option value="">Maç bulunamadı</option>';
    playerSelect.innerHTML=players.filter(p=>p.active).map(p=>'<option value="'+esc(p.id)+'">#'+esc(p.number)+" "+esc(p.name)+"</option>").join("")||'<option value="">Oyuncu bulunamadı</option>';
    if(matches.some(m=>m.id===oldMatch))matchSelect.value=oldMatch;
    if(players.some(p=>p.id===oldPlayer))playerSelect.value=oldPlayer;
  };
  const updateFields=()=>{const isPlayer=kind.value==="player";matchField.classList.toggle("hidden",isPlayer);playerField.classList.toggle("hidden",!isPlayer);};
  kind.addEventListener("change",updateFields);
  window.addEventListener("acisu:admin-refreshed",refreshOptions);
  window.addEventListener("acisu:share-player",event=>{
    currentPlayerId=event.detail?.playerId||null;
    refreshOptions();kind.value="player";updateFields();
    if(currentPlayerId)playerSelect.value=currentPlayerId;
    api.activateTab("share");
  });
  refreshOptions();updateFields();
  const rounded=(ctx,x,y,w,h,r,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();};
  const text=(ctx,value,x,y,size,color,weight="600",align="left",maxWidth)=>{ctx.font=weight+" "+size+"px system-ui, -apple-system, sans-serif";ctx.fillStyle=color;ctx.textAlign=align;if(maxWidth)ctx.fillText(String(value??""),x,y,maxWidth);else ctx.fillText(String(value??""),x,y);};
  const imageLoad=src=>new Promise(resolve=>{const img=new Image();img.crossOrigin="anonymous";img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=src;});
  const drawImageCover=(ctx,img,x,y,w,h)=>{
    if(!img)return;const scale=Math.max(w/img.width,h/img.height),sw=w/scale,sh=h/scale,sx=(img.width-sw)/2,sy=(img.height-sh)/2;
    ctx.save();ctx.beginPath();ctx.arc(x+w/2,y+h/2,Math.min(w,h)/2,0,Math.PI*2);ctx.clip();ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h);ctx.restore();
  };
  async function build(){
    const isPlayer=kind.value==="player";
    const match=api.getMatches().find(m=>m.id===matchSelect.value);
    const player=api.getPlayers().find(p=>p.id===playerSelect.value);
    if(isPlayer&&!player){api.notice("Görsel için önce bir oyuncu seç.");return;}
    if(!isPlayer&&!match){api.notice("Görsel için önce bir maç ekle.");return;}
    preview.textContent="Görsel hazırlanıyor…";download.disabled=true;
    const c=document.createElement("canvas");c.width=1080;c.height=1350;const ctx=c.getContext("2d");
    const crest=await imageLoad("image_09a3ea.png");
    const matchdayImage=!isPlayer&&kind.value!=="result"?await imageLoad("assets/acisu-matchday-v1.jpg"):null;
    const bg=ctx.createLinearGradient(0,0,1080,1350);
    bg.addColorStop(0,"#0c090b");bg.addColorStop(.42,"#38151c");bg.addColorStop(1,"#090809");
    ctx.fillStyle=bg;ctx.fillRect(0,0,1080,1350);
    if(matchdayImage){
      ctx.drawImage(matchdayImage,0,0,1080,1350);
      const tint=ctx.createLinearGradient(0,0,0,1350);
      tint.addColorStop(0,"rgba(7,4,7,.57)");
      tint.addColorStop(.52,"rgba(16,6,10,.44)");
      tint.addColorStop(.82,"rgba(16,5,9,.16)");
      tint.addColorStop(1,"rgba(7,4,7,.52)");
      ctx.fillStyle=tint;ctx.fillRect(0,0,1080,1350);
    }
    const glow=ctx.createRadialGradient(790,470,60,690,550,760);
    glow.addColorStop(0,"rgba(161,55,69,.46)");glow.addColorStop(.52,"rgba(92,24,34,.19)");glow.addColorStop(1,"rgba(20,8,11,0)");
    if(!matchdayImage){ctx.fillStyle=glow;ctx.fillRect(0,0,1080,1350);}
    ctx.save();
    ctx.strokeStyle="rgba(209,175,125,.055)";ctx.lineWidth=48;
    if(!matchdayImage)for(let i=-2;i<7;i++){ctx.beginPath();ctx.moveTo(-260,i*280+100);ctx.lineTo(1340,i*280-470);ctx.stroke();}
    ctx.restore();
    rounded(ctx,48,48,984,1254,34,matchdayImage?"rgba(8,6,8,.08)":"rgba(8,6,8,.44)");
    ctx.save();ctx.beginPath();ctx.roundRect(57,57,966,1236,26);ctx.clip();
    ctx.strokeStyle="rgba(209,175,125,.10)";ctx.lineWidth=2;
    if(!matchdayImage)for(let y=170;y<1300;y+=112){ctx.beginPath();ctx.moveTo(57,y);ctx.lineTo(1023,y);ctx.stroke();}
    const ring=ctx.createRadialGradient(780,640,200,780,640,540);
    ring.addColorStop(0,"rgba(198,152,95,0)");ring.addColorStop(.78,"rgba(198,152,95,.025)");ring.addColorStop(1,"rgba(198,152,95,.10)");
    ctx.fillStyle=ring;ctx.fillRect(57,57,966,1236);
    if(crest){
      ctx.save();
      ctx.globalAlpha=isPlayer ? .13 : matchdayImage ? .10 : .25;
      ctx.translate(isPlayer?780:795,isPlayer?555:625);
      ctx.rotate(-.13);
      ctx.drawImage(crest,-410,-410,820,820);
      ctx.restore();
    }
    const shade=ctx.createLinearGradient(0,300,0,1190);
    shade.addColorStop(0,"rgba(10,7,8,.10)");
    shade.addColorStop(.42,"rgba(10,7,8,.31)");
    shade.addColorStop(.78,"rgba(10,7,8,.30)");
    shade.addColorStop(1,"rgba(10,7,8,.08)");
    if(!matchdayImage){ctx.fillStyle=shade;ctx.fillRect(57,300,966,890);}
    ctx.restore();
    ctx.strokeStyle="#b99a69";ctx.lineWidth=3;ctx.strokeRect(52,52,976,1246);
    ctx.strokeStyle="#e0bc81";ctx.lineWidth=6;
    for(const [x,y,dx,dy] of [[52,52,1,1],[1028,52,-1,1],[52,1298,1,-1],[1028,1298,-1,-1]]){
      ctx.beginPath();ctx.moveTo(x+dx*58,y);ctx.lineTo(x,y);ctx.lineTo(x,y+dy*58);ctx.stroke();
    }
    if(crest)ctx.drawImage(crest,84,80,94,94);
    text(ctx,"ACISU",208,135,44,"#f6f1e8","900");text(ctx,"UNITED",370,135,44,"#c7a878","900");
    ctx.fillStyle="#c7a878";ctx.fillRect(86,205,908,2);
    ctx.fillStyle="rgba(199,168,120,.65)";
    ctx.beginPath();ctx.moveTo(540,224);ctx.lineTo(547,231);ctx.lineTo(540,238);ctx.lineTo(533,231);ctx.fill();
    const selectedKind=kind.value;
    if(isPlayer){
      text(ctx,"OYUNCU PROFİLİ",540,300,29,"#c7a878","800","center");
      const portrait=await imageLoad(player.image_url||"image_09a3ea.png");
      if(portrait)drawImageCover(ctx,portrait,390,355,300,300);
      else if(crest)ctx.drawImage(crest,390,355,300,300);
      ctx.strokeStyle="#c7a878";ctx.lineWidth=8;ctx.beginPath();ctx.arc(540,505,150,0,Math.PI*2);ctx.stroke();
      text(ctx,"#"+player.number+" · "+player.position,540,725,30,"#d5bb92","700","center");
      text(ctx,player.name,540,805,58,"#fff","900","center");
      const {data:rows=[]}=await api.db.from("acisu_player_stats").select("played,goals,assists,yellow_cards,red_cards").eq("player_id",player.id);
      const sum=k=>rows.reduce((n,r)=>n+Number(r[k]||0),0),games=rows.filter(r=>r.played).length;
      const points=games*2+sum("goals")*5+sum("assists")*2-sum("yellow_cards")-sum("red_cards")*3;
      const vals=[[games,"MAÇ"],[sum("goals"),"GOL"],[sum("assists"),"ASİST"],[points,"PUAN"]];
      vals.forEach((v,i)=>{const x=95+i*225;rounded(ctx,x,930,200,150,18,"rgba(255,255,255,.07)");text(ctx,v[0],x+100,1003,46,"#dfc18e","900","center");text(ctx,v[1],x+100,1055,22,"#fff","700","center");});
      text(ctx,"Birlikte, daha güçlü.",540,1190,29,"#d3c4ac","600","center");
    }else{
      const isResult=selectedKind==="result";
      const title=isResult?"MAÇ SONUCU":"MAÇ GÜNÜ";
      ctx.fillStyle="rgba(213,179,123,.66)";ctx.fillRect(170,304,176,2);ctx.fillRect(734,304,176,2);
      ctx.save();ctx.shadowColor="rgba(210,157,98,.42)";ctx.shadowBlur=24;
      text(ctx,title,540,320,40,"#d3b47f","900","center");ctx.restore();
      text(ctx,isResult?String(match.our_score??0)+"  —  "+String(match.their_score??0):"ACISU UNITED",540,isResult?530:520,isResult?92:62,"#fff","900","center");
      text(ctx,isResult?String(match.opponent||"Rakip takım"): "VS  "+String(match.opponent||"Rakip takım").toLocaleUpperCase("tr-TR"),540,isResult?630:640,38,"#dfc18e","800","center",850);
      if(!isResult)text(ctx,dateText(match.match_at),540,750,31,"#fff","600","center",840);
      else text(ctx,dateText(match.match_at),540,735,28,"#c7bba8","600","center");
      if(match.venue)text(ctx,match.venue,540,810,27,"#fff","500","center",840);
      const ribbon=ctx.createLinearGradient(180,920,900,1095);
      ribbon.addColorStop(0,"rgba(110,35,47,.76)");ribbon.addColorStop(1,"rgba(34,17,22,.84)");
      rounded(ctx,180,920,720,175,22,ribbon);
      ctx.fillStyle="rgba(220,180,117,.82)";ctx.fillRect(222,944,636,3);
      text(ctx,isResult?(Number(match.our_score)>Number(match.their_score)?"GALİBİYET":Number(match.our_score)<Number(match.their_score)?"MÜCADELE DEVAM EDİYOR":"BERABERLİK"):"BİRLİKTE MÜCADELE",540,1020,36,"#e1c190","900","center");
      text(ctx,"#AcısuUnited  ·  #BirlikteDahaGüçlü",540,1185,27,"#ddd","600","center");
    }
    text(ctx,"ACISU UNITED",540,1260,18,"rgba(255,255,255,.58)","700","center");
    canvas=c;download.disabled=false;preview.innerHTML="";const img=document.createElement("img");img.alt="Acısu United paylaşım görseli önizlemesi";img.className="block w-full max-w-[540px] h-auto mx-auto rounded-lg";img.src=c.toDataURL("image/png");preview.append(img);
  }
  form.addEventListener("submit",event=>{event.preventDefault();build().catch(err=>{preview.textContent="Görsel oluşturulamadı.";api.notice("Görsel hazırlanamadı: "+err.message);});});
  download.addEventListener("click",()=>{if(!canvas)return;canvas.toBlob(blob=>{if(!blob){api.notice("Görsel kaydedilemedi.");return;}const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="acisu-united-"+kind.value+"-"+new Date().toISOString().slice(0,10)+".png";a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);},"image/png");});
})();