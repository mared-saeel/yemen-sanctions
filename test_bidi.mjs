// Test how renderMixedRTL splits mixed Arabic-English text
const text = 'وقوائم الأمم المتحدة كزعيم لتنظيم OFAC SDGT (رقم 11696) متوفي في العام 2015م في حضرموت';
const tokens = text.split(' ');
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

console.log('Groups BEFORE reverse:');
groups.forEach((g, i) => console.log(i, g.isAr ? 'AR' : 'EN', '"' + g.text.substring(0, 50) + '"'));

groups.reverse();
console.log('\nGroups AFTER reverse (visual order right-to-left):');
groups.forEach((g, i) => console.log(i, g.isAr ? 'AR' : 'EN', '"' + g.text.substring(0, 50) + '"'));
console.log('\nVisual reading order (left to right as rendered):');
console.log(groups.map(g => g.text).join(' | '));
