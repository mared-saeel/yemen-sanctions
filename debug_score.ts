import { getDb } from './server/db';
import { sanctionsRecords } from './drizzle/schema';

const db = await getDb();
if (!db) throw new Error('DB not available');

// البحث عن سجل بـ nameAr فارغ
const record = await db.select().from(sanctionsRecords).where((t) => t.nameAr === null || t.nameAr === '').limit(1);

if (record.length > 0) {
  const r = record[0];
  console.log('\nسجل بـ nameAr فارغ:');
  console.log('ID:', r.id);
  console.log('nameEn:', r.nameEn?.substring(0, 50));
  console.log('nameAr:', r.nameAr);
  console.log('alternativeNames:', r.alternativeNames);
  
  // اختبر scoreRecord
  const { scoreRecord } = await import('./server/search-engine');
  const result = scoreRecord('محمود مقبل حزام محمد', r);
  console.log('\nنتيجة scoreRecord:');
  console.log('score:', result.score);
  console.log('matchType:', result.matchType);
} else {
  console.log('لم يتم العثور على سجل بـ nameAr فارغ');
}
