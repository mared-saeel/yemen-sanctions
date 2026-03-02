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
