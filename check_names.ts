import { getDb } from './server/db';
import { sanctionsRecords } from './drizzle/schema';

const db = await getDb();
if (!db) throw new Error('DB not available');

// البحث عن سجلات تحتوي على "علي" في nameAr
const records = await db.select().from(sanctionsRecords).where((t) => t.nameAr && t.nameAr.includes('علي')).limit(5);

console.log('\nسجلات تحتوي على "علي" في nameAr:');
records.forEach((r) => {
  console.log(`- ${r.nameAr?.substring(0, 50)}`);
});

// البحث عن السجل الذي يعطي مطابقة "ALI DAWWA"
const aliRecords = await db.select().from(sanctionsRecords).where((t) => t.nameEn && t.nameEn.includes('ALI DAWWA')).limit(1);

if (aliRecords.length > 0) {
  const r = aliRecords[0];
  console.log('\nسجل "ALI DAWWA":');
  console.log('nameEn:', r.nameEn?.substring(0, 80));
  console.log('nameAr:', r.nameAr?.substring(0, 80));
}
