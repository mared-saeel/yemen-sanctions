import { searchSanctions } from './server/search-engine.ts';
import * as fs from 'fs';
import * as XLSX from 'xlsx';

// قراءة الملف
const filePath = '/home/ubuntu/upload/ورقةعملMicrosoftExcelجديد(2).xlsx';
const fileBuffer = fs.readFileSync(filePath);
const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

// استخراج الأسماء من العمود الأول
const names = data
  .map((row: any[]) => row[0])
  .filter((name: any) => name && String(name).trim().length > 0)
  .map((name: any) => String(name).trim());

console.log(`\n${'='.repeat(80)}`);
console.log(`اختبار البحث على ${names.length} اسم من ملف الاختبار`);
console.log(`${'='.repeat(80)}\n`);

let falsePositives = 0;
let correctMatches = 0;
const results: any[] = [];

for (const name of names) {
  const result = await searchSanctions({ query: name, limit: 1 });
  
  if (result.results.length === 0) {
    console.log(`✅ ${name}`);
    console.log(`   النتيجة: لا توجد مطابقات (صحيح!)\n`);
    correctMatches++;
    results.push({ name, status: 'correct', match: null });
  } else {
    const match = result.results[0];
    console.log(`❌ ${name}`);
    console.log(`   المطابقة: ${match.nameEn} (${match.matchScore}%)`);
    console.log(`   النوع: ${match.matchType}\n`);
    falsePositives++;
    results.push({ name, status: 'false_positive', match: match.nameEn, score: match.matchScore });
  }
}

console.log(`${'='.repeat(80)}`);
console.log(`النتائج الإجمالية:`);
console.log(`- الأسماء الصحيحة (بدون مطابقات): ${correctMatches}`);
console.log(`- المطابقات الخاطئة: ${falsePositives}`);
console.log(`- نسبة الخطأ: ${((falsePositives / names.length) * 100).toFixed(1)}%`);

// حفظ النتائج
fs.writeFileSync('/home/ubuntu/upload/test_results.json', JSON.stringify(results, null, 2));
console.log(`\nتم حفظ النتائج في: /home/ubuntu/upload/test_results.json`);
