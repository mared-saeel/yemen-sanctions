const PDFDocument = require('pdfkit');
const fs = require('fs');

const FONT_AR = './server/fonts/NotoSansArabic-Regular.ttf';
const FONT_AR_B = './server/fonts/NotoSansArabic-Bold.ttf';
const FONT_EN = './server/fonts/NotoSans-Regular.ttf';
const FONT_EN_B = './server/fonts/NotoSans-Bold.ttf';
const AR_FEAT = ['arab', 'rtla', 'rtlm', 'calt', 'liga', 'curs', 'kern', 'mark', 'mkmk', 'init', 'medi', 'fina', 'isol'];
const BLACK = '#1a1a2e';

function isAr(s) { return /[\u0600-\u06FF]/.test(s); }

function renderMixedRTL(doc, text, x, y, w, sz, color = BLACK) {
  const words = text.split(/(\s+)/);
  const groups = [];
  let cur = null;
  for (const word of words) {
    if (!word) continue;
    const isSpace = /^\s+$/.test(word);
    if (isSpace) { if (cur) cur.text += " "; continue; }
    const wordIsAr = /[\u0600-\u06FF]/.test(word);
    if (!cur) {
      cur = { text: word, isAr: wordIsAr };
    } else if (wordIsAr === cur.isAr) {
      cur.text += " " + word;
    } else {
      groups.push(cur);
      cur = { text: word, isAr: wordIsAr };
    }
  }
  if (cur && cur.text.trim()) groups.push(cur);
  
  console.log('Groups before reverse:', groups.map(g => `[${g.isAr?'AR':'EN'}] "${g.text}"`));
  groups.reverse();
  console.log('Groups after reverse:', groups.map(g => `[${g.isAr?'AR':'EN'}] "${g.text}"`));
  
  const widths = [];
  for (const g of groups) {
    doc.font(g.isAr ? FONT_AR : FONT_EN).fontSize(sz);
    widths.push(doc.widthOfString(g.text.trim()) + 6);
  }
  let curX = x + w;
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const gW = widths[i];
    curX -= gW;
    console.log(`Rendering [${g.isAr?'AR':'EN'}] "${g.text}" at x=${curX.toFixed(1)}, w=${gW.toFixed(1)}`);
    if (g.isAr) {
      doc.font(FONT_AR).fontSize(sz).fillColor(color);
      doc.text(g.text.trim(), curX, y, { align: "right", features: AR_FEAT, width: gW, lineBreak: false });
    } else {
      doc.font(FONT_EN).fontSize(sz).fillColor(color);
      doc.text(g.text.trim(), curX, y, { align: "left", width: gW, lineBreak: false });
    }
  }
}

const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 55, left: 45, right: 45 } });
doc.registerFont('AR', FONT_AR);
doc.registerFont('AR_B', FONT_AR_B);
doc.registerFont('EN', FONT_EN);
doc.registerFont('EN_B', FONT_EN_B);

const out = fs.createWriteStream('/tmp/test_lr.pdf');
doc.pipe(out);

const X = 45, W = 505;
let y = 50;

// Test 1: Mixed text
const text1 = 'Globally Designated Terrorists رهابيون معينون عالمياً';
doc.font(FONT_EN_B).fontSize(10).fillColor(BLACK).text('Test 1: Mixed text', X, y);
y += 20;
doc.rect(X, y, W, 30).fill('#f5f5f0');
renderMixedRTL(doc, text1, X + 5, y + 8, W - 10, 9, BLACK);
y += 40;

// Test 2: Pure Arabic
const text2 = 'رهابيون معينون عالمياً';
doc.font(FONT_EN_B).fontSize(10).fillColor(BLACK).text('Test 2: Pure Arabic', X, y);
y += 20;
doc.rect(X, y, W, 30).fill('#f5f5f0');
doc.font(FONT_AR).fontSize(9).fillColor(BLACK);
doc.text(text2, X + 5, y + 8, { align: 'right', features: AR_FEAT, width: W - 10, lineBreak: false });
y += 40;

// Test 3: Another mixed
const text3 = 'SDGT رهابيون معينون عالمياً';
doc.font(FONT_EN_B).fontSize(10).fillColor(BLACK).text('Test 3: SDGT mixed', X, y);
y += 20;
doc.rect(X, y, W, 30).fill('#f5f5f0');
renderMixedRTL(doc, text3, X + 5, y + 8, W - 10, 9, BLACK);

doc.end();
out.on('finish', () => console.log('Done: /tmp/test_lr.pdf'));
