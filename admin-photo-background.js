(function () {
  const scriptUrl = document.currentScript.src;
  let worker, workerMode, pending, activeForm, sequence = 0;
  const LIMIT = 5 * 1024 * 1024;

  function stopWorker() {
    worker?.terminate();
    worker = null; workerMode = null;
  }
  function processPhoto(blob, onStatus, mode) {
    if (pending) return Promise.reject(new Error('Başka bir fotoğraf işleniyor. Tamamlanmasını bekle.'));
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const finish = (error, result) => {
        if (!pending || pending.id !== id) return;
        clearTimeout(pending.timer);
        pending = null;
        if (error) { stopWorker(); reject(error); } else resolve(result);
      };
      pending = { id, finish, onStatus, timer: setTimeout(() => finish(new Error('İşlem çok uzun sürdü. İnternet bağlantını kontrol edip tekrar deneyebilirsin.')), 240000) };
      try {
        if (worker && workerMode !== mode) stopWorker();
        if (!worker) {
          workerMode = mode;
          worker = new Worker(new URL(mode === 'logo' ? 'logo-background-worker.js?v=20260930-1' : 'photo-background-worker.js?v=20260930-1', scriptUrl), { type: 'module' });
          worker.onmessage = ({ data }) => {
            if (!pending || pending.id !== data.id) return;
            if (data.status === 'done') pending.finish(null, data);
            else if (data.status === 'error') pending.finish(new Error(data.message));
            else pending.onStatus(data);
          };
          worker.onerror = () => pending?.finish(new Error('Temizleme aracı yüklenemedi. İnternet bağlantını kontrol edip tekrar dene.'));
        }
        worker.postMessage({ id, blob });
      } catch (error) { finish(error); }
    });
  }
  function cancel() {
    pending?.finish(new Error('İşlem iptal edildi. Orijinal fotoğraf korunuyor.'));
  }
  async function prepare(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || !file.size || file.size > LIMIT) {
      throw new Error('JPG, PNG veya WebP seç; dosya en fazla 5 MB olmalı.');
    }
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Fotoğraf okunamadı.');
      return blob;
    } finally { URL.revokeObjectURL(url); }
  }

  for (const [kind, previewId, fileName, imageName, mode] of [
    ['player', 'photo-preview', 'photo', 'image_url', 'portrait'],
    ['staff', 'staff-photo-preview', 'photo', 'image_url', 'portrait'],
    ['match', 'opponent-photo-preview', 'opponent_photo', 'opponent_image_url', 'logo']
  ]) {
    const form = document.getElementById(kind + '-form');
    const preview = document.getElementById(previewId);
    if (!form || !preview) continue;
    const input = form.elements.namedItem(fileName);
    const oldImage = form.elements.namedItem(imageName);
    const hint = mode === 'logo' ? 'Ücretsiz · Tek renk arka planlı armalar için. Şeffaf PNG olarak hazırlanır.' : 'Ücretsiz · Fotoğraf cihazında işlenir. İlk kullanımda model indirilir; biraz sürebilir.';
    const row = document.createElement('div');
    row.className = 'sm:col-span-2';
    row.innerHTML = `<div class="flex flex-wrap gap-2"><button type="button" class="outline-action" data-bg-clean>✂ Arka planı temizle</button><button type="button" class="outline-action" data-bg-restore hidden>Orijinale dön</button><button type="button" class="outline-action" data-bg-cancel hidden>İptal</button></div><p class="muted text-xs mt-2" role="status" aria-live="polite">${hint}</p>`;
    preview.parentElement.after(row);
    const clean = row.querySelector('[data-bg-clean]');
    const restore = row.querySelector('[data-bg-restore]');
    const cancelButton = row.querySelector('[data-bg-cancel]');
    const status = row.querySelector('[role="status"]');
    const state = { busy: false, result: null, original: null, previewUrl: null, version: 0, controller: null };
    const key = () => `${form.elements.namedItem('id').value}|${oldImage.value}`;
    const update = () => {
      clean.disabled = state.busy || (!input.files?.[0] && !oldImage.value);
      clean.textContent = state.busy ? 'Temizleniyor…' : '✂ Arka planı temizle';
      restore.hidden = !state.result;
      cancelButton.hidden = !state.busy;
      input.disabled = state.busy;
    };
    const reset = () => {
      state.version++;
      if (state.busy) { state.controller?.abort(); if (activeForm === form) cancel(); }
      state.result = null; state.original = null;
      if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
      state.previewUrl = null;
      status.textContent = hint;
      update();
    };
    input.addEventListener('change', reset);
    form.addEventListener('reset', () => { reset(); setTimeout(update, 0); });
    new MutationObserver(() => {
      if (!state.busy && state.previewUrl && preview.src !== state.previewUrl) reset();
      update();
    }).observe(preview, { attributes: true, attributeFilter: ['src', 'hidden'] });
    // Saving while a removal is in progress would otherwise upload the original.
    form.addEventListener('submit', event => {
      if (state.busy) {
        event.preventDefault(); event.stopImmediatePropagation();
        status.textContent = 'Fotoğraf temizleniyor. Bitmesini bekle veya iptal et.';
      }
    }, true);
    cancelButton.addEventListener('click', () => {
      state.version++;
      state.controller?.abort();
      if (activeForm === form) cancel();
      status.textContent = 'İşlem iptal edildi. Orijinal fotoğraf korunuyor.';
    });
    restore.addEventListener('click', () => {
      if (!state.original || state.busy) return;
      const transfer = new DataTransfer();
      if (state.original.file) transfer.items.add(state.original.file);
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    clean.addEventListener('click', async () => {
      if (state.busy || activeForm) { status.textContent = 'Devam eden temizleme işleminin bitmesini bekle.'; return; }
      const selectedFile = input.files?.[0] || null;
      const sourceUrl = oldImage.value;
      if (!selectedFile && !sourceUrl) return;
      const initialKey = key(), version = ++state.version;
      const original = state.original || { file: selectedFile, url: sourceUrl };
      activeForm = form;
      state.controller = new AbortController();
      state.busy = true; update();
      status.textContent = 'Fotoğraf hazırlanıyor…';
      try {
        let source = original.file;
        if (!source) {
          const response = await fetch(original.url, { signal: state.controller.signal });
          if (!response.ok) throw new Error('Kayıtlı fotoğraf açılamadı. Fotoğrafı tekrar yükleyip deneyebilirsin.');
          source = await response.blob();
        }
        const prepared = await prepare(source);
        if (state.version !== version || key() !== initialKey) return;
        const result = await processPhoto(prepared, data => {
          status.textContent = data.status === 'processing' ? 'Arka plan temizleniyor…' : `Temizleme modeli indiriliyor${data.progress ? ` · %${data.progress}` : '…'}`;
        }, mode);
        if (state.version !== version || key() !== initialKey || (input.files?.[0] || null) !== selectedFile) return;
        const canvas = document.createElement('canvas');
        canvas.width = result.width; canvas.height = result.height;
        canvas.getContext('2d').putImageData(new ImageData(result.pixels, result.width, result.height), 0, 0);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob || blob.size > LIMIT) throw new Error('Temizlenen görsel çok büyük. Daha küçük fotoğrafla tekrar dene.');
        if (state.version !== version || key() !== initialKey) return;
        const file = new File([blob], 'acisu-' + kind + '-seffaf.png', { type: 'image/png' });
        const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files;
        if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
        state.previewUrl = URL.createObjectURL(file);
        state.original = original; state.result = file;
        preview.src = state.previewUrl; preview.hidden = false;
        status.textContent = result.alreadyTransparent ? 'Bu görselin arka planı zaten şeffaf. Kaydedebilirsin.' : 'Arka plan temizlendi. Önizlemeyi kontrol edip kaydet; istersen orijinale dön.';
      } catch (error) {
        if (state.version === version) status.textContent = error.message || 'Arka plan temizlenemedi. Orijinal fotoğraf korunuyor.';
      } finally { state.busy = false; state.controller = null; if (activeForm === form) activeForm = null; update(); }
    });
    preview.classList.remove('w-16', 'h-16', 'object-cover');
    preview.classList.add('w-28', mode === 'logo' ? 'h-28' : 'h-36', 'object-contain');
    preview.style.background = 'repeating-conic-gradient(#382e31 0% 25%, #21191c 0% 50%) 50% / 16px 16px';
    update();
  }
})();
