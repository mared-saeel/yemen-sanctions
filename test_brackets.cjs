const text = 'SDGT (إرهابيون معينون عالمياً)';
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
  console.log('Token:', JSON.stringify(token), '| arChars:', arChars, '| enChars:', enChars, '| prevIsAr:', prevIsAr, '| tokenIsAr:', tokenIsAr);
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
console.log('\nGroups before reverse:', groups.map(g => '[' + (g.isAr ? 'AR' : 'EN') + '] "' + g.text + '"'));
groups.reverse();
console.log('Groups after reverse:', groups.map(g => '[' + (g.isAr ? 'AR' : 'EN') + '] "' + g.text + '"'));
