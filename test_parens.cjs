const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const FONTS_DIR = path.join(__dirname, 'server/fonts');
const FONT_AR = path.join(FONTS_DIR, 'NotoSansArabic-Regular.ttf');
const FONT_EN = path.join(FONTS_DIR, 'NotoSans-Regular.ttf');
const AR_FEAT = ["rtla", "arab", "init", "medi", "fina", "isol"];

const doc = new PDFDocument({ size: 'A4', margin: 40 });
doc.pipe(fs.createWriteStream('/tmp/test_parens.pdf'));

doc.registerFont('AR', FONT_AR);
doc.registerFont('EN', FONT_EN);

const text = 'SDGT (إرهابيون معينون عالمياً)';
const sz = 8.5;
const x = 40, y = 60, w = 500;
const BLACK = '#1A1A1A';

// Method 1: Split on parentheses - treat parens as EN
// "(إرهابيون معينون عالمياً)" -> ["(", "إرهابيون معينون عالمياً", ")"]
// Render: ) [AR text] (  SDGT  (from right to left)

// Split text into segments: EN, paren, AR, paren
// Better: just strip parens from AR group and render them as EN
function renderMixedRTL_v2(doc, text, x, y, w, sz, color) {
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
  groups.reverse();
  
  // For AR groups: strip leading/trailing parens and render them as EN sub-tokens
  const finalGroups = [];
  for (const g of groups) {
    if (g.isAr) {
      // Check for leading paren
      const leadMatch = g.text.match(/^([\(\[\{]+)(.*?)([\)\]\}]*)$/s);
      if (leadMatch) {
        const leadParen = leadMatch[1];
        const arCore = leadMatch[2].trim();
        const trailParen = leadMatch[3];
        if (trailParen) finalGroups.push({ text: trailParen, isAr: false });
        if (arCore) finalGroups.push({ text: arCore, isAr: true });
        if (leadParen) finalGroups.push({ text: leadParen, isAr: false });
      } else {
        finalGroups.push(g);
      }
    } else {
      finalGroups.push(g);
    }
  }
  
  console.log('Final groups:', finalGroups.map(g => '[' + (g.isAr ? 'AR' : 'EN') + '] "' + g.text + '"'));
  
  const widths = [];
  for (const g of finalGroups) {
    doc.font(g.isAr ? 'AR' : 'EN').fontSize(sz);
    widths.push(doc.widthOfString(g.text.trim()) + 6);
  }
  
  let curX = x + w;
  for (let i = 0; i < finalGroups.length; i++) {
    const g = finalGroups[i];
    const gW = widths[i];
    curX -= gW;
    if (g.isAr) {
      doc.font('AR').fontSize(sz).fillColor(color);
      doc.text(g.text.trim(), curX, y, { align: 'right', features: AR_FEAT, width: gW, lineBreak: false });
    } else {
      doc.font('EN').fontSize(sz).fillColor(color);
      doc.text(g.text.trim(), curX, y, { align: 'left', width: gW, lineBreak: false });
    }
  }
}

doc.font('EN').fontSize(10).fillColor('#000').text('Test: SDGT (إرهابيون معينون عالمياً)', 40, 40, { lineBreak: false });
renderMixedRTL_v2(doc, text, x, y, w, sz, BLACK);
doc.font('EN').fontSize(10).fillColor('#000').text('Test 2: تجميد أموال وحظر تعاملات', 40, 90, { lineBreak: false });
renderMixedRTL_v2(doc, 'تجميد أموال وحظر تعاملات', x, 110, w, sz, BLACK);

doc.end();
console.log('Done: /tmp/test_parens.pdf');
