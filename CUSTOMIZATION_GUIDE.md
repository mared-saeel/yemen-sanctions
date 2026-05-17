# Smart Search App - Customization Guide

هذا الملف يحتوي على جميع التخصيصات والإعدادات التي تم تطبيقها على المشروع.

---

## 🎨 Theme & Branding

### Colors
**File:** `client/src/index.css`

```css
/* Primary Color (Golden) */
--primary: #C17F3E;
--primary-foreground: #ffffff;

/* Backgrounds */
--background: #ffffff;      /* Light theme */
--foreground: #1a1a1a;

/* Secondary */
--secondary: #f5f5f5;
--secondary-foreground: #1a1a1a;

/* Accents */
--accent: #C17F3E;
--accent-foreground: #ffffff;

/* Dark Theme */
.dark {
  --background: #1a1a1a;
  --foreground: #ffffff;
  --secondary: #2a2a2a;
  --secondary-foreground: #ffffff;
}
```

### Logo & Branding
- **Logo File:** `server/fonts/logo.png` (Al-Mustashar logo)
- **Company Name:** "المستشار للاستشارات القانونية"
- **Tagline:** "منصة فحص العقوبات الدولية"
- **Platform Name:** "Smart Search App"

### Language Support
- **Default Language:** Arabic (AR)
- **Supported Languages:** Arabic, English
- **Language Toggle:** Available in Home page and navigation
- **RTL Support:** Automatic when Arabic is selected

---

## 🔍 Search Configuration

### Normalization
**File:** `server/search-engine.ts`

```typescript
// Remove symbols and punctuation from search
export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '') // Remove non-alphanumeric
    .replace(/\s+/g, ' ')              // Normalize spaces
    .trim();
}

// Example:
// Input: "HUTHELE, Nasr Mohsen Ali"
// Output: "huthele nasr mohsen ali"
```

### Search Thresholds
```typescript
const FUSE_THRESHOLD = 0.3;           // Fuzzy match threshold (0-1)
const BATCH_MATCH_THRESHOLD = 0.9;    // 90% for MATCH status
const BATCH_POSSIBLE_THRESHOLD = 0.7; // 70-89% for POSSIBLE MATCH
```

### Match Types
- **Exact Match:** 100% (normalized query === normalized name)
- **Fuzzy Match:** 70-99% (Fuse.js)
- **Phonetic Match:** 50-69% (Levenshtein distance)
- **AI Match:** 40-49% (LLM semantic search)

---

## 📊 Batch Processing Configuration

**File:** `server/batch-handler.ts`

```typescript
// Parallel processing settings
const PARALLEL_LIMIT = 10;        // Process 10 names simultaneously
const BATCH_DELAY = 50;           // 50ms delay between batches
const FUSE_LIMIT = 1000;          // Load 1000 records into Fuse.js

// Match thresholds for batch results
const MATCH_THRESHOLD = 0.9;      // >= 90% = MATCH
const POSSIBLE_THRESHOLD = 0.7;   // 70-89% = POSSIBLE MATCH
// < 70% = NO MATCH
```

### Performance Optimizations
1. **In-Memory Search:** Uses Fuse.js instead of database queries
2. **Parallel Processing:** 10 names processed at once
3. **Reduced Dataset:** Only 1000 records loaded (vs 5000)
4. **Minimal Delay:** 50ms between batches (vs 100ms)

---

## 📄 PDF Report Styling

**File:** `server/_core/pdf-report.ts`

### Layout
- **Format:** Single page, A4 size
- **Margins:** 10mm all sides
- **Font Size:** 8-10pt (compact)
- **Colors:** Professional grayscale + golden accents

### Sections
1. **Header:** Logo (left) + "Confidential" (right)
2. **Title:** "SanctionCheck Match Details Report"
3. **Record UID:** Highlighted row
4. **Case Data:** Submitted vs Matched names
5. **Key Data:** Compact table with all details
6. **Aliases:** Alternative names table
7. **Footer:** Page number + Al-Mustashar logo

### Fonts
- **Arabic:** NotoSansArabic.ttf
- **English:** NotoSans-Regular.ttf
- **Mixed Text:** Automatic detection and switching

### Font Files Location
```
server/fonts/
├── NotoSansArabic.ttf
├── NotoSans-Regular.ttf
├── logo.png
└── (copied to dist/fonts/ during build)
```

---

## 🔐 Authentication

### Password Authentication
**File:** `server/_core/auth.ts`

```typescript
// Password hashing
const saltRounds = 10;
const passwordHash = await bcryptjs.hash(password, saltRounds);

// Password verification
const isValid = await bcryptjs.compare(password, passwordHash);
```

### Session Management
- **Token Type:** JWT
- **Expiry:** 24 hours
- **Storage:** HTTP-only cookies
- **Secure:** HTTPS only in production

### Roles
- **Admin:** Full access to all features
- **User:** Search and batch screening only

---

## 📋 Database Indexes

**File:** `drizzle/schema.ts`

```typescript
// Optimized indexes for fast queries
nameEnIdx: index("nameEn_idx").on(table.nameEn),
nameArIdx: index("nameAr_idx").on(table.nameAr),
entityTypeIdx: index("entityType_idx").on(table.entityType),
issuingBodyIdx: index("issuingBody_idx").on(table.issuingBody),
listingReasonIdx: index("listingReason_idx").on(table.listingReason),
nationalityIdx: index("nationality_idx").on(table.nationality),
listingDateIdx: index("listingDate_idx").on(table.listingDate),
```

---

## 🎯 UI Components

### Buttons
- **Primary Button:** Golden color (#C17F3E)
- **Secondary Button:** Gray background
- **Danger Button:** Red background

### Cards
- **Result Card:** White background, subtle shadow
- **Admin Card:** Compact, minimal styling
- **Modal:** Centered, overlay background

### Badges
- **Match Status:**
  - MATCH: Red background (#ef4444)
  - POSSIBLE MATCH: Amber background (#f59e0b)
  - NO MATCH: Green background (#10b981)

---

## 🌐 API Configuration

### Base URLs
```typescript
BUILT_IN_FORGE_API_URL=https://api.manus.im/forge
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im/forge
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://manus.im
```

### API Keys
- `BUILT_IN_FORGE_API_KEY` - Server-side API key
- `VITE_FRONTEND_FORGE_API_KEY` - Client-side API key

---

## 📱 Responsive Design

### Breakpoints (Tailwind CSS)
- **Mobile:** < 640px
- **Tablet:** 640px - 1024px
- **Desktop:** > 1024px

### Layout Adjustments
- **Mobile:** Single column, full width
- **Tablet:** 2 columns, adjusted padding
- **Desktop:** Multi-column, optimized spacing

---

## 🔧 Build Configuration

**File:** `package.json`

```json
{
  "scripts": {
    "dev": "NODE_ENV=development tsx watch server/_core/index.ts",
    "build": "vite build && esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist && cp -r server/fonts dist/",
    "start": "NODE_ENV=production node dist/index.js",
    "check": "tsc --noEmit",
    "format": "prettier --write .",
    "test": "vitest run",
    "db:push": "drizzle-kit generate && drizzle-kit migrate"
  }
}
```

### Build Output
```
dist/
├── index.js              # Server bundle
├── client/               # Frontend bundle
│   ├── index.html
│   ├── assets/
│   └── ...
└── fonts/                # Font files
    ├── NotoSansArabic.ttf
    ├── NotoSans-Regular.ttf
    └── logo.png
```

---

## 📊 Audit Logging

**File:** `server/db.ts`

All actions are logged:
- **Search:** Query, filters, results count, duration
- **Export:** Format (PDF/Excel/JSON), duration
- **Batch:** File name, total names, matched count
- **Admin:** User create/delete, imports

### Log Retention
- **Default:** 90 days
- **Configurable:** Via environment variable

---

## 🚀 Deployment Checklist

- [ ] Set all environment variables
- [ ] Run database migrations (`pnpm db:push`)
- [ ] Build project (`pnpm build`)
- [ ] Verify fonts in `dist/fonts/`
- [ ] Test PDF generation
- [ ] Test batch screening
- [ ] Deploy to Cloud Run
- [ ] Verify all pages load
- [ ] Test search functionality
- [ ] Test admin dashboard

---

## 📞 Customization Examples

### Change Primary Color
1. Edit `client/src/index.css`
2. Change `--primary: #C17F3E;` to your color
3. Update golden accents throughout

### Add New Search Filter
1. Add field to `SearchFilters` interface in `search-engine.ts`
2. Add filter logic in `search()` function
3. Update UI in `SearchPage.tsx`

### Modify PDF Layout
1. Edit `server/_core/pdf-report.ts`
2. Adjust section positions and sizes
3. Test PDF generation

### Change Batch Thresholds
1. Edit `server/batch-handler.ts`
2. Update `MATCH_THRESHOLD` and `POSSIBLE_THRESHOLD`
3. Rebuild and redeploy

---

## 🐛 Troubleshooting

### Issue: PDF fonts not rendering
- **Solution:** Check `dist/fonts/` contains all 4 files after build
- **Fix:** Run `pnpm build` again

### Issue: Batch screening times out
- **Solution:** Reduce `PARALLEL_LIMIT` or increase Cloud Run timeout
- **Fix:** Change `PARALLEL_LIMIT = 5` in batch-handler.ts

### Issue: Search results slow
- **Solution:** Check database indexes are created
- **Fix:** Run `pnpm db:push` to recreate indexes

### Issue: Arabic text appears reversed in PDF
- **Solution:** Use NotoSansArabic font and RTL features
- **Fix:** Already implemented in pdf-report.ts

---

**Last Updated:** May 17, 2026
**Version:** 1.0.0
