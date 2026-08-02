// Asamblează keyframe-urile generate de AI într-un clip video real (WebM),
// cu crossfade + un ușor Ken Burns (zoom/pan) pentru senzație de mișcare.

export interface BuildOptions {
  frames: string[];
  secondsPerFrame?: number;
  fps?: number;
  width?: number;
  height?: number;
  onProgress?: (p: number) => void;
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Nu am putut încărca un cadru"));
    img.src = src;
  });

const drawCover = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  zoom: number,
  alpha: number,
) => {
  const scale = Math.max(w / img.width, h / img.height) * zoom;
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  ctx.globalAlpha = 1;
};

export async function buildVideoFromFrames({
  frames,
  secondsPerFrame = 1.6,
  fps = 24,
  width = 1024,
  height = 576,
  onProgress,
}: BuildOptions): Promise<{ url: string; blob: Blob; duration: number }> {
  if (frames.length < 2) throw new Error("Prea puține cadre");

  const images = await Promise.all(frames.map(loadImage));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponibil");

  const stream = canvas.captureStream(fps);
  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(
    (t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t),
  );
  if (!mime) throw new Error("Browserul nu suportă export video");

  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
  const parts: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) parts.push(e.data);
  };
  const finished = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(parts, { type: mime }));
  });

  recorder.start(200);

  const frameMs = 1000 / fps;
  const perFrameCount = Math.round(secondsPerFrame * fps);
  const fadeCount = Math.max(4, Math.round(fps * 0.4));
  const totalSteps = images.length * perFrameCount;
  let step = 0;

  for (let i = 0; i < images.length; i++) {
    for (let f = 0; f < perFrameCount; f++) {
      const t = f / perFrameCount;
      const zoom = 1 + 0.06 * t; // Ken Burns
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);
      drawCover(ctx, images[i], width, height, zoom, 1);

      // crossfade către cadrul următor la final
      if (i < images.length - 1 && f >= perFrameCount - fadeCount) {
        const a = (f - (perFrameCount - fadeCount)) / fadeCount;
        drawCover(ctx, images[i + 1], width, height, 1, a);
      }

      step++;
      onProgress?.(step / totalSteps);
      await new Promise((r) => setTimeout(r, frameMs));
    }
  }

  await new Promise((r) => setTimeout(r, 250));
  recorder.stop();
  const blob = await finished;
  return {
    url: URL.createObjectURL(blob),
    blob,
    duration: images.length * secondsPerFrame,
  };
}
