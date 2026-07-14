import openpyxl from 'openpyxl';

// قراءة الملف
const wb = openpyxl.load_workbook('/home/ubuntu/upload/ورقةعملMicrosoftExcelجديد(2).xlsx');
const ws = wb.active;

// قراءة الأسماء
const names = [];
for (const row of ws.iter_rows({min_row: 1, max_row: ws.max_row, min_col: 1, max_col: 1, values_only: true})) {
  if (row[0] && String(row[0]).trim()) {
    names.push(String(row[0]).trim());
  }
}

console.log(`\n${'='.repeat(80)}`);
console.log(`اختبار البحث على ${names.length} اسم من ملف الاختبار`);
console.log(`${'='.repeat(80)}\n`);

// اختبار البحث
import { searchSanctions } from './server/search-engine.ts';

let falsePositives = 0;
let correctMatches = 0;

for (const name of names) {
  const result = await searchSanctions({ query: name, limit: 1 });
  
  if (result.results.length === 0) {
    console.log(`✅ ${name}`);
    console.log(`   النتيجة: لا توجد مطابقات (صحيح!)\n`);
    correctMatches++;
  } else {
    const match = result.results[0];
    console.log(`❌ ${name}`);
    console.log(`   المطابقة: ${match.nameEn} (${match.matchScore}%)`);
    console.log(`   النوع: ${match.matchType}\n`);
    falsePositives++;
  }
}

console.log(`${'='.repeat(80)}`);
console.log(`النتائج الإجمالية:`);
console.log(`- الأسماء الصحيحة (بدون مطابقات): ${correctMatches}`);
console.log(`- المطابقات الخاطئة: ${falsePositives}`);
console.log(`- نسبة الخطأ: ${((falsePositives / names.length) * 100).toFixed(1)}%`);
