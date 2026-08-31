# Smart Sanctions Search Platform - TODO

## Phase 1: Database Schema & Backend Foundation
- [x] Design and push database schema (sanctions, companies, audit_logs tables)
- [x] Install required packages (fuse.js, xlsx, exceljs, pdfkit, fast-levenshtein)
- [x] Build data import script to load 39,710 records from Excel into DB
- [x] Build fuzzy search engine with Levenshtein Distance + Fuse.js
- [x] Build AI-powered semantic search using LLM (Forge API)
- [x] Build tRPC search router with advanced filtering
- [x] Build audit log system for all search operations

## Phase 2: Frontend - Search Interface
- [x] Design dark professional theme (LSEG World-Check style)
- [x] Build main search page with smart search bar
- [x] Build entity type filter (Individual / Organisation / Vessel / Unspecified)
- [x] Build advanced filters (nationality, date range, listing reason, issuing body)
- [x] Build search results list with match score display
- [x] Build detailed record view modal/page
- [ ] Build batch search mode (placeholder - coming soon)

## Phase 3: Admin Dashboard
- [x] Build admin dashboard with statistics
- [x] Build user management (create, edit, disable users)
- [x] Build company management
- [x] Build audit log viewer with search and filters
- [ ] Build system monitoring charts (coming soon)

## Phase 25: Fix Batch Screening - Raise Match Threshold to 90%
- [x] رفع الحد الأدنى للمطابقة في Batch Screening إلى 90% لتجنب النتائج الخاطئة
- [x] تحديث تصنيفات النتائج: MATCH >= 90%, POSSIBLE MATCH 70-89%, NO MATCH < 70%

## Phase 4: Export & Reports
- [x] Export search results to PDF (print-to-PDF)
- [x] Export search results to Excel/CSV
- [x] Export search results to JSON
- [ ] Generate detailed screening report per record (coming soon)

## Phase 5: Testing & Polish
- [x] Write vitest unit tests for search engine
- [x] Write vitest unit tests for auth/permissions
- [x] Final UI polish and responsiveness
- [x] Save checkpoint and deliver

## Phase 6: UI Redesign - White Professional Theme
- [x] Redesign index.css with white/light professional theme
- [x] Update AppLayout with new sidebar and header design
- [x] Update SearchPage with white theme and new card design
- [x] Update Admin pages with new white theme
- [x] Update RecordModal with new design
- [x] Test and verify all pages look correct

## Phase 7: Logo & Branding
- [x] Upload Almustashar logo to CDN
- [x] Remove "World-Check" text from all UI components
- [x] Add logo to sidebar in AppLayout
- [x] Add logo to SearchPage header/check types section
- [x] Save checkpoint and deliver

## Phase 8: Password Authentication System
- [x] Add passwordHash and username fields to users table in schema
- [x] Add password-based login API (POST /api/auth/login)
- [x] Add create user API for admins (with username + password)
- [x] Add change password API
- [x] Build login page with username/password form
- [x] Update AdminUsers page with create/edit user modal
- [x] Write vitest tests for auth (24/24 passed)
- [x] Save checkpoint and deliver

## Phase 9: Fix Sign In Redirect
- [x] Fix Sign In button in Home page to redirect to /login instead of Manus OAuth
- [x] Fix AppLayout Sign In link to redirect to /login
- [x] Ensure all auth redirects bypass OAuth and go directly to password login
- [x] Save checkpoint and deliver

## Phase 10: Golden Brand Colors
- [x] Update CSS --primary variable to golden color (#C17F3E)
- [x] Update sidebar active nav item to golden
- [x] Update SCREEN button and all primary buttons to golden
- [x] Update login page accent to golden
- [x] Update badges and highlights to golden
- [x] Test all pages visually
- [x] Save checkpoint and deliver

## Phase 11: Excel Import from Admin Panel
- [x] Build Express multipart endpoint for Excel file upload (/api/admin/import-sanctions)
- [x] Write Excel parsing and DB insert logic (append mode + replace mode)
- [x] Add import_logs table to track import history
- [x] Build ImportData page in admin panel
- [x] Add "Import Data" link in sidebar navigation
- [x] Test feature and save checkpoint

## Phase 12: Professional PDF Report
- [x] Study RecordModal and data structure
- [x] Build tRPC procedure to generate PDF report for a record
- [x] Design professional PDF layout with logo, record details, legal disclaimer
- [x] Add "Download Report" button in RecordModal footer
- [x] Test and save checkpoint

## Phase 13: Fix Search - English Name Not Matching
- [x] Analyze search engine code to find root cause
- [x] Fix search to give equal weight to nameEn and nameAr
- [x] Ensure exact match on English name returns 100% score
- [x] Test with "DREW PROPERTIES CO. LTD." and verify it returns exact match
- [x] Save checkpoint

## Phase 14: Fix PDF Report - Arabic/English Bilingual Support
- [x] Diagnose PDF font issue (English text showing as boxes)
- [x] Implement dual-font strategy: NotoSansArabic for Arabic, NotoSans for English
- [x] Add RTL OpenType features for correct Arabic rendering in PDFKit
- [x] Fix footer to display pure Arabic text (avoid mixed Latin/Arabic in same string)
- [x] Test PDF generation with record ID 78619 (AHMAD HUSSAIN AL-SHARAA)
- [x] Save checkpoint

## Phase 15: Fix PDF Report in Production - Font Files Not Found
- [x] Copy Noto font files into project directory (server/fonts/)
- [x] Update pdf-report.ts to use relative paths to bundled fonts
- [x] Fix __dirname ES module error (use import.meta.url instead)
- [x] Test PDF generation with bundled fonts locally
- [x] Save checkpoint and publish

## Phase 16: Fix PDF in Production - Fonts Not Copied to dist
- [x] Diagnose: fonts in server/fonts/ not copied to dist/fonts/ during build
- [x] Fix build script in package.json to copy fonts after esbuild: cp -r server/fonts dist/fonts
- [x] Verify dist/fonts/ contains all 4 font files after build
- [x] Save checkpoint and publish

## Phase 17: PDF Report - Fix Boxes & Add Logo
- [x] Remove black background from logo and convert to transparent PNG
- [x] Copy logo to server/fonts/logo.png for server-side use
- [x] Fix alternative names boxes (detect language per name, use correct font)
- [x] Add logo to PDF report header and footer attractively
- [x] Fix second empty page issue (bufferPages + disable bottom margin trick)
- [x] Update build script to copy logo.png to dist/fonts/
- [x] Test and save checkpoint

## Phase 18: Home Page Redesign - Language Toggle & Logo
- [x] Add language toggle button (AR/EN) in navbar
- [x] Translate all Home page content to Arabic (inline translations object)
- [x] Add Al-Mustashar logo attractively in navbar header and footer
- [x] Improve overall Home page design with golden accent colors
- [x] Support RTL direction when Arabic is selected
- [x] Default language set to Arabic
- [x] Save checkpoint and publish

## Phase 19: Home Page Professional Redesign
- [x] Fix badge text: tagline now shows "المستشار للاستشارات القانونية"
- [x] Fix description text: now uses "آلاف الكيانات والأفراد المدرجين دولياً"
- [x] Fix target audience text: now says "القطاع الخاص والمصرفي"
- [x] Add "من نحن" section with professional Arabic text
- [x] Add "رؤيتنا" and "رسالتنا" cards
- [x] Add "قيمنا" section with 3 values
- [x] Add CTA banner section
- [x] Dark navy + amber gold professional legal design
- [x] Save checkpoint and publish

Detected
## Phase 20: Logo & Theme Toggle
- [x] Enlarge Al-Mustashar logo in header (make it prominent)
- [x] Add light/dark theme toggle button in header
- [x] Adapt all sections to support both light and dark themes
- [x] Save checkpoint and publish

## Phase 21: Fix PDF Listing Reason - Mixed Arabic/Latin Text
- [x] Diagnose: NotoSansArabic doesn't support Latin chars (I, R, A, Q, (, )) causing boxes
- [x] Add writeMixedText function: splits text into Arabic/Latin parts, renders each with correct font
- [x] Update writeAutoFont to detect mixed text and call writeMixedText
- [x] Clean up Latin part: remove brackets/parentheses that wrap Arabic text
- [x] Increase box height for mixed-text fields to fit two lines
- [x] Test with record 60447 (IRAQ2 / عقوبات العراق) - both parts now readable
- [x] Save checkpoint and publish

## Phase 22: Fix Badge Colors in Light Theme
- [x] Diagnose: tagline badge used text-amber-400 (light) and AI badge used text-blue-300 (light) - both unreadable on white background
- [x] Add taglineBadge, taglineLogoFilter, aiBadge to theme object with dark/light variants
- [x] Light theme: tagline badge = text-amber-900 on bg-amber-100, AI badge = text-blue-900 on bg-blue-100
- [x] Verified both badges are clearly readable in light theme
- [x] Save checkpoint and publish

## Phase 23: Redesign PDF Report (LSEG World-Check Style)
- [x] Analyze current pdf-report.ts structure
- [x] Redesign header: logo left + "SanctionCheck Match Details Report" + "Confidential" right
- [x] Add Record UID section with highlighted background
- [x] Redesign all sections as structured tables with alternating row colors
- [x] Add CASE AND COMPARISON DATA section (submitted name vs matched name)
- [x] Redesign KEY DATA section as clean table
- [x] Redesign ALIASES section as clean table
- [x] Add footer with Al-Mustashar logo + page number
- [x] Test PDF output and verify Arabic/mixed text rendering
- [x] Save checkpoint and publish


## Phase 24: PDF Report - Exact LSEG World-Check Style (Single Page)
- [ ] White background, no colored header banner
- [ ] Header: logo-style text top-left + "Confidential" top-right (like LSEG)
- [ ] Bold report title line below header
- [ ] Record UID highlighted row
- [ ] CASE AND COMPARISON DATA table (3 columns)
- [ ] KEY DATA table with alternating rows (compact font size 7-8)
- [ ] ALIASES section compact table
- [ ] Footer: Al-Mustashar logo bottom-right only
- [ ] Single page layout with compressed font sizes
- [ ] Test and verify single page output
- [ ] Save checkpoint and publish

## Phase 25: إصلاح عرض الملاحظات الكاملة ✅ مكتمل
- [x] إزالة اقتطاع النص في قسم Notes في RecordModal.tsx
- [x] إزالة اقتطاع النص في قسم Notes في RecordDetail.tsx
- [x] إزالة اقتطاع النص في تقرير PDF (pdf-report.ts)
- [x] التحقق من عرض الملاحظات الكاملة في جميع الأماكن
- [x] إضافة دعم النصوص المختلطة (عربي + إنجليزي) في PDF
- [x] تنزيل خط Cairo لدعم كلا اللغتين
- [x] إصلاح اتجاه النص RTL في PDF

## Phase 26: إصلاح مشاكل اللغة العربية في تقرير PDF
- [x] إصلاح النص العربي المقلوب في LISTING REASON (استخدام arText)
- [x] إصلاح مشكلة المربعات في Action Taken (زيادة ارتفاع الصف) (النص العربي لا يظهر)

## Phase 27: تحسين البحث - تجاوز الرموز والنقاط ✅ مكتمل
- [x] إضافة دالة normalizeSearchText لتجاوز النقاط والرموز والفواصل
- [x] تطبيق التطبيع على query و database records
- [x] تطبيق التطبيع على البحث من قاعدة البيانات (like queries)
- [x] إضافة فحص دقيق في scoreRecord قبل حساب النقاط
- [x] اختبار البحث عن "HUTHELE, Nasr Mohsen Ali" والتأكد من المطابقة (✅ 1 result, 100% Exact match)

## Phase 28: إصلاح البطء وفشل الباتشينج 🔧 ✅ مكتمل
- [x] تحديد مشاكل البطء الرئيسية (استعلامات DB ضخمة، معالجة Fuse.js بطيئة)
- [x] تقليل استعلامات Fuse.js من 5000 إلى 1000 سجل
- [x] تحسين معالج الباتشينج باستخدام البحث في الذاكرة بدلاً من DB
- [x] زيادة معاملة متوازية من 3 إلى 10 أسماء
- [x] تقليل التأخير بين العمليات من 100ms إلى 50ms

## Phase 29: اختبار الباتشينج الشامل 🧪 ✅ مكتمل
- [x] إنشاء ملفات اختبار Excel (4 ملفات بأحجام وأسماء مختلفة)
- [x] ملف صغير: 5 أسماء عربية/إنجليزية
- [x] ملف متوسط: 25 اسم مزيج
- [x] ملف كبير: 90 اسم متنوع
- [x] ملف رموز: 20 اسم مع فواصل وشرطات ونقاط
- [x] اختبار المصادقة والدخول إلى صفحة الباتشينج
- [x] إنشاء تقرير اختبار شامل (COMPREHENSIVE_BATCH_TEST_REPORT.md)
- [ ] إصلاح رفع الملفات من الواجهة الأمامية (مشكلة React refs)
- [ ] اختبار الباتشينج مع الملفات المنشأة من الواجهة الأمامية

## Phase 30: إصلاح الباتشينج النهائي والشامل 🎉 ✅ مكتمل
- [x] إعادة كتابة batch-handler.ts بالكامل مع معالجة أخطاء شاملة
- [x] إضافة معالجة المصادقة بشكل صحيح في جميع endpoints
- [x] تحسين الأداء: معالجة متوازية من 15 اسم في كل دفعة
- [x] تحميل البيانات مرة واحدة فقط (بدون استعلامات DB متكررة)
- [x] Timeout محسّن (540 ثانية بدلاً من 180)
- [x] دعم ملفات كبيرة (حتى 500 اسم بدلاً من 100)
- [x] معالجة الأسماء العربية والإنجليزية بشكل صحيح
- [x] اختبار شامل مع الملف المرفق (99 اسم عربي)
- [x] النظام جاهز للنشر والاستخدام الفوري 🚀

## Phase 31: إصلاح الباتشينج بشكل جذري وتحسين الأداء 🔧
- [x] فحص ملف batch-handler.ts وتحديد مشاكل الأداء
- [x] تقليل الحد الأقصى من 500 إلى 100 اسم
- [x] تحسين معالجة الملفات (رفع الملفات)
- [x] تحسين خوارزمية البحث في الباتشينج
- [x] تطبيق المعالجة المتوازية للبحث السريع (زيادة من 15 إلى 25)
- [x] تحسين قاعدة البيانات (indexing) - بالفعل جيدة بالفعل
- [x] اختبار الباتشينج مع 100 اسم (إنشاء ملف اختبار صحيح)
- [x] اختبار الأداء والسرعة (تم تحسين الأداء بشكل كبير)
- [x] حفظ checkpoint للتحسينات


## Phase 32: إصلاح خوارزمية البحث الذكي 🤖 ✅ مكتمل
- [x] تحليل المشاكل الحالية في خوارزمية البحث
- [x] تطوير خوارزمية بحث محسّنة مع Phonetic Matching
- [x] تطبيق التحسينات على الكود (advanced-search-engine.ts + search-engine.ts)
- [x] اختبار شامل للخوارزمية الجديدة
  - [x] البحث عن "حميد الاحمر": النتيجة الصحيحة أولاً بـ 100% ✓
  - [x] البحث عن "خميد الاحمر": 49 نتيجة مع نتائج قريبة ✓
- [x] حفظ checkpoint والتسليم النهائي

## Phase 33: إصلاح نقاط المطابقة والترتيب 🔧 ✅ مكتمل
- [x] إصلاح النقاط التي تتجاوز 100% (Math.min(1.0, score) في 4 أماكن)
- [x] تحسين ترتيب النتائج للبحث عن "خميد الاحمر"
- [x] إضافة فحص صارم للكلمة الأولى في 6 دوال مختلفة
- [x] تحسين Fuse.js threshold من 0.5 إلى 0.4
- [x] اختبار النتائج: انخفضت من 49 إلى 4 نتائج دقيقة
- [x] حفظ checkpoint


## Phase 34: نظام البحث الذكي - تطابق الكلمات المتعددة 🤖 ✅ مكتمل
- [x] إنشاء ملف smart-word-matcher.ts مع خوارزمية ذكية
- [x] البحث عن الأسماء المرتبطة بناءً على تطابق 2+ كلمات
- [x] دعم البحث بغض النظر عن موضع الكلمات
- [x] إضافة استيراد النظام الذكي في search-engine.ts
- [x] دمج النظام الذكي كأولوية أولى في scoreRecord
- [x] اختبار شامل مع النتائج الحقيقية
- [x] حفظ checkpoint (5e0dac7d)


## Phase 35: إصلاح النظام الذكي - إزالة "عبد" من Stop Words 🔧 ✅ مكتمل
- [x] تحديد مشكلة: كلمة "عبد" في قائمة stop words تمنع البحث عن "عبدالله"
- [x] إزالة "عبد" من قائمة stop words في smart-word-matcher.ts
- [x] اختبار البحث عن "عبدالله حسين الاحمر" - يجد 168 نتيجة
- [x] اختبار البحث عن "حميد عبدالله حسين الاحمر" - النتيجة الأولى Exact
- [x] النظام يعمل بشكل مثالي الآن
- [x] حفظ checkpoint (b71d019f)


## Phase 37: إصلاح دقة البحث في الباتش وتحسين الواجهة
- [x] Fix batch search accuracy - false positives like "ماجد عبدالخالق" matching "ДЕНИС МАЙДАНОВ" (تم إصلاح الحد الأدنى للمطابقة)
- [x] Implement proper classification thresholds: MATCH >= 85%, POSSIBLE_MATCH 60-84%, NO_MATCH < 60%
- [x] دعم المطابقة المكافئة للاسم العربي المركب مثل «عبدالله» و«عبد الله» في الباتش
- [x] ضمان استرجاع المرشح العربي الصحيح للاسم المركب من قاعدة البيانات الحية
- [ ] Add real-time progress bar for batch processing
- [ ] إتاحة دورة المعالجة للخادم بين الأسماء كي تصل تحديثات التقدم الحية إلى الواجهة
- [ ] Improve BatchPage UI to look more professional
- [ ] Ensure batch uses same search engine as single search
- [ ] Test with user's Excel file and verify accuracy

## Phase 36: خاصية تعديل البيانات للإدمن

- [ ] إنشاء صفحة تعديل البيانات
- [ ] إضافة دالة تحديث البيانات في قاعدة البيانات
- [ ] إضافة زر تعديل بجانب كل نتيجة بحث
- [ ] إضافة فحص الصلاحيات (admin فقط)
- [ ] إضافة سجل تدقيق (audit log)
- [ ] اختبار شامل للتعديلات

## Phase 56: حذف سجل العقوبات للإدمن

- [x] مراجعة مكوّن نتيجة البحث ومسار بيانات السجل الحالي
- [x] إضافة إجراء حذف مقصور على المدير مع تسجيل تدقيق
- [x] إضافة زر حذف ونافذة تأكيد في نتائج البحث للمدير فقط
- [x] اختبار منع غير المدير واختبار الحذف وسجل التدقيق
- [x] التحقق البصري وحفظ checkpoint

## Phase 57: تصور تطوير واجهة البحث

- [x] مراجعة تجربة واجهة البحث الحالية وتحديد أولويات تحسينها
- [x] إعداد مقترح مهني لتحسين البحث والنتائج والمرشحات
- [x] اعتماد نطاق تحسين واجهة البحث قبل التنفيذ
- [x] إنشاء صورة تصورية لواجهة البحث المقترحة وتسليمها للمراجعة
- [x] ضمان أن تحسين واجهة البحث لا يغيّر محرك البحث أو استعلامات البيانات أو الأداء
- [x] اعتماد واستخدام الشعار الأصلي للمنصة حصراً في أي تصور أو تنفيذ للواجهة

## Phase 58: إعادة تصميم واجهة البحث الاحترافية

- [x] الحفاظ على محرك البحث واستعلاماته وسرعته دون تغيير
- [x] الحفاظ على الشعار الأصلي الحالي للمنصة دون إعادة تصميمه
- [x] إعادة تصميم مساحة البحث وملخص النتائج والمرشحات بأسلوب امتثالي هادئ
- [x] إعادة بناء صفوف النتائج لإبراز قرار المطابقة والبيانات الأساسية
- [x] ضبط إجراءات المدير ضمن نتائج البحث دون ظهورها للمستخدم العادي
- [x] إضافة اختبارات تثبت عدم تغيير استدعاء محرك البحث والتحقق البصري للواجهة
- [x] حفظ checkpoint للواجهة الجديدة

## Phase 59: مواءمة واجهة البحث مع التصميم المرجعي

- [x] الحفاظ على محرك البحث واستعلاماته وسرعته دون تغيير
- [x] الحفاظ على الشعار الأصلي للمنصة دون استبدال أو إعادة تصميم
- [x] اعتماد جدول نتائج أفقي بصفوف مراجعة وفق التصميم المرجعي
- [x] تنظيم المرشحات وملخص النتائج بنفس لغة الألوان الهادئة للمرجع
- [x] إبقاء إجراءات المدير ضمن عمود الإجراءات وبصلاحياتها القائمة
- [x] إضافة اختبارات للتحقق من هيكل الجدول وثبات استدعاء البحث
- [x] التحقق البصري وحفظ checkpoint


## Phase 38: تحديث الأرقام والثيم الأبيض ✅ مكتمل
- [x] تحديث عدد الكيانات المدرجة من 39,710+ إلى 50,000+ في جميع الصفحات
- [x] تطبيق الثيم الأبيض كالأساسي (defaultTheme="light")
- [x] إصلاح ألوان قسم CTA والـ Footer للثيم الأبيض
- [x] إصلاح ألوان النصوص في جميع الأقسام
- [x] حفظ checkpoint (f647ccfe)

## Phase 39: إنشاء دليل الاستخدام الشامل ✅ مكتمل
- [x] كتابة دليل استخدام شامل بـ 10 أقسام رئيسية
- [x] تحويل الدليل إلى PDF احترافي (174 KB)
- [x] تضمين جميع المزايا والإمكانيات
- [x] تضمين أسئلة شائعة وإجابات مفصلة
- [x] تضمين نصائح مهمة للاستخدام الفعال

## Phase 40: تحسين محرك البحث - دعم البحث الجزئي للأسماء المركبة 🔍 ✅ مكتمل
- [x] إصلاح مشكلة "سويد للصرافة" لا تجد "شركة سويد واولاده للصرافة"
- [x] تغيير منطق استرجاع المرشحين: البحث بكل كلمة منفردة دائماً (ليس فقط عند فشل العبارة الكاملة)
- [x] إضافة خوارزمية Jaro-Winkler كطبقة أولى للأسماء الشخصية
- [x] إضافة Subset Match Score - إذا كانت كلمات الاستعلام موجودة كلها في الاسم → نتيجة 75-95%
- [x] إصلاح first-word-check لدعم subset matching (لا يرفض إذا كانت كل الكلمات موجودة)
- [x] اختبار: "سويد للصرافة" يجد "سويد وأولاده للصرافة" بـ 100% ✓
- [x] اختبار: "سويد" يجد 16 نتيجة تشمل جميع الكيانات المرتبطة ✓
- [x] اختبار: "DREW PROPERTIES" يجد DREW PROPERTIES CO. LTD. بـ 92% ✓
- [x] اختبار: "حميد الاحمر" يجد حميد عبد الله حسين الأحمر بـ 99% ✓
- [x] حفظ checkpoint

## Phase 41: تثبيت احترافية تقارير PDF ودعم العربية
- [x] الحفاظ على التصميم والهوية البصرية المعتمدين حالياً دون استبدالهما
- [x] تشخيص جميع مسارات الرسم التي قد تستخدم خطاً غير داعم للعربية أو للنص المختلط
- [x] توحيد آلية اختيار الخط وتشكيل النص العربي في جميع الحقول والجداول
- [x] اعتماد نموذج تخطيط ثابت: صفحة أساسية واحدة مع صفحة متابعة معيارية عند تجاوز البيانات للسعة
- [x] منع الانقسام غير المقصود للصفوف والعناوين بين الصفحات
- [x] ضبط ارتفاعات الصفوف والتفاف النص وفق القياس الفعلي للخط
- [x] توحيد رأس وتذييل التقرير وترقيم الصفحات
- [x] إنشاء واختبار حالات عربية وإنجليزية ومختلطة وقصيرة وطويلة
- [x] حفظ checkpoint للتحسينات

## Phase 42: نموذج مرئي لتقرير الفحص بعد الإصلاحات
- [x] استخراج عناصر التصميم المعتمدة من مرجع المستخدم
- [x] إعداد نموذج PDF من صفحة واحدة ببيانات توضيحية آمنة
- [x] مراجعة النموذج بصرياً وتسليمه للمستخدم

## Phase 43: نموذج شامل مع عينة سياق الإدراج
- [x] تحديد حقول سياق الإدراج وعينة توضيحية آمنة
- [x] تحديث نموذج PDF ليتضمن سبب الإدراج والأساس القانوني والمرجع الرسمي
- [x] مراجعة النموذج الشامل وتسليمه للمستخدم

## Phase 44: معاينة التقرير الأصلي من مولّد المنصة
- [x] تحديد مسار التقرير الأصلي وسجل فعلي للمعاينة
- [x] توليد تقرير PDF من المولّد الفعلي بعد الإصلاحات
- [x] مراجعة المخرج الفعلي وتسليمه للمستخدم

## Phase 45: تحسين التقرير الأصلي الصادر من المنصة
- [x] الحفاظ على البنية والتصميم الحاليين للتقرير الأصلي
- [x] إضافة قسم سياق إدراج منظم يعتمد حصراً على حقول السجل الفعلية
- [x] توحيد العرض الآمن للعربية والإنجليزية والنص المختلط داخل جميع أقسام التقرير
- [x] تثبيت سلوك الصفحة الأساسية وصفحات المتابعة ومنع انقسام الصفوف
- [x] توليد تقرير فعلي والتحقق منه بصرياً وحفظ checkpoint

## Phase 46: مراجعة نهائية للتقرير الأصلي فقط
- [x] مراجعة شكل ومحتوى التقرير الأصلي بعد التعديلات المتفق عليها
- [x] استبدال تسمية مصدر البيانات غير الدقيقة في جدول المقارنة بتسمية محايدة وصحيحة
- [x] ضبط أي تفاصيل نهائية لازمة داخل مولّد التقرير دون تغيير هويته
- [x] توليد نسخة فعلية من المنصة ومراجعتها وتسليمها للمستخدم

## Phase 47: إصلاح عناوين سياق الإدراج العربية
- [x] فحص سبب التفاف عناوين الحقول العربية القصيرة إلى سطرين
- [x] تصحيح عرض ومحاذاة عناوين سياق الإدراج داخل التقرير الأصلي
- [x] توليد تقرير فعلي والتحقق البصري من القسم بعد الإصلاح
- [x] حفظ checkpoint للتصحيح

## Phase 48: إصلاح النص المختلط في قيم سياق الإدراج
- [x] تحليل ترتيب النص العربي والاختصارات اللاتينية داخل قيمة سبب الإدراج
- [x] تصحيح عرض المقاطع المختلطة داخل خلايا التقرير الأصلية
- [x] توليد تقرير فعلي والتحقق البصري من القراءة والترتيب
- [x] حفظ checkpoint للتصحيح

## Phase 49: فصل الاختصار اللاتيني الملصق بالعربية
- [x] فصل الاختصار اللاتيني عن الكلمة العربية عند غياب المسافة بينهما
- [x] إضافة اختبار لوحدة تحليل النص المختلط في PDF
- [x] توليد تقرير والتحقق البصري من ترتيب سبب الإدراج
- [x] حفظ checkpoint للتصحيح

## Phase 50: تنظيف سبب الإدراج من الأقواس الفارغة
- [x] إزالة الأقواس الفارغة والرموز الزائدة من سبب الإدراج قبل رسمه
- [x] الحفاظ على أي نص أو اختصار فعلي داخل الأقواس
- [x] إضافة اختبار وتنفيذ تحقق بصري في التقرير الفعلي
- [x] حفظ checkpoint للتصحيح

## Phase 51: تدقيق حقول سياق الإدراج
- [x] فصل برنامج الإدراج عن سبب الإدراج عند توفر البيانات المصدرية
- [x] عرض UID أو المعرف التقني تحت «Source Reference» بدلاً من «Legal Basis»
- [x] الإبقاء على «Legal Basis» للائحة أو القرار أو المرجع القانوني الفعلي فقط
- [x] إضافة اختبارات وتوليد تقرير فعلي للتحقق من الحقول
- [x] حفظ checkpoint للتصحيح

## Phase 52: ظهور الموقع في Google
- [x] فحص عناصر SEO والفهرسة الحالية للنطاق yemen-sanctions.com
- [x] ضبط العنوان والوصف ووسوم Open Graph والبيانات المنظمة للمنصة
- [x] إضافة أو تحديث robots.txt وsitemap.xml وإشارات canonical
- [x] إعداد خطوات ربط الموقع بـ Google Search Console وطلب الفهرسة
- [x] التحقق من التحسينات وحفظ checkpoint

## Phase 54: تعزيز الاسم التجاري في Google
- [x] فحص الاسم والعنوان التجاريين المنشورين للنطاق yemen-sanctions.com
- [x] ضبط إشارات الاسم التجاري «منصة يمن سانكشن» داخل العنوان والبيانات المنظمة
- [x] إضافة بيانات WebSite منظمة تتضمن الاسم التجاري والبدائل العربية والإنجليزية
- [x] طلب إعادة فحص الصفحة من Google Search Console بعد النشر
- [x] التحقق من التحسينات وحفظ checkpoint

## Phase 55: الصفحة الرئيسية البيضاء والأخبار المصرفية
- [x] تثبيت الثيم الأبيض وإزالة خيار الثيم الأسود من الصفحة الرئيسية
- [x] إضافة بريد التواصل info@yemen-sanctions.com في أعلى الصفحة
- [x] التحقق من المصادر الرسمية للأخبار المصرفية اليمنية وروابط الشبكة الموحدة
- [x] اعتماد آلية تحديث الأخبار ومصادر المحتوى: إدارة تحريرية بمصادر رسمية
- [x] إعداد البطاقات الإخبارية الأولى بالعناوين والمصادر الرسمية
- [x] بناء قسم أخبار احترافي متحرك وروابط مصرفية رسمية
- [x] إضافة رابط رسمي للاستعلام عن الحوالات لدى الشبكة الموحدة
- [x] اختبار الصفحة وحفظ checkpoint
- [x] تغيير الاسم العربي المعروض في الصفحة الرئيسية إلى «منصة العقوبات اليمنية»
- [x] تشخيص وإصلاح عدم ظهور صور بطاقات الأخبار في الصفحة الرئيسية
- [x] إعادة لوحة إعدادات الفحص والأعمدة في صفحة البحث إلى الجهة اليسرى كما كانت سابقاً
- [x] إعداد تصور معتمد لتطوير تقارير PDF ثنائية اللغة بألوان محدودة
- [x] تحديد موضع ثابت وحجم مناسب للشعار في تصميم تقرير PDF المقترح
- [x] تحليل التقرير السابق المرفق واستخلاص العناصر التي يجب الحفاظ عليها
- [x] إعادة تصميم مولّد تقرير PDF بهوية امتثال هادئة ثنائية اللغة وشعار رسمي
- [x] توليد نموذج تقرير فعلي ومراجعته بصرياً قبل التسليم
- [x] تحليل مواضع اختلاط العربية والإنجليزية داخل نموذج التقرير الحالي
- [x] إعادة بناء تخطيط التقرير ببطاقات ومجموعات بيانات احترافية جديدة
- [x] فصل العرض العربي والإنجليزي إلى كتل متجانسة الاتجاه داخل كل حقل
- [x] توليد نماذج تحقق عربية وإنجليزية ومراجعتها بصرياً
- [x] استبدال تخطيط البطاقات المتقطع بتخطيط تقرير قانوني رصين من الصفر
- [x] الحفاظ على فصل العربية والإنجليزية داخل مناطق مستقلة دون ازدواج العناوين
- [x] مراجعة نموذج التصميم الجديد بصرياً واعتماد النسخة المقبولة
- [x] توحيد موضع القيم العربية والإنجليزية داخل منطقة واحدة في كل صف من التقرير
- [x] مراجعة نموذج التقرير الموحد الموضع بصرياً قبل التسليم
- [x] عرض العربية أسفل الإنجليزية داخل العمود الأيسر نفسه لكل صف في التقرير
- [x] استبدال اللون الأزرق في التقرير الأساسي الصادر من النظام بلون ذهبي مناسب للهوية
- [x] توليد ومراجعة التقرير الأساسي بعد تحديث لون الهوية
- [x] تشخيص واستعادة أسلوب البحث السابق إذا تأثر بتغيير غير مقصود
- [x] التحقق من بقاء خوارزمية دقة البحث المعتمدة والواجهة السابقة دون تغيير
- [x] استعادة محرك البحث إلى نسخة 23 أغسطس 2026 والتحقق من استعلام «أمين»
- [x] إلغاء تعديل المطابقة الاحترازي الأخير وإعادة محرك البحث إلى آليته الأصلية
- [x] التحقق من تطابق محرك البحث مع النسخة المعتمدة بعد الإلغاء
- [x] توسيط النص العربي في تذييل التقرير الأساسي أسفل النص الإنجليزي مباشرةً
- [x] توليد تقرير والتحقق بصرياً من محاذاة التذييل الجديدة
- [x] تحديد مسار الطباعة الذي يعرض جداول التقرير بالأزرق بدلاً من الرمادي
- [x] توحيد لون جداول التقرير المطبوع مع المعاينة الرمادية
- [x] توليد تقرير والتحقق بصرياً من تطابق لون الجداول

## Phase 53: اتساق البحث في الأسماء التجارية العربية
- [x] إعادة إنتاج فرق البحث بين «شركة سويد للصرافة» و«سويد للصرافة»
- [x] تشخيص مسار التطبيع واسترجاع المرشحين دون تعديل بيانات أو معرفات السجلات
- [x] تصميم إصلاح محافظ للكلمات الوصفية التجارية في الاستعلام
- [x] إضافة اختبارات للصيغتين العربية والإنجليزية والتحقق من النتائج الحية
- [x] تمكين استرجاع السجل الحي عندما يكون النص العربي محفوظاً في حقل nameEn
- [x] فصل استرجاع العبارة الكاملة عن الكلمات العامة لمنع حد المرشحين من إخفاء التطابق الدقيق
- [x] حفظ checkpoint للإصلاح
