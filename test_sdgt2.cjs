const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const FONTS_DIR = path.join(__dirname, 'server/fonts');
const FONT_AR = path.join(FONTS_DIR, 'NotoSansArabic-Regular.ttf');
const FONT_EN = path.join(FONTS_DIR, 'NotoSans-Regular.ttf');
const FONT_EN_B = path.join(FONTS_DIR, 'NotoSans-Bold.ttf');
const AR_FEAT = ["rtla", "arab", "init", "medi", "fina", "isol"];
const BLACK = '#1A1A1A';
const GRAY_ROW = '#F2F3F5';
const WHITE = '#FFFFFF';
const BORDER = '#C8CDD8';

// Updated renderMixedRTL with punctuation fix
function renderMixedRTL(doc, text, x, y, w, sz, color) {
  color = color || BLACK;
  const cleanText = text.replace(/\s+/g, ' ').trim();
  const tokens = cleanText.split(' ');
  const groups = [];
  let cur = null;

  for (const token of tokens) {
    if (!token) continue;
    const arChars = (token.match(/[\u0600-\u06FF]/g) || []).length;
    const enChars = (token.match(/[a-zA-Z0-9]/g) || []).length;
    const prevIsAr = cur !== null ? cur.isAr : false;
    const tokenIsAr = arChars > 0 || (enChars === 0 && prevIsAr);
    if (!cur) {
      cur = { text: token, isAr: tokenIsAr };
    } else if (tokenIsAr === cur.isAr) {
      cur.text += ' ' + token;
    } else {
      groups.push(cur);
      cur = { text: token, isAr: tokenIsAr };
    }
  }
  if (cur && cur.text.trim()) groups.push(cur);

  console.log('Text:', JSON.stringify(text));
  console.log('Groups:', groups.map(g => `[${g.isAr?'AR':'EN'}] "${g.text}"`));

  groups.reverse();

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
      doc.text(g.text.trim(), curX, y, { align: 'right', features: AR_FEAT, width: gW, lineBreak: false });
    } else {
      doc.font(FONT_EN).fontSize(sz).fillColor(color);
      doc.text(g.text.trim(), curX, y, { align: 'left', width: gW, lineBreak: false });
    }
  }
}

function renderValue(doc, text, x, y, w, sz, color) {
  color = color || BLACK;
  if (!text || text === '—') {
    doc.font(FONT_EN).fontSize(sz).fillColor('#5A6070');
    doc.text('—', x, y, { align: 'left', width: w, lineBreak: false });
    return;
  }
  const hasAr = /[\u0600-\u06FF]/.test(text);
  const arChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const enLetters = (text.match(/[a-zA-Z]/g) || []).length;
  const arDominant = hasAr && arChars > enLetters;

  if (arDominant) {
    doc.font(FONT_AR).fontSize(sz).fillColor(color);
    doc.text(text, x, y, { align: 'right', features: AR_FEAT, width: w, lineBreak: false });
  } else if (hasAr) {
    renderMixedRTL(doc, text, x, y, w, sz, color);
  } else {
    doc.font(FONT_EN).fontSize(sz).fillColor(color);
    doc.text(text, x, y, { align: 'left', width: w, lineBreak: false });
  }
}

const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 55, left: 45, right: 45 } });
doc.registerFont('AR', FONT_AR);
doc.registerFont('EN', FONT_EN);
doc.registerFont('EN_B', FONT_EN_B);

const out = fs.createWriteStream('/tmp/test_sdgt2.pdf');
doc.pipe(out);

const X = 45, W = 505;
let y = 50;

// Test the actual LISTING REASON values from DB
const testCases = [
  { label: 'LISTING REASON (SWAID)', value: 'SDGT (إرهابيون معينون عالمياً)' },
  { label: 'LISTING REASON (PAUL)', value: 'SDGT] [IFSR' },
  { label: 'Action Taken', value: 'تجميد أموال وحظر تعاملات' },
  { label: 'Mixed long', value: 'Globally Designated Terrorists (إرهابيون معينون عالمياً) SDGT' },
];

for (const tc of testCases) {
  // Label
  doc.font(FONT_EN_B).fontSize(8).fillColor(BLACK).text(tc.label + ':', X, y);
  y += 14;
  // Row background
  doc.rect(X, y, W, 22).fill(GRAY_ROW);
  doc.rect(X, y, W, 22).stroke(BORDER);
  // Value
  renderValue(doc, tc.value, X + 5, y + 5, W - 10, 9, BLACK);
  y += 32;
  console.log('---');
}

doc.end();
out.on('finish', () => console.log('Done: /tmp/test_sdgt2.pdf'));
