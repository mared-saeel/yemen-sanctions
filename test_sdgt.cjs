const PDFDocument = require('pdfkit');
const fs = require('fs');

const FONT_AR = './server/fonts/NotoSansArabic-Regular.ttf';
const FONT_EN = './server/fonts/NotoSans-Regular.ttf';
const FONT_EN_B = './server/fonts/NotoSans-Bold.ttf';
const AR_FEAT = ['arab', 'rtla', 'rtlm', 'calt', 'liga', 'curs', 'kern', 'mark', 'mkmk', 'init', 'medi', 'fina', 'isol'];
const BLACK = '#1a1a2e';

// Simulate the current renderMixedRTL
function renderMixedRTL(doc, text, x, y, w, sz, color) {
  color = color || BLACK;
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
  
  console.log('Text:', JSON.stringify(text));
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
doc.registerFont('EN', FONT_EN);
doc.registerFont('EN_B', FONT_EN_B);

const out = fs.createWriteStream('/tmp/test_sdgt.pdf');
doc.pipe(out);

const X = 45, W = 505;
let y = 50;

// Test: SDGT with Arabic in parentheses
const texts = [
  'SDGT (إرهابيون معينون عالمياً)',
  'SDGT] [IFSR',
  'Globally Designated Terrorists رهابيون معينون عالمياً',
  'إرهابيون معينون عالمياً',
];

for (const text of texts) {
  doc.font(FONT_EN_B).fontSize(8).fillColor(BLACK).text('Input: ' + text, X, y);
  y += 15;
  doc.rect(X, y, W, 25).fill('#f5f5f0');
  renderMixedRTL(doc, text, X + 5, y + 6, W - 10, 9, BLACK);
  y += 35;
  console.log('---');
}

doc.end();
out.on('finish', () => console.log('Done: /tmp/test_sdgt.pdf'));
