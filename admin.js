(function () {
  const $ = id => document.getElementById(id);
  let noticeTimer;
  const notice = message => {
    $("notice").textContent = message;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { $("notice").textContent = ""; }, 7000);
  };
  if (!window.ACISU_SUPABASE_URL || !window.ACISU_SUPABASE_KEY || !window.supabase) {
    notice("Önce supabase-config.js dosyasına Acısu projesinin URL ve publishable key değerlerini gir.");
    $("login-form").hidden = true;
    return;
  }
  const db = window.supabase.createClient(window.ACISU_SUPABASE_URL, window.ACISU_SUPABASE_KEY);
  const photoBucket = "acisu-player-photos";
  const photoTypes = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const photoPrefix = `${window.ACISU_SUPABASE_URL}/storage/v1/object/public/${photoBucket}/`;
  const storedPhotoPath = url => url.startsWith(photoPrefix) ? url.slice(photoPrefix.length) : null;
  let previewUrl;
  function showPhoto(src) {
    const preview = $("photo-preview");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    preview.hidden = !src;
    if (src) preview.src = src;
    else preview.removeAttribute("src");
  }
  $("player-form").addEventListener("reset", () => setTimeout(() => showPhoto(""), 0));
  $("player-form").elements.namedItem("photo").addEventListener("change", e => {
    const file = e.target.files?.[0];
    if (file) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(file);
      $("photo-preview").src = previewUrl;
      $("photo-preview").hidden = false;
    } else showPhoto($("player-form").elements.namedItem("image_url").value);
  });
  let players = [], matches = [];
  const tabs = [...document.querySelectorAll("#admin-tabs [role=tab]")];
  function activateTab(name, focus = false) {
    for (const tab of tabs) {
      const active = tab.dataset.tab === name;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      $(tab.getAttribute("aria-controls")).hidden = !active;
      if (active && focus) tab.focus();
    }
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
    tab.addEventListener("keydown", e => {
      if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
      e.preventDefault();
      const target = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1
        : (index + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      activateTab(tabs[target].dataset.tab, true);
    });
  });
  function editor(kind, open, editing = false) {
    $(kind + "-editor").hidden = !open;
    $(kind + "-form-title").textContent = editing
      ? (kind === "player" ? "Oyuncuyu düzenle" : "Maçı düzenle")
      : (kind === "player" ? "Yeni oyuncu" : "Yeni maç");
    if (open) $(kind + "-editor").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  document.querySelectorAll("[data-open-form]").forEach(button => button.addEventListener("click", () => {
    const kind = button.dataset.openForm;
    $(kind + "-form").reset();
    editor(kind, true);
  }));
  document.querySelectorAll("[data-close-form]").forEach(button => button.addEventListener("click", () => {
    const kind = button.dataset.closeForm;
    $(kind + "-form").reset();
    editor(kind, false);
  }));
  const formValue = (form, key) => form.elements.namedItem(key).value.trim();
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const localInput = iso => {
    const d = new Date(iso);
    const parts = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit",
      day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).format(d);
    return parts.replace(" ", "T");
  };
  const toIso = local => new Date(local + ":00+03:00").toISOString();

  async function refresh() {
    const [p, m] = await Promise.all([
      db.from("acisu_players").select("*").order("number"),
      db.from("acisu_matches").select("*").order("match_at", { ascending: false })
    ]);
    if (p.error || m.error) throw p.error || m.error;
    players = p.data || []; matches = m.data || [];
    $("player-count").textContent = players.length;
    $("match-count").textContent = matches.length;
    $("stat-players").textContent = players.filter(x => x.active).length;
    $("stat-matches").textContent = matches.length;
    $("stat-played").textContent = matches.filter(x => x.played).length;
    $("stat-live").textContent = matches.filter(x => x.is_live).length;
    $("players-list").innerHTML = players.map(x => `<div class="list-row">
      <span><strong class="text-white">#${x.number} ${escapeHtml(x.name)}</strong><span class="block muted text-xs mt-1">${escapeHtml(x.position)} ${x.active ? "" : "· Gizli"}</span></span>
      <span class="list-actions"><button data-edit-player="${x.id}" type="button">Düzenle</button>
      <button data-delete-player="${x.id}" type="button">Sil</button></span></div>`).join("") || '<p class="muted py-5">Henüz oyuncu yok. Oyuncu ekle düğmesiyle başla.</p>';
    $("matches-list").innerHTML = matches.map(x => `<div class="list-row">
      <span><strong class="text-white">${escapeHtml(x.opponent)}</strong><span class="block muted text-xs mt-1">${escapeHtml(new Date(x.match_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }))} · ${x.is_live ? `🔴 CANLI ${x.our_score}-${x.their_score}` : x.played ? `${x.our_score}-${x.their_score}` : "Yaklaşan"} ${x.published ? "" : "· Taslak"}</span></span>
      <span class="list-actions"><button data-edit-match="${x.id}" type="button">Düzenle</button>
      <button data-delete-match="${x.id}" type="button">Sil</button></span></div>`).join("") || '<p class="muted py-5">Henüz maç yok. Maç ekle düğmesiyle başla.</p>';
    const selectedMatch = $("lineup-match").value;
    $("lineup-match").replaceChildren(...matches.map(x => {
      const o = document.createElement("option");
      o.value = x.id; o.textContent = `${x.opponent} · ${localInput(x.match_at).replace("T", " ")}`;
      return o;
    }));
    if (matches.some(x => x.id === selectedMatch)) $("lineup-match").value = selectedMatch;
    await showLineup();
    window.dispatchEvent(new Event("acisu:refreshed"));
  }
  async function showLineup() {
    const matchId = $("lineup-match").value;
    if (!matchId) { $("lineup-players").textContent = "Önce maç ekle."; return; }
    const { data, error } = await db.from("acisu_match_lineup").select("player_id,role").eq("match_id", matchId);
    if (error) { notice(error.message); return; }
    const roles = new Map((data || []).map(x => [x.player_id, x.role]));
    const box = $("lineup-players");
    box.replaceChildren(...players.filter(p => p.active).map(p => {
      const label = document.createElement("label");
      label.className = "lineup-item text-sm font-semibold";
      label.textContent = `#${p.number} ${p.name}`;
      const select = document.createElement("select");
      select.dataset.playerId = p.id;
      select.className = "mt-2 w-full bg-[#120e10] border border-[#644b52] text-white rounded-lg px-3 py-2";
      [["", "Kadro dışı"], ["ilk11", "İlk kadro"], ["yedek", "Yedek"]].forEach(([value, text]) => {
        const o = document.createElement("option"); o.value = value; o.textContent = text;
        select.appendChild(o);
      });
      select.value = roles.get(p.id) || "";
      label.appendChild(select);
      return label;
    }));
  }
  async function boot() {
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user) { $("login-form").hidden = false; $("dashboard").hidden = true; $("logout").hidden = true; return; }
    const { data: admin, error: adminError } = await db.from("acisu_admins")
      .select("user_id").eq("user_id", user.id).maybeSingle();
    if (adminError || !admin) {
      await db.auth.signOut();
      $("dashboard").hidden = true; $("login-form").hidden = false; $("logout").hidden = true;
      notice("Bu hesap yönetici olarak tanımlı değil.");
      return;
    }
    $("login-form").hidden = true; $("dashboard").hidden = false; $("logout").hidden = false;
    try { await refresh(); notice("Yönetim paneli hazır."); }
    catch (e) { notice("Veriler yüklenemedi: " + e.message); }
  }
  $("login-form").addEventListener("submit", async e => {
    e.preventDefault();
    const form = e.currentTarget;
    const { error } = await db.auth.signInWithPassword({
      email: formValue(form, "email"), password: formValue(form, "password")
    });
    if (error) { notice(error.message); return; }
    form.reset(); await boot();
  });
  $("logout").addEventListener("click", async () => { await db.auth.signOut(); await boot(); notice("Çıkış yapıldı."); });
  $("player-form").addEventListener("submit", async e => {
    e.preventDefault(); const f = e.currentTarget;
    const file = f.elements.namedItem("photo").files?.[0];
    if (file && (!photoTypes[file.type] || file.size > 5 * 1024 * 1024 || !file.size)) {
      notice("JPG, PNG veya WebP fotoğraf seç; dosya en fazla 5 MB olmalı."); return;
    }
    const oldImage = formValue(f, "image_url");
    const payload = {
      name: formValue(f, "name"), number: Number(formValue(f, "number")),
      position: formValue(f, "position"), image_url: oldImage || null,
      rating: Number(formValue(f, "rating")), pace: Number(formValue(f, "pace")),
      passing: Number(formValue(f, "passing")), defense: Number(formValue(f, "defense")),
      active: f.elements.namedItem("active").checked
    };
    const id = formValue(f, "id");
    const submit = f.querySelector('[type="submit"]');
    submit.disabled = true; submit.textContent = file ? "Fotoğraf yükleniyor…" : "Kaydediliyor…";
    let uploadedPath, saved = false;
    try {
      if (file) {
        uploadedPath = `${crypto.randomUUID()}.${photoTypes[file.type]}`;
        const { error: uploadError } = await db.storage.from(photoBucket)
          .upload(uploadedPath, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        payload.image_url = db.storage.from(photoBucket).getPublicUrl(uploadedPath).data.publicUrl;
      }
      const { error } = id ? await db.from("acisu_players").update(payload).eq("id", id)
        : await db.from("acisu_players").insert(payload);
      if (error) throw error;
      saved = true;
      if (uploadedPath && storedPhotoPath(oldImage)) {
        const { error: cleanupError } = await db.storage.from(photoBucket).remove([storedPhotoPath(oldImage)]);
        if (cleanupError) console.warn("Eski fotoğraf silinemedi:", cleanupError);
      }
      f.reset(); editor("player", false); notice("Oyuncu ve fotoğrafı kaydedildi."); await refresh();
    } catch (error) {
      if (!saved && uploadedPath) await db.storage.from(photoBucket).remove([uploadedPath]);
      notice((saved ? "Oyuncu kaydedildi, liste yenilenemedi: " : "Oyuncu kaydedilemedi: ") + error.message);
    } finally {
      submit.disabled = false; submit.textContent = "Oyuncuyu kaydet";
    }
  });
  $("match-form").addEventListener("submit", async e => {
    e.preventDefault(); const f = e.currentTarget;
    if (matches.some(x => x.id === formValue(f, "id") && x.is_live)) {
      notice("Canlı maçın skorunu Canlı Maç sekmesinden yönet."); return;
    }
    const played = f.elements.namedItem("played").checked;
    if (played && (!formValue(f, "our_score") || !formValue(f, "their_score"))) {
      notice("Oynanan maçın iki skorunu da gir."); return;
    }
    const payload = {
      opponent: formValue(f, "opponent"), match_at: toIso(formValue(f, "match_at")), time_confirmed: true,
      venue: formValue(f, "venue"), home: formValue(f, "home") === "true",
      played, is_live: false, published: f.elements.namedItem("published").checked,
      our_score: played ? Number(formValue(f, "our_score")) : null,
      their_score: played ? Number(formValue(f, "their_score")) : null,
      goal_scorers: played ? formValue(f, "goal_scorers") : ""
    };
    const id = formValue(f, "id");
    const previous = matches.find(x => x.id === id);
    if (previous?.played && !played) {
      if (!confirm("Bu maçı Oynanmadı yaparsan maçın gol günlüğü, oyuncu istatistikleri ve bu maçtan gelen puanlar sıfırlanacak. Devam edilsin mi?")) return;
      const { data, error } = await db.rpc("acisu_reset_match", { p_match_id: id });
      if (error) { notice("Maç sıfırlanamadı: " + error.message); return; }
      f.reset(); editor("match", false);
      const goals = Number(data?.goal_events_deleted || 0);
      const rows = Number(data?.player_stat_rows_deleted || 0);
      notice(`Maç sıfırlandı. ${goals} gol kaydı ve ${rows} oyuncu istatistiği silindi.`);
      await refresh();
      return;
    }
    const { error } = id ? await db.from("acisu_matches").update(payload).eq("id", id)
      : await db.from("acisu_matches").insert(payload);
    if (error) { notice(error.message); return; }
    f.reset(); editor("match", false); notice("Maç kaydedildi."); await refresh();
  });
  $("lineup-match").addEventListener("change", showLineup);
  $("save-lineup").addEventListener("click", async () => {
    const matchId = $("lineup-match").value;
    if (!matchId) return;
    const selected = [...$("lineup-players").querySelectorAll("select")]
      .filter(x => x.value).map(x => ({ match_id: matchId, player_id: x.dataset.playerId, role: x.value }));
    const { error: delError } = await db.from("acisu_match_lineup").delete().eq("match_id", matchId);
    if (delError) { notice(delError.message); return; }
    if (selected.length) {
      const { error } = await db.from("acisu_match_lineup").insert(selected);
      if (error) { notice("Kadro kaydedilemedi: " + error.message); return; }
    }
    notice("Maç kadrosu kaydedildi.");
  });
  $("players-list").addEventListener("click", async e => {
    const edit = e.target.closest("[data-edit-player]");
    const del = e.target.closest("[data-delete-player]");
    if (edit) {
      const p = players.find(x => x.id === edit.dataset.editPlayer), f = $("player-form");
      for (const field of ["id", "name", "number", "position", "image_url", "rating", "pace", "passing", "defense"])
        f.elements.namedItem(field).value = p[field] ?? "";
      f.elements.namedItem("photo").value = "";
      showPhoto(p.image_url || "");
      f.elements.namedItem("active").checked = p.active;
      editor("player", true, true); return;
    }
    if (del && confirm("Oyuncu silinsin mi? Maç kadrolarından da kaldırılır.")) {
      const oldImage = players.find(x => x.id === del.dataset.deletePlayer)?.image_url || "";
      const { error } = await db.from("acisu_players").delete().eq("id", del.dataset.deletePlayer);
      if (!error && storedPhotoPath(oldImage)) {
        const { error: cleanupError } = await db.storage.from(photoBucket).remove([storedPhotoPath(oldImage)]);
        if (cleanupError) console.warn("Oyuncu fotoğrafı silinemedi:", cleanupError);
      }
      notice(error ? error.message : "Oyuncu silindi."); if (!error) await refresh();
    }
  });
  $("matches-list").addEventListener("click", async e => {
    const edit = e.target.closest("[data-edit-match]");
    const del = e.target.closest("[data-delete-match]");
    if (edit) {
      const m = matches.find(x => x.id === edit.dataset.editMatch), f = $("match-form");
      for (const field of ["id", "opponent", "venue", "our_score", "their_score", "goal_scorers"])
        f.elements.namedItem(field).value = m[field] ?? "";
      f.elements.namedItem("match_at").value = localInput(m.match_at);
      f.elements.namedItem("home").value = String(m.home);
      f.elements.namedItem("played").checked = m.played;
      f.elements.namedItem("published").checked = m.published;
      editor("match", true, true); return;
    }
    if (del && confirm("Maç ve maç kadrosu silinsin mi?")) {
      const { error } = await db.from("acisu_matches").delete().eq("id", del.dataset.deleteMatch);
      notice(error ? error.message : "Maç silindi."); if (!error) await refresh();
    }
  });
  window.acisuAdmin = { db, getPlayers: () => players, getMatches: () => matches,
    refresh, notice, activateTab, escapeHtml };
  activateTab("overview");
  boot();
})();
