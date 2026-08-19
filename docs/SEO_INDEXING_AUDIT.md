# SEO Indexing Audit — 18 Aug 2026

## Observed public-site state

- The homepage at `https://yemen-sanctions.com` is reachable and contains Arabic content relevant to sanctions screening and compliance.
- The document title currently resolves to **Smart Search App**, which does not identify the brand phrase «منصة يمن سانكشن» for search results.
- `https://yemen-sanctions.com/robots.txt` currently returns the application 404 page rather than a valid robots directive file.
- `https://yemen-sanctions.com/sitemap.xml` currently returns the application 404 page rather than a valid XML sitemap.

## Required actions

1. Publish a valid `robots.txt` that permits crawling and references the sitemap.
2. Publish a valid `sitemap.xml` containing the canonical homepage URL.
3. Add Arabic-first title, description, canonical URL, Open Graph metadata, and organization/schema data.
4. Verify the domain in Google Search Console, submit the sitemap, and request indexing of the homepage.

## Local verification after implementation

- The preview now serves a valid `robots.txt` with `Allow: /`, an API-route exclusion, and a root sitemap reference.
- The preview now serves a valid `sitemap.xml` with the canonical URL `https://yemen-sanctions.com/`.
