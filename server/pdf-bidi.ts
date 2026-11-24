/**
 * Unicode-correct bidirectional text layout for PDFKit.
 *
 * PDFKit/fontkit shapes Arabic and reverses Arabic glyph runs, but it does not
 * apply the Unicode Bidirectional Algorithm (UAX #9) to a whole line: numbers,
 * brackets, colons and Latin words mixed with Arabic end up in the wrong place.
 *
 * This module resolves embedding levels with `bidi-js`, reorders level runs into
 * visual order, mirrors paired brackets inside right-to-left runs and assigns a
 * suitable font per run. Every run is then drawn at an explicit x position, so
 * the visual order is fully deterministic.
 */
import bidiFactory from "bidi-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bidi: any = (bidiFactory as any)();

export interface BidiFonts {
  /** Font with Arabic glyphs (also used for neutrals in RTL paragraphs). */
  arabic: string;
  /** Font for Latin text and digits in LTR paragraphs. */
  latin: string;
}

export interface BidiRun {
  text: string;
  font: string;
  width: number;
  features?: string[];
}

export interface BidiLine {
  runs: BidiRun[];
  width: number;
  rtl: boolean;
}

const ARABIC_CHAR = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LATIN_CHAR = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]/;
const ARABIC_FEATURES = ["init", "medi", "fina", "isol", "liga", "rlig", "calt"];
const DIRECTION_MARKS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/** Paragraph direction follows the first strong character (UAX #9 rule P2). */
export function isRtlParagraph(text: string): boolean {
  for (const char of text) {
    if (ARABIC_CHAR.test(char)) return true;
    if (LATIN_CHAR.test(char)) return false;
  }
  return false;
}

function mirror(text: string): string {
  let out = "";
  for (const char of text) out += bidi.getMirroredCharacter(char) || char;
  return out;
}

interface LevelRun { start: number; end: number; level: number }

/** Returns level runs of a single line in visual (left-to-right) order. */
export function visualRuns(text: string, rtl: boolean): Array<{ text: string; level: number }> {
  if (!text) return [];
  const { levels } = bidi.getEmbeddingLevels(text, rtl ? "rtl" : "ltr");
  const runs: LevelRun[] = [];
  for (let i = 0; i < text.length; i++) {
    const level = levels[i];
    const last = runs[runs.length - 1];
    if (last && last.level === level) last.end = i + 1;
    else runs.push({ start: i, end: i + 1, level });
  }
  // Rule L2: from the highest level down to the lowest odd level, reverse
  // every contiguous sequence of runs at that level or higher.
  const maxLevel = Math.max(...runs.map((r) => r.level));
  const minOdd = Math.min(...runs.map((r) => (r.level % 2 ? r.level : r.level + 1)));
  for (let level = maxLevel; level >= minOdd; level--) {
    for (let i = 0; i < runs.length; i++) {
      if (runs[i].level < level) continue;
      let j = i;
      while (j + 1 < runs.length && runs[j + 1].level >= level) j++;
      if (j > i) {
        const reversed = runs.slice(i, j + 1).reverse();
        runs.splice(i, j - i + 1, ...reversed);
      }
      i = j;
    }
  }
  return runs.map((r) => ({ text: text.slice(r.start, r.end), level: r.level }));
}

/**
 * Converts one visual run into drawable text. For RTL runs containing Arabic,
 * fontkit reverses the glyphs itself, so the text stays logical and only paired
 * brackets are mirrored. RTL runs of neutrals only are reversed manually.
 */
function toDrawable(run: { text: string; level: number }, rtlParagraph: boolean, fonts: BidiFonts): Omit<BidiRun, "width"> {
  const isRtlRun = run.level % 2 === 1;
  if (isRtlRun) {
    const mirrored = mirror(run.text);
    if (ARABIC_CHAR.test(run.text)) return { text: mirrored, font: fonts.arabic, features: ARABIC_FEATURES };
    // Neutral-only RTL run (spaces, brackets, punctuation): reverse manually and
    // draw with the Latin font, which carries every punctuation glyph.
    return { text: Array.from(mirrored).reverse().join(""), font: fonts.latin };
  }
  if (ARABIC_CHAR.test(run.text)) return { text: run.text, font: fonts.arabic, features: ARABIC_FEATURES };
  void rtlParagraph;
  return { text: run.text, font: fonts.latin };
}

function measure(doc: PDFKit.PDFDocument, run: Omit<BidiRun, "width">, size: number): number {
  doc.font(run.font).fontSize(size);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (doc as any).widthOfString(run.text, run.features ? { features: run.features } : {});
}

/** Lays out a single physical line (no wrapping). */
export function layoutLine(doc: PDFKit.PDFDocument, text: string, rtl: boolean, size: number, fonts: BidiFonts): BidiLine {
  const runs: BidiRun[] = [];
  for (const run of visualRuns(text, rtl)) {
    const drawable = toDrawable(run, rtl, fonts);
    if (!drawable.text) continue;
    runs.push({ ...drawable, width: measure(doc, drawable, size) });
  }
  return { runs, width: runs.reduce((sum, r) => sum + r.width, 0), rtl };
}

function splitLongWord(doc: PDFKit.PDFDocument, word: string, rtl: boolean, size: number, width: number, fonts: BidiFonts): string[] {
  const parts: string[] = [];
  let current = "";
  for (const char of Array.from(word)) {
    const candidate = current + char;
    if (current && layoutLine(doc, candidate, rtl, size, fonts).width > width) {
      parts.push(current);
      current = char;
    } else {
      current = candidate;
    }
  }
  if (current) parts.push(current);
  return parts;
}

/** Wraps text into lines. Each hard line break starts a new paragraph with its own direction. */
export function layoutParagraphs(doc: PDFKit.PDFDocument, text: string, width: number, size: number, fonts: BidiFonts): BidiLine[] {
  const lines: BidiLine[] = [];
  const paragraphs = String(text ?? "").replace(DIRECTION_MARKS, "").replace(/\r\n?/g, "\n").split("\n");
  for (const paragraph of paragraphs) {
    const clean = paragraph.replace(/[ \t]+/g, " ").trim();
    if (!clean) continue;
    const rtl = isRtlParagraph(clean);
    const words = clean.split(" ").flatMap((word) =>
      layoutLine(doc, word, rtl, size, fonts).width > width ? splitLongWord(doc, word, rtl, size, width, fonts) : [word],
    );
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && layoutLine(doc, candidate, rtl, size, fonts).width > width) {
        lines.push(layoutLine(doc, current, rtl, size, fonts));
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(layoutLine(doc, current, rtl, size, fonts));
  }
  return lines;
}

export function lineHeightFor(size: number): number {
  return Math.round((size * 1.62) * 100) / 100;
}

export function bidiTextHeight(doc: PDFKit.PDFDocument, text: string, width: number, size: number, fonts: BidiFonts): number {
  const lines = layoutParagraphs(doc, text, width, size, fonts);
  return Math.max(1, lines.length) * lineHeightFor(size);
}

export type BidiAlign = "auto" | "left" | "right" | "center";

/**
 * Draws wrapped bidi text. `auto` aligns RTL paragraphs to the right and LTR
 * paragraphs to the left. Returns the drawn height.
 */
export function drawBidiText(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  size: number,
  color: string,
  fonts: BidiFonts,
  align: BidiAlign = "auto",
): number {
  const lines = layoutParagraphs(doc, text, width, size, fonts);
  const lineHeight = lineHeightFor(size);
  lines.forEach((line, index) => {
    const effective = align === "auto" ? (line.rtl ? "right" : "left") : align;
    let cursor = effective === "right" ? x + width - line.width : effective === "center" ? x + (width - line.width) / 2 : x;
    const baseline = y + index * lineHeight + size * 1.12;
    for (const run of line.runs) {
      doc.font(run.font).fontSize(size).fillColor(color);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (doc as any).text(run.text, cursor, baseline, {
        lineBreak: false,
        baseline: "alphabetic",
        ...(run.features ? { features: run.features } : {}),
      });
      cursor += run.width;
    }
  });
  return Math.max(1, lines.length) * lineHeight;
}

/** Plain-text visual order of a line, used by tests to verify ordering. */
export function visualOrderForTest(text: string): string {
  const rtl = isRtlParagraph(text);
  return visualRuns(text, rtl)
    .map((run) => (run.level % 2 ? Array.from(mirror(run.text)).reverse().join("") : run.text))
    .join("");
}
