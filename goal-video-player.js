(function () {
  const modal = document.getElementById("acisu-video-modal");
  const frame = document.getElementById("acisu-video-frame");
  const title = document.getElementById("acisu-video-title");
  const external = document.getElementById("acisu-video-external");
  const closeButton = document.getElementById("close-acisu-video");
  if (!modal || !frame || !title || !external || !closeButton) return;
  let previousFocus = null;

  function youtubeId(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:") return "";
      const host = url.hostname.toLowerCase();
      let id = "";
      if (host === "youtu.be" || host === "www.youtu.be") {
        id = url.pathname.split("/")[1] || "";
      } else if (["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(host)) {
        const parts = url.pathname.split("/").filter(Boolean);
        id = parts[0] === "watch" ? url.searchParams.get("v") || ""
          : ["shorts", "embed", "live", "v"].includes(parts[0]) ? parts[1] || "" : "";
      }
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
    } catch { return ""; }
  }

  function close() {
    if (modal.hidden) return;
    frame.src = "about:blank";
    modal.hidden = true;
    document.body.classList.remove("acisu-video-open");
    previousFocus?.focus?.();
    previousFocus = null;
  }

  document.addEventListener("click", event => {
    const link = event.target.closest("a[data-acisu-video]");
    if (!link) return;
    const id = youtubeId(link.href);
    if (!id) return;
    event.preventDefault();
    previousFocus = link;
    title.textContent = link.dataset.acisuVideo || "Gol videosu";
    external.href = link.href;
    frame.title = title.textContent;
    frame.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&playsinline=1";
    modal.hidden = false;
    document.body.classList.add("acisu-video-open");
    closeButton.focus();
  });

  closeButton.addEventListener("click", close);
  modal.addEventListener("click", event => { if (event.target === modal) close(); });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modal.hidden) {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    }
  }, true);
})();
