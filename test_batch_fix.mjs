import { searchSanctions } from './server/search-engine.ts';

const testNames = [
  "محمود مقبل حزام محمد",  // كان يعطي 100% مع MOHAMMAD SADIQ
  "سمية علي عبدالله علي الحرب",  // كان يعطي 94% مع EL-HOORIE ALI
  "ماجد محمد قاسم محمد علي",  // كان يعطي 94% مع ALI AHMED
];

console.log("اختبار البحث بعد الإصلاح:");
console.log("=" . repeat(80));

for (const name of testNames) {
  const result = await searchSanctions({ query: name, limit: 5 });
  console.log(`\nالبحث عن: ${name}`);
  console.log(`عدد النتائج: ${result.results.length}`);
  if (result.results.length > 0) {
    result.results.slice(0, 3).forEach((r, i) => {
      console.log(`  ${i+1}. ${r.nameEn} (${(r.matchScore * 100).toFixed(0)}%)`);
    });
  } else {
    console.log("  ✅ لا توجد نتائج - صحيح!");
  }
}
