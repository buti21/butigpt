import pptxgen from "pptxgenjs";

export interface SlideSpec {
  title?: string;
  bullets?: string[];
  notes?: string;
}

export interface PresentationSpec {
  title: string;
  subtitle?: string;
  author?: string;
  slides: SlideSpec[];
}

const PRIMARY = "1E2761";   // navy
const ACCENT = "F96167";    // coral
const LIGHT_BG = "F7F9FC";
const TEXT_DARK = "1F2937";
const TEXT_MUTED = "4B5563";

export async function buildPresentation(spec: PresentationSpec): Promise<Blob> {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5

  if (spec.author) pres.author = spec.author;
  pres.title = spec.title;

  // ===== Title slide =====
  const title = pres.addSlide();
  title.background = { color: PRIMARY };
  title.addShape("rect", {
    x: 0,
    y: 6.6,
    w: 13.33,
    h: 0.15,
    fill: { color: ACCENT },
    line: { color: ACCENT },
  });
  title.addText(spec.title, {
    x: 0.7,
    y: 2.4,
    w: 12,
    h: 1.6,
    fontSize: 44,
    bold: true,
    color: "FFFFFF",
    fontFace: "Calibri",
  });
  if (spec.subtitle) {
    title.addText(spec.subtitle, {
      x: 0.7,
      y: 4.0,
      w: 12,
      h: 0.8,
      fontSize: 20,
      color: "CADCFC",
      fontFace: "Calibri Light",
    });
  }

  // ===== Content slides =====
  for (const s of spec.slides) {
    const slide = pres.addSlide();
    slide.background = { color: LIGHT_BG };

    // Header bar
    slide.addShape("rect", {
      x: 0,
      y: 0,
      w: 13.33,
      h: 0.6,
      fill: { color: PRIMARY },
      line: { color: PRIMARY },
    });
    slide.addShape("rect", {
      x: 0,
      y: 0.6,
      w: 13.33,
      h: 0.08,
      fill: { color: ACCENT },
      line: { color: ACCENT },
    });

    if (s.title) {
      slide.addText(s.title, {
        x: 0.5,
        y: 0.07,
        w: 12.3,
        h: 0.5,
        fontSize: 22,
        bold: true,
        color: "FFFFFF",
        fontFace: "Calibri",
        valign: "middle",
      });
    }

    const bullets = (s.bullets || []).filter((b) => b && b.trim());
    if (bullets.length) {
      slide.addText(
        bullets.map((b) => ({
          text: b,
          options: { bullet: { code: "25CF" }, color: TEXT_DARK },
        })),
        {
          x: 0.7,
          y: 1.1,
          w: 12,
          h: 5.8,
          fontSize: 18,
          fontFace: "Calibri",
          paraSpaceAfter: 10,
          valign: "top",
        },
      );
    }

    if (s.notes) {
      slide.addNotes(s.notes);
    }

    // Footer
    slide.addText(spec.title, {
      x: 0.5,
      y: 7.05,
      w: 10,
      h: 0.3,
      fontSize: 10,
      color: TEXT_MUTED,
      fontFace: "Calibri",
    });
  }

  // pptxgenjs returns a Blob when outputType is "blob"
  const out = (await pres.write({ outputType: "blob" })) as Blob;
  return out;
}

const PPTX_FENCE_RE = /```(?:buti-)?pptx\s*\n([\s\S]*?)```/i;

export function extractPresentationSpec(text: string): PresentationSpec | null {
  const m = text.match(PPTX_FENCE_RE);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[1]);
    if (!parsed?.title || !Array.isArray(parsed.slides)) return null;
    return parsed as PresentationSpec;
  } catch {
    return null;
  }
}

export function stripPresentationBlock(text: string): string {
  return text.replace(PPTX_FENCE_RE, "").trim();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFilename(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[^\w\s.-]+/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 60) || "prezentare";
}
