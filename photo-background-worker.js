// Client-side portrait matting: Transformers.js and Xenova/MODNet (Apache-2.0).
// Images never leave the browser; only library/model files are downloaded.
import { env, pipeline, RawImage } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';

env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;
let segmenter;
self.onmessage = async ({ data }) => {
  const { id, blob } = data;
  let objectUrl;
  try {
    if (!segmenter) {
      self.postMessage({ id, status: 'loading' });
      segmenter = await pipeline('background-removal', 'Xenova/modnet', {
        dtype: 'fp32', device: 'wasm',
        progress_callback: progress => {
          if (progress.status === 'progress') {
            self.postMessage({ id, status: 'loading', progress: Math.round(progress.progress || 0) });
          }
        }
      });
    }
    self.postMessage({ id, status: 'processing' });
    objectUrl = URL.createObjectURL(blob);
    const input = await RawImage.fromURL(objectUrl);
    const result = await segmenter(input);
    const output = Array.isArray(result) ? result[0] : result;
    if (!output || output.channels !== 4) throw new Error('Şeffaf görsel oluşturulamadı.');
    const pixels = new Uint8ClampedArray(output.data);
    self.postMessage({ id, status: 'done', width: output.width, height: output.height, pixels }, [pixels.buffer]);
  } catch (error) {
    segmenter = null;
    self.postMessage({ id, status: 'error', message: error.message || 'Fotoğraf işlenemedi.' });
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
};
