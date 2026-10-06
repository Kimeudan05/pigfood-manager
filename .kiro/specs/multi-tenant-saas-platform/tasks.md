# Implementation Plan: StockSight — Multi-Tenant SaaS Platform

## Overview

This plan transforms the existing single-tenant Takataka Pigfood Manager into the
multi-tenant StockSight platform. Tasks are ordered so the app remains deployable
after each group: foundational types and pure-function utilities first, then data
and service layers, then context and routing, then UI pages, then the migration
script, and finally cleanup of the legacy single-tenant code.

Property-based tests (fast-check + Vitest) are placed as optional sub-tasks directly
alongside the code they validate so bugs are caught at the earliest possible moment.

---

## Tasks

- [x] 1. Install fast-check and extend TypeScript / Vitest config
  - [x] 1.1 Add fast-check as a dev dependency and verify Vitest can import it
    - Run `npm install --save-dev fast-check` in the workspace root
    - Create `src/lib/__tests__/pbt-smoke.test.ts` with one trivial `fc.assert` to
      confirm the setup works, then delete it after the check passes
    - _Requirements: testing infrastructure for Properties 1–15_

---

- [x] 2. Extend core TypeScript types (`src/types/index.ts`)
  - [x] 2.1 Add multi-tenant type definitions
    - Add `TenantDoc`, `TenantSubscription`, `TenantMember`, `Product`,
      `ProductFormData`, `SaleLine`, `Invitation` interfaces as defined in
      the design's "Updated TypeScript Types" section
    - Update the `Sale` interface: remove the embedded `SaleItems`/`SaleTotals`
      fields, add `saleNumber`, `customerName`, `grandTotal`, and
      `lines?: SaleLine[]`
    - Add `TenantContextType` interface skeleton (imported by the context file
      created in Task 5)
    - Retain existing `SaleItems`, `SaleTotals`, `AppUser`, `Subscription`
      interfaces unchanged — they are still used by the migration script and
      the legacy Firestore service during the transition period
    - _Requirements: 3.1, 4.1, 5.6, 6.1, 8.1_

---

- [x] 3. Pure-function validators and utilities (`src/lib/validators.ts`, `src/utils/pricing.ts`)
  - [x] 3.1 Implement `validateSlug(slug: string): boolean`
    - Accept only lowercase letters, digits, hyphens; 3–30 chars; no leading/
      trailing hyphen — exactly the rule in Req 1.6 and Property 1
    - Export from `src/lib/validators.ts` (new file)
    - _Requirements: 1.6, 10.1_

  - [ ]* 3.2 Write property-based test for `validateSlug` (Property 1)
    - **Property 1: Tenant slug validation is exact**
    - **Validates: Requirements 1.6, 10.1**
    - Use `fc.stringMatching(/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/)` for valid
      slugs and `fc.string()` filtered/mutated for invalid ones
    - Tag: `// Feature: multi-tenant-saas-platform, Property 1: Tenant slug validation is exact`
    - File: `src/lib/__tests__/validators.test.ts`

  - [x] 3.3 Implement `validatePassword(password: string): boolean`
    - At least 8 chars; ≥1 uppercase, ≥1 lowercase, ≥1 digit, ≥1 special char
    - Export from `src/lib/validators.ts`
    - _Requirements: 1.8_

  - [ ]* 3.4 Write property-based test for `validatePassword` (Property 2)
    - **Property 2: Password complexity validation is exact**
    - **Validates: Requirements 1.8**
    - Compose arbitraries that guarantee each required character class; also
      generate strings deliberately missing one class to test rejection
    - Tag: `// Feature: multi-tenant-saas-platform, Property 2: Password complexity validation is exact`
    - File: `src/lib/__tests__/validators.test.ts`

  - [x] 3.5 Implement `validateProduct(product: unknown): boolean`
    - `name` 1–100 non-whitespace-only chars; `unit` 1–50 chars;
      `price` in [0.01, 999_999_999.99]; `isActive` boolean
    - Export from `src/lib/validators.ts`
    - _Requirements: 4.1_

  - [ ]* 3.6 Write property-based test for `validateProduct` (Property 7)
    - **Property 7: Product validation accepts exactly the valid input space**
    - **Validates: Requirements 4.1**
    - Use `fc.record(...)` with valid/invalid field combos; verify that
      violating any single field causes rejection
    - Tag: `// Feature: multi-tenant-saas-platform, Property 7: Product validation accepts exactly the valid input space`
    - File: `src/lib/__tests__/validators.test.ts`

  - [x] 3.7 Implement `validateLogoFile(mimeType: string, sizeBytes: number): boolean`
    - Accept `image/jpeg`, `image/png`, `image/webp` and size ≤ 2 097 152 bytes
    - Export from `src/lib/validators.ts`
    - _Requirements: 7.3, 7.4_

  - [ ]* 3.8 Write property-based test for `validateLogoFile` (Property 12)
    - **Property 12: Logo upload validator rejects invalid files**
    - **Validates: Requirements 7.3, 7.4**
    - Use `fc.string()` for MIME type and `fc.integer()` for size; test the
      exact 2 MB boundary in both directions
    - Tag: `// Feature: multi-tenant-saas-platform, Property 12: Logo upload validator rejects invalid files`
    - File: `src/lib/__tests__/validators.test.ts`

  - [x] 3.9 Implement `generateSaleNumber(tenantSlug: string): string`
    - Pattern: `{TENANT_PREFIX}-{YYMMDD}-{4-digit-random}` where
      `TENANT_PREFIX` is the first 4 chars of slug uppercased (or full slug
      padded to 4 chars if shorter)
    - Replace the existing `generateSaleNumber()` in `src/utils/pricing.ts`
      with this tenant-aware version; keep the old function temporarily as
      `generateSaleNumberLegacy()` so the legacy `addSale` still compiles
    - _Requirements: 5.10_

  - [ ]* 3.10 Write property-based test for `generateSaleNumber` (Property 11)
    - **Property 11: Sale number format matches tenant prefix pattern**
    - **Validates: Requirements 5.10**
    - Use `fc.string({ minLength: 3, maxLength: 30 })` as tenant slug input;
      assert result matches `/^[A-Z]{4}-\d{6}-\d{4}$/`
    - Tag: `// Feature: multi-tenant-saas-platform, Property 11: Sale number format matches tenant prefix pattern`
    - File: `src/lib/__tests__/pricing.test.ts`

  - [x] 3.11 Implement `calculateGrandTotal(lines: Array<{quantity: number; unitPrice: number}>): number`
    - `Math.round(sum(qty_i × price_i) × 100) / 100`
    - Export from `src/utils/pricing.ts`
    - _Requirements: 5.9_

  - [ ]* 3.12 Write property-based test for `calculateGrandTotal` (Property 10)
    - **Property 10: Grand total equals sum of line totals**
    - **Validates: Requirements 5.9**
    - Use `fc.array(fc.record({ quantity: fc.integer({min:1,max:9999}), unitPrice: fc.float({min:0.01,max:999999999.99}) }), {minLength:1,maxLength:50})`
    - Tag: `// Feature: multi-tenant-saas-platform, Property 10: Grand total equals sum of line totals`
    - File: `src/lib/__tests__/pricing.test.ts`

  - [x] 3.13 Implement `computeNetWeight(weightIn: number, weightOut: number): number`
    - Exact subtraction, no rounding; both values must be in (0, 99 999]
      with `weightIn > weightOut`, else throw
    - Export from `src/lib/validators.ts`
    - _Requirements: 11.4_

  - [ ]* 3.14 Write property-based test for `computeNetWeight` (Property 15)
    - **Property 15: Net weight arithmetic invariant**
    - **Validates: Requirements 11.4**
    - Use `fc.tuple(fc.float({min:0.01,max:99999}), fc.float({min:0.01,max:99999})).filter(([a,b]) => a > b)`
    - Tag: `// Feature: multi-tenant-saas-platform, Property 15: Net weight arithmetic invariant`
    - File: `src/lib/__tests__/validators.test.ts`

  - [x] 3.15 Update `canDo` and `canAccessPlan` for tenant-scoped context
    - Refactor `canAccessPlan` in `src/lib/billing.ts` to accept
      `TenantSubscription | null` instead of `AppUser` — the subscription
      now lives on the tenant, not the user
    - Keep the existing `canDo(appUser, perm)` signature intact; it reads
      `permissions` from `TenantMember` which has the same shape
    - _Requirements: 6.6, 8.4, 8.5, 8.6_

  - [ ]* 3.16 Write property-based test for `canAccessPlan` (Property 13)
    - **Property 13: Plan tier access follows strict rank ordering**
    - **Validates: Requirements 8.4, 8.5, 8.6**
    - Use `fc.constantFrom('basic','standard','pro')` for tier and
      `fc.constantFrom('active','trialing','past_due','canceled','none')` for status
    - Tag: `// Feature: multi-tenant-saas-platform, Property 13: Plan tier access follows strict rank ordering`
    - File: `src/lib/__tests__/billing.test.ts`

- [x] 4. Checkpoint — run all tests
  - Run `npm test` (`vitest run`). All existing RBAC tests plus the new
    unit/property tests added in Tasks 1–3 must pass before continuing.

---

- [x] 5. TenantContext and `useTenantFirestore` hook
  - [x] 5.1 Create `src/contexts/TenantContext.tsx`
    - Implement `TenantProvider` that reads `tenant_slug` from `useParams()`
    - Resolution flow: query `tenants` where `slug == tenant_slug` →
      load membership doc `tenants/{tenantId}/users/{uid}` → load tenant doc
    - Attach a real-time `onSnapshot` on the membership doc (for suspension
      propagation within 5 s per Req 6.7)
    - Redirect to `/workspace-picker` when not a member; to `/suspended` when
      status is `suspended`; to `/pending-approval` when `pending`
    - Expose `tenantRef()` and `collectionRef(name)` helpers
    - _Requirements: 2.6, 2.7, 3.1, 6.7_

  - [ ]* 5.2 Write unit tests for TenantContext path helpers (Property 5)
    - **Property 5: Firestore path is always tenant-scoped**
    - **Validates: Requirements 3.1**
    - Test `collectionRef(name)` returns path matching
      `tenants/{tenantId}/{name}` for every collection name; never a root path
    - Tag: `// Feature: multi-tenant-saas-platform, Property 5: Firestore path is always tenant-scoped`
    - File: `src/contexts/__tests__/TenantContext.test.ts`

  - [x] 5.3 Create `src/hooks/useTenantFirestore.ts`
    - Pull `tenantId` from `TenantContext` and return pre-bound versions of
      all service functions (customers, sales, products, receivals, etc.)
      so callsites do not pass `tenantId` manually
    - _Requirements: 3.1, 3.6_

---

- [ ] 6. Tenant-scoped Firestore service layer (`src/lib/firestore.ts` + new service files)
  - [-] 6.1 Refactor `src/lib/firestore.ts` — add `tenantId` parameter to all functions
    - Change every path from `collection(db, "sales")` to
      `collection(db, "tenants", tenantId, "sales")` (and likewise for
      customers, receivals, weeklyNotes, users, user_sessions)
    - Add overloads / new exported functions accepting `tenantId`; keep old
      zero-`tenantId` signatures as `@deprecated` wrappers calling the legacy
      root path — this allows the existing pages to keep compiling until they
      are migrated to `useTenantFirestore`
    - _Requirements: 3.1, 3.6_

  - [-] 6.2 Implement `src/lib/products.ts` — product catalog service
    - `getActiveProducts(tenantId)`, `getAllProducts(tenantId)`,
      `addProduct(tenantId, data, uid)`, `updateProduct(tenantId, id, data)`,
      `setProductActive(tenantId, id, isActive)`,
      `checkProductNameUnique(tenantId, name, excludeId?)` (case-insensitive)
    - Enforce uniqueness check in `addProduct` and `updateProduct`; throw a
      typed error `{ code: 'DUPLICATE_NAME' }` on violation
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 6.3 Write unit test for case-insensitive duplicate detection (Property 8)
    - **Property 8: Product name uniqueness is case-insensitive within a tenant**
    - **Validates: Requirements 4.2**
    - Use `fc.string({ minLength: 1, maxLength: 100 })` with `.toLowerCase()`
      / `.toUpperCase()` / mixed-case mutations; verify that the normalisation
      function `normalizeProductName` rejects any same-normalised pair
    - Tag: `// Feature: multi-tenant-saas-platform, Property 8: Product name uniqueness is case-insensitive within a tenant`
    - File: `src/lib/__tests__/products.test.ts`

  - [~] 6.4 Update sale service in `firestore.ts` for new two-level data model
    - `addSale(tenantId, data, uid)`: writes sale header to
      `tenants/{tenantId}/sales/{saleId}` and one `saleLines` sub-doc per line;
      uses `calculateGrandTotal` from Task 3.11; generates sale number with
      `generateSaleNumber(tenantSlug)` from Task 3.9; retries on collision (up to 5)
    - `getSale(tenantId, id)`: loads header + sub-collection `saleLines` and
      returns combined `Sale` with `lines` populated
    - `updateSale(tenantId, id, data)`: updates header and rewrites saleLines
    - `deleteSale(tenantId, id)`: deletes saleLines sub-collection then header
    - _Requirements: 5.6, 5.7, 5.9, 5.10_

  - [-] 6.5 Implement `src/lib/tenantRegistration.ts`
    - `registerTenant(payload)`: check slug uniqueness → `createUserWithEmailAndPassword`
      → Firestore batch (tenant doc + membership doc) → on batch failure, delete
      Auth account and throw
    - `checkSlugAvailable(slug: string): Promise<boolean>`
    - Use `validateSlug`, `validatePassword` from Task 3 before any Firebase calls
    - _Requirements: 1.2, 1.3, 1.4, 1.6, 1.7, 1.8, 1.9_

  - [-] 6.6 Implement `src/lib/invitations.ts`
    - `createInvitation(tenantId, email, role, inviterUid)`: writes to
      `tenants/{tenantId}/invitations/{inviteId}` with 48 h expiry; if an
      unexpired invite for that email already exists, overwrite it
    - `getInvitation(inviteId)`: reads global `invitations` collection
    - `acceptInvitation(inviteId, uid)`: adds membership doc, deletes invite;
      checks plan member limit before accepting
    - _Requirements: 6.2, 6.3, 6.4, 6.5_

  - [ ] 6.7 Update `src/lib/billing.ts` — tenant-level subscription
    - Add `getTenantByStripeCustomerId(stripeCustomerId)`: queries `tenants`
      collection where `subscription.stripeCustomerId == stripeCustomerId`
    - Add `updateTenantSubscription(tenantId, subscription)`: writes to
      `tenants/{tenantId}` using merge
    - Remove the user-level `updateUserSubscription` call path (now handled
      at tenant level)
    - _Requirements: 8.1, 8.2, 8.3_

- [~] 7. Checkpoint — run all tests
  - Run `npm test`. All unit and property tests must pass. The app should
    still build (`npm run build`) with no TypeScript errors at this point.

---

- [ ] 8. Next.js routing restructure
  - [~] 8.1 Create `src/app/[tenant_slug]/layout.tsx` — TenantContext provider
    - This layout wraps all tenant-scoped pages; it renders `TenantProvider`
      (from Task 5.1) and the existing sidebar/navbar shell
    - Move the auth-guard and status-redirect logic from the old
      `src/app/(protected)/layout.tsx` into this layout, replacing the
      `AuthContext`-only guard with the `TenantContext` guard
    - Keep `src/app/(protected)/layout.tsx` in place — it is removed in Task 14
    - _Requirements: 2.7, 10.1, 10.4_

  - [~] 8.2 Create `src/middleware.ts`
    - Handle three concerns:
      1. Redirect unauthenticated users away from `/{tenant_slug}/...` to `/login`
      2. Redirect authenticated users from `/` to `/workspace-picker`
      3. Reject `tenant_slug` values that don't match the format in Req 10.1
         (return 404)
    - Read the Firebase Auth session cookie (`__session`) for server-side auth
      check without a Firestore round-trip
    - Matcher: `/((?!_next/static|_next/image|favicon.ico|api).*)`
    - _Requirements: 10.2, 10.3, 10.6_

  - [~] 8.3 Update `next.config.ts` for new routing
    - Add `images.remotePatterns` for Firebase Storage (logo URLs)
    - Ensure the `[tenant_slug]` dynamic segment does not collide with
      existing top-level routes (`login`, `register`, `api`, etc.) by
      documenting reserved slugs in a `src/lib/reservedSlugs.ts` constant
      and enforcing them in `registerTenant`
    - _Requirements: 10.1, 10.7_

---

- [ ] 9. Public pages — landing, register, workspace-picker, invite acceptance
  - [~] 9.1 Create `src/app/page.tsx` — public landing page (replace current redirect)
    - Marketing page describing StockSight features and pricing tiers
    - "Create Free Workspace" CTA linking to `/register`
    - Authenticated users redirected to `/workspace-picker` (handled by middleware)
    - _Requirements: 1.1, 10.2_

  - [~] 9.2 Create `src/app/register/page.tsx` — tenant registration form
    - Fields: business name, tenant slug (with live availability check using
      `checkSlugAvailable`), owner full name, email, password (with
      complexity indicator)
    - On submit: call `registerTenant`; handle all error cases from Req 1.3,
      1.7, 1.9 with inline messages (do not clear other fields on error)
    - On success: redirect to `/{tenant_slug}/dashboard`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

  - [~] 9.3 Create `src/app/workspace-picker/page.tsx`
    - Query `collectionGroup("users")` filtered by `uid == auth.uid` to find
      all tenants the user belongs to
    - Render tenant cards (business name + slug); clicking navigates to
      `/{tenant_slug}/dashboard`
    - Empty state (no tenants): show "Create a workspace" + "Accept an invitation" CTAs
    - Handle tenant lookup failure per Req 2.2
    - _Requirements: 2.3, 2.4, 2.5_

  - [~] 9.4 Create `src/app/invite/[inviteId]/page.tsx` — invitation acceptance
    - Load invitation via `getInvitation(inviteId)` — show expired message if
      past `expiresAt`
    - If user is already signed in, call `acceptInvitation` directly
    - If not signed in, show sign-in / register form then call `acceptInvitation`
    - On success: redirect to `/{tenantSlug}/dashboard`
    - Handle plan member limit error with upgrade prompt (Req 6.3)
    - _Requirements: 6.3, 6.4, 6.5_

---

- [ ] 10. Migrate tenant-scoped pages under `[tenant_slug]/(protected)/`
  - [~] 10.1 Scaffold `src/app/[tenant_slug]/(protected)/` directory structure
    - Create the directory tree defined in the design's "After" routing table:
      `dashboard/`, `sales/`, `customers/`, `receivals/`, `reports/`, `settings/`,
      `admin/`, `profile/` — each with a `page.tsx` that re-exports (or
      temporarily renders a placeholder) the existing page component
    - This step makes the new URLs reachable without yet breaking the old ones
    - _Requirements: 10.1, 10.4_

  - [~] 10.2 Re-wire Dashboard page to `useTenantFirestore`
    - Replace direct `AuthContext` + root-collection Firestore calls in
      `src/app/(protected)/dashboard/page.tsx` with `useTenant()` +
      `useTenantFirestore()` calls; copy the component to the new path
    - _Requirements: 3.1, 8.4_

  - [~] 10.3 Re-wire Customers pages to `useTenantFirestore`
    - Re-wire `customers/page.tsx` and `customers/[id]/page.tsx`
    - _Requirements: 3.1, 6.6_

  - [~] 10.4 Re-wire Sales pages to new sale service and dynamic product catalog
    - Re-wire `sales/page.tsx`, `sales/new/page.tsx`, `sales/[id]/edit/page.tsx`
    - Replace the hardcoded `PRODUCTS` array in the sale form with
      `getActiveProducts(tenantId)` from `src/lib/products.ts`
    - Update the sale form to use the new line-item builder (line rows with
      product picker, quantity, editable unit price, computed line total)
    - Replace `calculateTotals` with `calculateGrandTotal` from Task 3.11
    - _Requirements: 4.3, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

  - [~] 10.5 Re-wire Receivals pages to `useTenantFirestore` with plan gate
    - Re-wire `receivals/page.tsx`, `receivals/new/page.tsx`,
      `receivals/[date]/edit/page.tsx`
    - Wrap receival routes with a plan gate: redirect/show upgrade prompt on
      `basic` plan; render normally on `standard` and `pro`
    - Use `computeNetWeight` from Task 3.13 in the save handler
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [~] 10.6 Re-wire Reports pages to `useTenantFirestore` with plan gates
    - Re-wire `reports/page.tsx`, `reports/advanced/page.tsx`,
      `reports/customer-spending/page.tsx`
    - Advanced report section: gate behind `pro` plan; show upgrade prompt on
      `basic`/`standard`
    - All queries must read from `tenants/{tenantId}/sales` and
      `tenants/{tenantId}/receivals`
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [~] 10.7 Create Settings pages
    - `settings/page.tsx` — tenant profile: business name, currency, timezone
    - `settings/catalog/page.tsx` — product catalog CRUD: list active products,
      add/edit/toggle-active; use `src/lib/products.ts`; enforce name uniqueness
      with inline error "A product with this name already exists."
    - `settings/members/page.tsx` — user management: list members with
      role/status; invite by email; approve/reject/suspend; show member-limit
      badge; edit granular permission overrides
    - `settings/billing/page.tsx` — owner-only billing; redirect non-owners
      with message (Req 8.7); show current plan, subscription status, upgrade
      CTAs; wire to existing checkout and portal API routes
    - _Requirements: 4.3, 4.5, 6.1, 6.2, 6.6, 6.8, 6.9, 7.1, 7.2, 7.5, 7.6, 7.7, 8.4, 8.5, 8.7, 8.8_

  - [~] 10.8 Create `settings/page.tsx` logo upload and branding
    - File picker restricted to JPEG/PNG/WebP ≤ 2 MB (validate with
      `validateLogoFile` from Task 3.7 before upload)
    - Upload to Firebase Storage at `tenants/{tenantId}/logo`; persist download
      URL to tenant doc on success; leave existing `logoURL` unchanged on
      validation failure
    - Reflect updated `businessName` and logo in sidebar and receipts within
      the same render after save
    - _Requirements: 7.2, 7.3, 7.4, 7.6, 7.7_

  - [~] 10.9 Re-wire Admin page to tenant-scoped user management
    - Move `src/app/(protected)/admin/page.tsx` content to
      `[tenant_slug]/(protected)/admin/page.tsx`
    - Replace root `users/` collection reads with `tenants/{tenantId}/users/`
    - _Requirements: 6.1, 6.6, 6.7, 6.8, 6.9_

  - [~] 10.10 Update Sidebar navigation for new URL structure
    - All sidebar links must now be prefixed with `/{tenant_slug}/`
    - Add conditional rendering for plan-gated items (Receivals hidden on basic;
      Advanced Reports hidden on basic/standard)
    - Show business name / logo in sidebar header using `TenantContext`
    - _Requirements: 7.2, 7.5, 7.6, 7.7, 8.4, 11.1, 12.3_

- [~] 11. Checkpoint — run all tests and verify build
  - Run `npm test` and `npm run build`. All tests pass, TypeScript compiles
    cleanly. Manually verify that both the old `/(protected)/dashboard` URL and
    the new `/takataka/dashboard` URL (after seeding a dev tenant) render
    correctly before proceeding.

---

- [ ] 12. Update API routes for tenant-level billing and new invite endpoint
  - [~] 12.1 Update `/api/billing/webhook/route.ts`
    - Replace `getUserByStripeCustomerId` with `getTenantByStripeCustomerId`
      (from Task 6.7)
    - Write subscription updates to `tenants/{tenantId}` via
      `updateTenantSubscription`
    - Return HTTP 200 (not retry) when tenant not found by customer ID (Req 8.x
      error table)
    - _Requirements: 8.2, 8.3_

  - [~] 12.2 Update `/api/billing/create-checkout/route.ts`
    - Accept `tenantId` in request body; create Stripe customer keyed to tenant,
      not user; store `stripeCustomerId` on `tenants/{tenantId}/subscription`
    - _Requirements: 8.1_

  - [~] 12.3 Create `/api/invite/accept/route.ts`
    - POST handler: accepts `{ inviteId, uid }`; verifies invite is unexpired;
      checks plan member limit; writes membership doc and deletes invite doc
      using Firebase Admin SDK (bypasses client-side security rules)
    - Return HTTP 409 on plan limit reached; HTTP 410 on expired invite
    - _Requirements: 6.3, 6.5_

---

- [ ] 13. Firestore Security Rules (`firestore.rules`)
  - [~] 13.1 Write the full tenant-scoped security rules
    - Implement all rules exactly as specified in the design's "Firestore
      Security Rules" section: `isTenantMember`, `isOwnerOrAdmin`, `hasRole`
      helpers; per-collection read/write rules for products, customers, sales,
      saleLines, receivals, weeklyNotes, members, invitations
    - Deny-by-default catch-all at the bottom
    - Retain `users/{uid}` root rule (global profile reads/writes)
    - _Requirements: 3.2, 3.3, 3.4, 3.6_

  - [ ]* 13.2 Write integration tests for security rules using Firestore Emulator
    - Test that non-members receive `PERMISSION_DENIED` on `tenants/{id}/sales`
    - Test that suspended users cannot write to any tenant sub-collection
    - Test that an owner can read/write their own tenant but not another's data
    - File: `src/lib/__tests__/firestore-rules.test.ts`
    - Requires `@firebase/rules-unit-testing` and a running Firestore Emulator
    - _Requirements: 3.2, 3.3, 3.4_

---

- [ ] 14. Migration script (`scripts/migrate.ts`)
  - [~] 14.1 Create `scripts/migrate.ts` using Firebase Admin SDK
    - Initialise Admin SDK with service account from env var
      `GOOGLE_APPLICATION_CREDENTIALS`
    - Step 1: Create tenant doc at `tenants/takataka` with
      `{ businessName: "Takataka Pigfood", slug: "takataka", currency: "KES",
         timezone: "Africa/Nairobi", createdAt: now }` — skip if already exists
    - Step 2: Seed the product catalog at `tenants/takataka/products` from the
      `PRODUCTS` array in `src/utils/pricing.ts`
    - Steps 3–7: Copy `customers`, `sales`, `receivals`, `weeklyNotes`, `users`
      from root collections to `tenants/takataka/{collection}`, preserving all
      document IDs and field values; skip existing destination docs (idempotent)
    - Step 8: Copy `user_sessions` (preserve doc IDs, add `tenantId` field)
    - Log every skipped and every failed doc with `{collection, docId, reason}`
    - Print completion summary (migrated / skipped / errors per collection)
    - Exit with code 1 if any errors occurred, 0 otherwise
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10_

  - [ ]* 14.2 Write property-based test for migration document-count invariant (Property 14)
    - **Property 14: Migration preserves document counts**
    - **Validates: Requirements 9.7, 9.8**
    - Unit-test the migration's idempotency logic with mocked Firestore
      batches: for any N-document source array, assert the migrator writes
      exactly N docs on first run and 0 docs on second run with same IDs
    - Tag: `// Feature: multi-tenant-saas-platform, Property 14: Migration preserves document counts`
    - File: `scripts/__tests__/migrate.test.ts`

- [~] 15. Checkpoint — run all tests and confirm migration script runs cleanly
  - Run `npm test`. Then run the migration script against the Firestore Emulator
    (`ts-node scripts/migrate.ts`) and verify document counts match source
    collections. No TypeScript compile errors.

---

- [ ] 16. Legacy code removal and final wiring
  - [~] 16.1 Remove deprecated legacy Firestore function wrappers
    - Delete the `@deprecated` root-path wrapper functions added in Task 6.1
      once all callsites have been migrated to `useTenantFirestore`
    - Remove `generateSaleNumberLegacy` from `src/utils/pricing.ts`
    - _Requirements: 3.1_

  - [~] 16.2 Remove `src/app/(protected)/` route group
    - Delete the old `(protected)` route group and its layout only after all
      page content has been migrated to `[tenant_slug]/(protected)/`
    - Verify no remaining imports reference the old paths
    - _Requirements: 10.1_

  - [~] 16.3 Update `AuthContext` to slim-down post-migration
    - Remove tenant-specific routing logic from `AuthContext` (tenant routing
      is now handled by `TenantContext` and middleware)
    - Retain: Firebase Auth state, `appUser` from global `users/{uid}`,
      sign-in methods, profile update, change password
    - _Requirements: 2.1, 2.8_

  - [~] 16.4 Add `src/lib/reservedSlugs.ts` and enforce in registration
    - List reserved slugs that must not be used as tenant slugs:
      `['login', 'register', 'workspace-picker', 'invite', 'api', 'admin',
        'billing', 'magic-link', 'forgot-password', 'pending-approval',
        'suspended']`
    - Call `isReservedSlug(slug)` inside `registerTenant` and `checkSlugAvailable`
    - _Requirements: 10.1_

- [~] 17. Final checkpoint — full test suite and production build
  - Run `npm test` (all unit, property, integration tests pass)
  - Run `npm run build` (zero TypeScript errors, zero ESLint errors)
  - Verify Vercel preview deployment serves `/` as the marketing landing page,
    `/login` as the sign-in page, and `/takataka/dashboard` as the migrated
    workspace dashboard after running the migration script against the production
    Firestore instance

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP delivery
- Each task references specific requirement numbers for full traceability
- Checkpoints at Tasks 4, 7, 11, 15, and 17 ensure the app remains deployable and tested throughout the transformation
- Property-based tests (Properties 1, 2, 7, 8, 10, 11, 12, 13, 14, 15) run a minimum of 100 iterations per fast-check default
- Properties 3, 4, 5, 6, and 9 involve Firebase Auth or Firestore transactions and are covered by integration tests (Task 13.2 and Task 14.2) rather than pure property tests
- The migration script (Task 14) is idempotent — safe to re-run; existing destination docs are always skipped
- The old `/(protected)/` route group remains functional until Task 16.2, preserving the existing Takataka workflow during the transition
- `fast-check` must be installed before any property test files are created (Task 1.1)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["3.1", "3.3", "3.5", "3.7", "3.9", "3.11", "3.13", "3.15"] },
    { "id": 3, "tasks": ["3.2", "3.4", "3.6", "3.8", "3.10", "3.12", "3.14", "3.16"] },
    { "id": 4, "tasks": ["5.1", "5.3", "6.5"] },
    { "id": 5, "tasks": ["5.2", "6.1", "6.2", "6.6", "6.7"] },
    { "id": 6, "tasks": ["6.3", "6.4", "8.1", "8.2", "8.3"] },
    { "id": 7, "tasks": ["9.1", "9.2", "9.3", "9.4", "10.1"] },
    { "id": 8, "tasks": ["10.2", "10.3", "10.4", "10.5", "10.6", "10.7", "10.8", "10.9", "12.1", "12.2", "12.3", "13.1"] },
    { "id": 9, "tasks": ["10.10", "13.2", "14.1"] },
    { "id": 10, "tasks": ["14.2", "16.1", "16.2", "16.3", "16.4"] }
  ]
}
```
