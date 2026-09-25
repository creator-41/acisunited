(function () {
  const $ = id => document.getElementById(id);
  const notice = message => { $("notice").textContent = message; };
  if (!window.ACISU_SUPABASE_URL || !window.ACISU_SUPABASE_KEY || !window.supabase) {
    notice("Önce supabase-config.js dosyasına Acısu projesinin URL ve publishable key değerlerini gir.");
    $("login-form").hidden = true;
    return;
  }
  const db = window.supabase.createClient(window.ACISU_SUPABASE_URL, window.ACISU_SUPABASE_KEY);
  let players = [], matches = [];
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
    $("players-list").innerHTML = players.map(x => `<div class="border-t border-white/10 py-2 flex justify-between gap-2">
      <span>#${x.number} ${escapeHtml(x.name)} · ${escapeHtml(x.position)} ${x.active ? "" : "· Gizli"}</span>
      <span class="shrink-0"><button data-edit-player="${x.id}" class="underline text-altin">Düzenle</button>
      <button data-delete-player="${x.id}" class="underline ml-3">Sil</button></span></div>`).join("") || "Henüz oyuncu yok.";
    $("matches-list").innerHTML = matches.map(x => `<div class="border-t border-white/10 py-2 flex justify-between gap-2">
      <span>${escapeHtml(new Date(x.match_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }))} · ${escapeHtml(x.opponent)}
      ${x.played ? `${x.our_score}-${x.their_score}` : "Yaklaşan"} ${x.published ? "" : "· Taslak"}</span>
      <span class="shrink-0"><button data-edit-match="${x.id}" class="underline text-altin">Düzenle</button>
      <button data-delete-match="${x.id}" class="underline ml-3">Sil</button></span></div>`).join("") || "Henüz maç yok.";
    $("lineup-match").replaceChildren(...matches.map(x => {
      const o = document.createElement("option");
      o.value = x.id; o.textContent = `${x.opponent} · ${localInput(x.match_at).replace("T", " ")}`;
      return o;
    }));
    await showLineup();
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
      label.textContent = `#${p.number} ${p.name}`;
      const select = document.createElement("select");
      select.dataset.playerId = p.id;
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
    if (error || !user) { $("login-form").hidden = false; $("dashboard").hidden = true; return; }
    const { data: admin, error: adminError } = await db.from("acisu_admins")
      .select("user_id").eq("user_id", user.id).maybeSingle();
    if (adminError || !admin) {
      await db.auth.signOut();
      $("dashboard").hidden = true; $("login-form").hidden = false;
      notice("Bu hesap yönetici olarak tanımlı değil.");
      return;
    }
    $("login-form").hidden = true; $("dashboard").hidden = false;
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
  $("register").addEventListener("click", async () => {
    const f = $("login-form");
    const email = formValue(f, "email");
    const password = formValue(f, "password");
    if (!email || !password) { notice("E-posta ve şifreni gir."); return; }
    const { error } = await db.auth.signUp({ email, password });
    if (error) { notice(error.message); return; }
    f.reset();
    await db.auth.signOut();
    notice("Hesap başvurusu alındı. E-postana gelen doğrulama bağlantısını aç; admin yetkisi tanımlanınca giriş yapabilirsin.");
  });
  $("logout").addEventListener("click", async () => { await db.auth.signOut(); await boot(); notice("Çıkış yapıldı."); });
  $("player-form").addEventListener("submit", async e => {
    e.preventDefault(); const f = e.currentTarget;
    const image = formValue(f, "image_url");
    if (image && !/^(?:[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp)|https:\/\/[a-zA-Z0-9.-]+\/[^\s"'<>]*)$/i.test(image)) {
      notice("Fotoğraf için depodaki dosya adını veya HTTPS adresi gir."); return;
    }
    const payload = {
      name: formValue(f, "name"), number: Number(formValue(f, "number")),
      position: formValue(f, "position"), image_url: image || null,
      rating: Number(formValue(f, "rating")), pace: Number(formValue(f, "pace")),
      passing: Number(formValue(f, "passing")), defense: Number(formValue(f, "defense")),
      active: f.elements.namedItem("active").checked
    };
    const id = formValue(f, "id");
    const { error } = id ? await db.from("acisu_players").update(payload).eq("id", id)
      : await db.from("acisu_players").insert(payload);
    if (error) { notice(error.message); return; }
    f.reset(); notice("Oyuncu kaydedildi."); await refresh();
  });
  $("match-form").addEventListener("submit", async e => {
    e.preventDefault(); const f = e.currentTarget;
    const played = f.elements.namedItem("played").checked;
    if (played && (!formValue(f, "our_score") || !formValue(f, "their_score"))) {
      notice("Oynanan maçın iki skorunu da gir."); return;
    }
    const payload = {
      opponent: formValue(f, "opponent"), match_at: toIso(formValue(f, "match_at")), time_confirmed: true,
      venue: formValue(f, "venue"), home: formValue(f, "home") === "true",
      played, published: f.elements.namedItem("published").checked,
      our_score: played ? Number(formValue(f, "our_score")) : null,
      their_score: played ? Number(formValue(f, "their_score")) : null,
      goal_scorers: played ? formValue(f, "goal_scorers") : ""
    };
    const id = formValue(f, "id");
    const { error } = id ? await db.from("acisu_matches").update(payload).eq("id", id)
      : await db.from("acisu_matches").insert(payload);
    if (error) { notice(error.message); return; }
    f.reset(); notice("Maç kaydedildi."); await refresh();
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
      f.elements.namedItem("active").checked = p.active;
      f.scrollIntoView({ behavior: "smooth" }); return;
    }
    if (del && confirm("Oyuncu silinsin mi? Maç kadrolarından da kaldırılır.")) {
      const { error } = await db.from("acisu_players").delete().eq("id", del.dataset.deletePlayer);
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
      f.scrollIntoView({ behavior: "smooth" }); return;
    }
    if (del && confirm("Maç ve maç kadrosu silinsin mi?")) {
      const { error } = await db.from("acisu_matches").delete().eq("id", del.dataset.deleteMatch);
      notice(error ? error.message : "Maç silindi."); if (!error) await refresh();
    }
  });
  boot();
})();
