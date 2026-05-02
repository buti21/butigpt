// Client-side text extraction from common document formats.
// Used to let the user attach any file and have ButiGPT read its contents.

import JSZip from "jszip";

export interface ParsedFile {
  name: string;
  size: number;
  text: string;     // Extracted plain text (truncated to MAX_CHARS)
  truncated: boolean;
  kind: string;     // human-readable kind label
}

const MAX_CHARS = 60_000; // ~ keep prompts manageable

const truncate = (s: string): { text: string; truncated: boolean } => {
  if (s.length <= MAX_CHARS) return { text: s, truncated: false };
  return { text: s.slice(0, MAX_CHARS), truncated: true };
};

const stripXml = (xml: string) =>
  xml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || "";
}

async function extractPptx(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const slideFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/)![1], 10);
      const nb = parseInt(b.match(/slide(\d+)\.xml/)![1], 10);
      return na - nb;
    });
  const out: string[] = [];
  let i = 1;
  for (const path of slideFiles) {
    const xml = await zip.files[path].async("string");
    const text = decode(stripXml(xml));
    out.push(`--- Slide ${i} ---\n${text}`);
    i++;
  }
  return out.join("\n\n");
}

async function extractXlsx(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  // Shared strings
  let shared: string[] = [];
  const ssPath = "xl/sharedStrings.xml";
  if (zip.files[ssPath]) {
    const xml = await zip.files[ssPath].async("string");
    shared = Array.from(xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map((m) =>
      decode(m[1]),
    );
  }
  const sheetPaths = Object.keys(zip.files)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort();
  const out: string[] = [];
  let s = 1;
  for (const path of sheetPaths) {
    const xml = await zip.files[path].async("string");
    const rows = Array.from(xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g));
    const lines: string[] = [];
    for (const row of rows) {
      const cells = Array.from(row[1].matchAll(/<c[^>]*?(?:\s+t="([^"]+)")?[^>]*>([\s\S]*?)<\/c>/g));
      const values = cells.map((c) => {
        const type = c[1];
        const inner = c[2];
        const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
        if (type === "s") {
          const idx = parseInt(v, 10);
          return shared[idx] ?? "";
        }
        if (type === "inlineStr") {
          const t = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "";
          return decode(t);
        }
        return decode(v);
      });
      lines.push(values.join("\t"));
    }
    out.push(`--- Sheet ${s} ---\n${lines.join("\n")}`);
    s++;
  }
  return out.join("\n\n");
}

async function extractPdf(file: File): Promise<string> {
  // Lazy load pdfjs and configure its worker via a CDN URL based on its version.
  const pdfjs: any = await import("pdfjs-dist");
  // @ts-ignore — version exists at runtime
  const version = pdfjs.version || "4.0.0";
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const out: string[] = [];
  const total = Math.min(doc.numPages, 100);
  for (let i = 1; i <= total; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((it: any) => it.str).join(" ");
    out.push(`--- Page ${i} ---\n${text}`);
  }
  return out.join("\n\n");
}

async function extractText(file: File): Promise<string> {
  return await file.text();
}

const KIND_LABELS: Record<string, string> = {
  pdf: "PDF",
  docx: "Word",
  pptx: "PowerPoint",
  xlsx: "Excel",
  txt: "Text",
  md: "Markdown",
  csv: "CSV",
  tsv: "TSV",
  json: "JSON",
  html: "HTML",
  htm: "HTML",
  xml: "XML",
  rtf: "RTF",
  log: "Log",
  yml: "YAML",
  yaml: "YAML",
};

export async function parseFile(file: File): Promise<ParsedFile> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  let raw = "";
  try {
    switch (ext) {
      case "pdf":
        raw = await extractPdf(file);
        break;
      case "docx":
        raw = await extractDocx(file);
        break;
      case "pptx":
        raw = await extractPptx(file);
        break;
      case "xlsx":
      case "xlsm":
        raw = await extractXlsx(file);
        break;
      default:
        // Try as plain text — works for txt/md/csv/json/code files too.
        raw = await extractText(file);
        break;
    }
  } catch (e) {
    console.error("parseFile failed for", file.name, e);
    raw = "";
  }
  const { text, truncated } = truncate(raw);
  return {
    name: file.name,
    size: file.size,
    text,
    truncated,
    kind: KIND_LABELS[ext] || (ext ? ext.toUpperCase() : "Fișier"),
  };
}
