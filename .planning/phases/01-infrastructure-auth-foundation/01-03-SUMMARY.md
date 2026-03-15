---
phase: 01-infrastructure-auth-foundation
plan: 03
subsystem: web-frontend
tags: [next.js, next-intl, tailwindcss, zustand, i18n, jwt, react, typescript]

requires:
  - phase: 01-infrastructure-auth-foundation/02
    provides: Auth API endpoints (register, login, refresh, logout, me), ApiResponse envelope
provides:
  - Next.js 15 web application with zh-CN/en bilingual support
  - Locale routing via next-intl middleware (zh-CN default)
  - Responsive layout with Header, language toggle, mobile menu
  - Auth pages (login, register) with form validation
  - Token-based session management (access in memory, refresh in localStorage)
  - Zustand auth store with login, register, logout, session restore
  - API client with auto token refresh and 401 retry
affects: [02-data-models, all-frontend-plans, 01-04]

tech-stack:
  added: [next@15, next-intl@4, tailwindcss@4, zustand@5, react@19]
  patterns: [locale-routing-middleware, auth-store-pattern, api-client-with-refresh, auth-initializer-pattern]

key-files:
  created:
    - apps/web/package.json
    - apps/web/next.config.ts
    - apps/web/middleware.ts
    - apps/web/src/i18n/config.ts
    - apps/web/src/i18n/routing.ts
    - apps/web/src/i18n/request.ts
    - apps/web/messages/zh-CN.json
    - apps/web/messages/en.json
    - apps/web/src/app/[locale]/layout.tsx
    - apps/web/src/app/[locale]/page.tsx
    - apps/web/src/app/[locale]/(auth)/layout.tsx
    - apps/web/src/app/[locale]/(auth)/login/page.tsx
    - apps/web/src/app/[locale]/(auth)/register/page.tsx
    - apps/web/src/components/layout/Header.tsx
    - apps/web/src/components/layout/LanguageToggle.tsx
    - apps/web/src/components/layout/AuthInitializer.tsx
    - apps/web/src/components/auth/LoginForm.tsx
    - apps/web/src/components/auth/RegisterForm.tsx
    - apps/web/src/lib/api.ts
    - apps/web/src/lib/auth.ts
    - apps/web/src/stores/auth-store.ts
  modified:
    - pnpm-lock.yaml

key-decisions:
  - "Access token stored in memory (not localStorage) for XSS protection; refresh token in localStorage as MVP trade-off"
  - "Promise queue pattern for concurrent 401 refresh to prevent race conditions"
  - "AuthInitializer client component for session restore instead of layout-level useEffect"
  - "next-intl createNavigation for type-safe locale-aware Link, useRouter, usePathname"

patterns-established:
  - "Locale routing: next-intl middleware with [locale] segment, zh-CN default, createNavigation helpers"
  - "Auth store: Zustand store with login/register/logout/loadUser, accessed via useAuthStore hook"
  - "API client: apiFetch wrapper with auto Authorization header, 401 refresh retry, promise queue"
  - "Auth guard: (auth) route group layout redirects authenticated users away from login/register"

requirements-completed: [WAPP-01, WAPP-02, WAPP-03, AUTH-01, AUTH-02, AUTH-03]

duration: 14min
completed: 2026-03-15
---

# Phase 1 Plan 3: Next.js Web Shell Summary

**Next.js 15 bilingual web app (zh-CN/en) with next-intl routing, Tailwind CSS 4 responsive layout, Zustand auth store, and token-based session persistence via API client with auto-refresh**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-15T08:33:49Z
- **Completed:** 2026-03-15T08:48:16Z
- **Tasks:** 2 (+ 1 auto-approved checkpoint)
- **Files modified:** 22

## Accomplishments
- Next.js 15 app with zh-CN/en bilingual support via next-intl middleware
- Responsive layout with desktop nav and mobile hamburger menu
- Login and register pages with form validation and API integration
- Session persistence across browser refresh using token refresh flow

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Next.js app with i18n routing and responsive layout** - `354d502` (feat)
2. **Task 2: Implement auth pages with API integration and session persistence** - `2d0546d` (feat)

## Files Created/Modified
- `apps/web/package.json` - Next.js 15 app with next-intl, zustand, tailwindcss dependencies
- `apps/web/next.config.ts` - next-intl plugin with API proxy rewrites
- `apps/web/middleware.ts` - Locale detection and URL rewriting
- `apps/web/src/i18n/config.ts` - Locale definitions (zh-CN default, en)
- `apps/web/src/i18n/routing.ts` - Locale routing with createNavigation
- `apps/web/src/i18n/request.ts` - Server-side message loading
- `apps/web/messages/zh-CN.json` - Chinese translations (common, auth, home)
- `apps/web/messages/en.json` - English translations
- `apps/web/src/app/[locale]/layout.tsx` - Root layout with NextIntlClientProvider, Header, AuthInitializer
- `apps/web/src/app/[locale]/page.tsx` - Home page with welcome message
- `apps/web/src/app/[locale]/(auth)/layout.tsx` - Auth layout with redirect-if-authenticated guard
- `apps/web/src/app/[locale]/(auth)/login/page.tsx` - Login page
- `apps/web/src/app/[locale]/(auth)/register/page.tsx` - Register page
- `apps/web/src/components/layout/Header.tsx` - Responsive header with auth state, language toggle, mobile menu
- `apps/web/src/components/layout/LanguageToggle.tsx` - zh-CN/en locale switcher
- `apps/web/src/components/layout/AuthInitializer.tsx` - Session restore on page load
- `apps/web/src/components/auth/LoginForm.tsx` - Login form with validation and error display
- `apps/web/src/components/auth/RegisterForm.tsx` - Register form with password length validation
- `apps/web/src/lib/api.ts` - API client with auto token refresh and promise queue
- `apps/web/src/lib/auth.ts` - Token management (access in memory, refresh in localStorage)
- `apps/web/src/stores/auth-store.ts` - Zustand auth store with full CRUD + session restore

## Decisions Made
- Access token stored in memory only (not localStorage) for XSS protection; refresh token in localStorage as acceptable MVP trade-off (httpOnly cookie requires backend cookie support)
- Promise queue pattern for concurrent 401 refresh prevents multiple simultaneous refresh calls
- AuthInitializer as separate client component keeps the root layout as a server component
- Used next-intl createNavigation for type-safe locale-aware navigation helpers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created auth store stub for Task 1 build**
- **Found during:** Task 1 (Header component)
- **Issue:** Header.tsx imports useAuthStore which was planned for Task 2, causing build failure
- **Fix:** Created minimal auth store stub with interface and no-op methods
- **Files modified:** apps/web/src/stores/auth-store.ts
- **Verification:** Build succeeds with stub store
- **Committed in:** 354d502 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Created AuthInitializer component**
- **Found during:** Task 2 (Layout session restore)
- **Issue:** Plan specified calling loadUser in layout, but layout is a server component; needs client component wrapper
- **Fix:** Created AuthInitializer client component that calls loadUser in useEffect
- **Files modified:** apps/web/src/components/layout/AuthInitializer.tsx, apps/web/src/app/[locale]/layout.tsx
- **Verification:** Build succeeds, AuthInitializer rendered in layout
- **Committed in:** 2d0546d (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both auto-fixes necessary for correct build and session persistence. No scope creep.

## Issues Encountered
None

## User Setup Required
None - frontend runs with `cd apps/web && pnpm dev`. Backend must be running at localhost:8000 for auth API calls.

## Next Phase Readiness
- Web shell complete with i18n, auth, and responsive layout
- Auth store and API client ready for all future frontend features
- createNavigation helpers (Link, useRouter, usePathname) available for locale-aware routing
- Auth guard pattern established for protected routes

## Self-Check: PASSED

All 21 created files verified present. Both task commits (354d502, 2d0546d) verified in git log.

---
*Phase: 01-infrastructure-auth-foundation*
*Completed: 2026-03-15*
