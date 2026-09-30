// Remove flat, edge-connected logo backgrounds without altering enclosed crest details.
self.onmessage = async ({ data: { id, blob } }) => {
  let bitmap;
  try {
    self.postMessage({ id, status: 'processing' });
    bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { width: w, height: h, data: pixels } = image;
    const edges = [];
    for (let x = 0; x < w; x++) { edges.push(x, (h - 1) * w + x); }
    for (let y = 1; y < h - 1; y++) { edges.push(y * w, y * w + w - 1); }
    const opaque = edges.filter(i => pixels[i * 4 + 3] > 220);
    if (opaque.length < edges.length * .4) {
      self.postMessage({ id, status: 'done', width: w, height: h, pixels, alreadyTransparent: true }, [pixels.buffer]);
      return;
    }
    const buckets = new Map();
    for (const i of opaque) {
      const k = [0, 1, 2].map(c => Math.round(pixels[i * 4 + c] / 24)).join(',');
      const b = buckets.get(k) || { count: 0, sum: [0, 0, 0] };
      b.count++;
      for (let c = 0; c < 3; c++) b.sum[c] += pixels[i * 4 + c];
      buckets.set(k, b);
    }
    const dominant = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
    const color = dominant.sum.map(v => v / dominant.count);
    const distance = i => Math.max(...color.map((v, c) => Math.abs(pixels[i * 4 + c] - v)));
    if (opaque.filter(i => distance(i) <= 40).length < opaque.length * .55) {
      throw new Error('Bu armanın arka planı çok karışık. Tek renk arka planlı veya şeffaf PNG bir arma seç.');
    }
    const visited = new Uint8Array(w * h), queue = new Int32Array(w * h);
    let head = 0, tail = 0, removed = 0;
    const add = i => {
      if (visited[i]) return;
      visited[i] = 1;
      if (pixels[i * 4 + 3] === 0 || distance(i) <= 40) queue[tail++] = i;
    };
    for (const i of edges) add(i);
    while (head < tail) {
      const i = queue[head++], x = i % w;
      if (pixels[i * 4 + 3]) { pixels[i * 4 + 3] = 0; removed++; }
      if (x > 0) add(i - 1);
      if (x < w - 1) add(i + 1);
      if (i >= w) add(i - w);
      if (i < w * (h - 1)) add(i + w);
    }
    // Feather only the cut boundary, keeping interior white/black crest details intact.
    for (let i = 0; i < w * h; i++) {
      if (!pixels[i * 4 + 3]) continue;
      const x = i % w;
      const border = (x > 0 && pixels[(i - 1) * 4 + 3] === 0) ||
        (x < w - 1 && pixels[(i + 1) * 4 + 3] === 0) ||
        (i >= w && pixels[(i - w) * 4 + 3] === 0) ||
        (i < w * (h - 1) && pixels[(i + w) * 4 + 3] === 0);
      const d = distance(i);
      if (border && d > 40 && d < 75) pixels[i * 4 + 3] = Math.round(pixels[i * 4 + 3] * (d - 40) / 35);
    }
    if (removed > w * h * .98) throw new Error('Arma arka plandan ayırt edilemedi. Orijinal görsel korunuyor.');
    self.postMessage({ id, status: 'done', width: w, height: h, pixels }, [pixels.buffer]);
  } catch (error) {
    self.postMessage({ id, status: 'error', message: error.message || 'Arma temizlenemedi.' });
  } finally { bitmap?.close(); }
};
