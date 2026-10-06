# Requirements Document

## Introduction

Transform the existing single-tenant "Takataka Pigfood Manager" into **StockSight** — a
multi-tenant SaaS platform where any business (a shop, a farm, a wholesale depot) can
sign up, define their own product catalog with custom prices, and manage sales, customers,
and inventory in complete data isolation from every other tenant.

The existing Takataka Pigfood data is preserved by migrating it into a first-class tenant
named "Takataka Pigfood" during the migration phase. All existing workflows (sales,
receivals, reports, RBAC, billing) continue to work inside that tenant without data loss.

Suggested domain: **stocksight.app** (or a Vercel alias such as `stocksight.vercel.app`
while the custom domain is being configured).

---

## Glossary

- **Platform**: The StockSight SaaS application as a whole, hosted at the root domain.
- **Tenant**: An isolated business workspace created by an Owner. All data (products,
  customers, sales, receivals, users) belongs to exactly one Tenant.
- **Tenant_Slug**: A globally unique, URL-safe lowercase identifier chosen by the Owner at
  workspace creation time (e.g. `takataka`, `city-farm`). Used to construct the workspace
  URL path or subdomain.
- **Owner**: The Firebase Auth user who created a Tenant. Each Tenant has exactly one Owner.
  The Owner role is the highest privilege level within a Tenant.
- **Admin**: A Tenant-scoped role below Owner. Can manage most settings except deleting the
  Tenant or changing the Owner.
- **Staff**: A Tenant-scoped role with create-only access as configured by the Tenant Admin/Owner.
- **Viewer**: A Tenant-scoped role with read-only access as configured by the Tenant Admin/Owner.
- **Product**: A catalog entry defined by a Tenant, comprising a name, unit, and price. Replaces
  the hardcoded `PRODUCTS` array in `src/utils/pricing.ts`.
- **Sale_Line**: A single row in a Sale, referencing one Product, a quantity, and the price
  captured at the time of the sale.
- **Sale**: A transaction record for a Customer consisting of one or more Sale_Lines.
- **Customer**: A contact record (name, phone, location, notes) scoped to a Tenant.
- **Receival**: A supply-chain intake record scoped to a Tenant. Retained for the Takataka
  Pigfood tenant; available as an optional module on Standard and above plans.
- **Receival_Module**: The optional truck/supply tracking feature available to tenants on the
  Standard plan or higher.
- **Stripe_Subscription**: A Stripe object that gates plan tier access for an Owner.
- **Plan_Tier**: One of `basic`, `standard`, or `pro`, determining feature limits per Tenant.
- **Migration**: The one-time process of converting all existing flat Firestore collections
  into Tenant-scoped sub-collections under the Takataka Pigfood tenant document.
- **Tenant_Context**: The runtime object available throughout the app that identifies the
  current Tenant and the authenticated user's role within that Tenant.

---

## Requirements

### Requirement 1: Platform Landing Page and Tenant Registration

**User Story:** As a new business owner, I want to visit the platform home page and create a
workspace for my business, so that I can start managing my inventory and sales.

#### Acceptance Criteria

1. THE Platform SHALL display a public marketing landing page at the root URL that describes StockSight's features and pricing tiers.
2. WHEN a visitor clicks "Create Free Workspace", THE Platform SHALL present a registration form collecting: business name (1–100 characters), Tenant_Slug, owner full name (1–100 characters), email, and password.
3. WHEN the registration form is submitted with a Tenant_Slug that is already in use, THE Platform SHALL display an inline error message "This workspace name is already taken" before creating any records.
4. WHEN the registration form is submitted with all fields valid per criteria 6 and 8, THE Platform SHALL create a Firebase Auth account, a Firestore tenant document at `tenants/{tenantId}`, and an owner user document at `tenants/{tenantId}/users/{uid}` within the same atomic operation.
5. WHEN tenant creation succeeds, THE Platform SHALL redirect the Owner to the Tenant dashboard at `/{tenant_slug}/dashboard`.
6. THE Platform SHALL enforce that a Tenant_Slug contains only lowercase letters, digits, and hyphens, is between 3 and 30 characters, and does not start or end with a hyphen.
7. IF the registration form is submitted with an email already registered to a Firebase Auth account, THEN THE Platform SHALL display the error "An account with this email already exists. Sign in instead." without clearing the other form fields.
8. THE Platform SHALL require that the registration password is at least 8 characters long and contains at least one uppercase letter, one lowercase letter, one digit, and one special character.
9. IF the Firebase Auth account is created successfully but the Firestore tenant or user document write fails, THEN THE Platform SHALL delete the Firebase Auth account and display "Registration failed. Please try again." leaving the user on the registration form.

---

### Requirement 2: Tenant-Scoped Authentication and Workspace Access

**User Story:** As a registered user, I want to sign in and be taken directly to my
workspace, so that I can work without manually navigating to my tenant.

#### Acceptance Criteria

1. WHEN a user signs in with email/password or Google OAuth, THE Auth_Service SHALL look up all tenants where that user's uid appears in the `users` sub-collection and resolve the user's role within each Tenant.
2. IF the tenant lookup query fails (network error or permission denied), THEN THE Auth_Service SHALL display an error message informing the user that their workspaces could not be loaded and offer a retry action.
3. WHEN a signed-in user belongs to exactly one Tenant, THE Platform SHALL redirect them to `/{tenant_slug}/dashboard` automatically.
4. WHEN a signed-in user belongs to more than one Tenant, THE Platform SHALL display a workspace-picker screen listing all their tenants by name and slug, and navigate to `/{tenant_slug}/dashboard` for the selected tenant on click.
5. WHEN a signed-in user belongs to no Tenant, THE Platform SHALL display an empty state page with a prompt to create a new workspace or accept an invitation.
6. THE Auth_Service SHALL maintain a Tenant_Context for each active session, containing the tenantId, tenant name, Tenant_Slug, and the user's role within that Tenant.
7. WHEN a user navigates to `/{tenant_slug}/...` and their session Tenant_Context does not match that slug, THE Platform SHALL verify membership before rendering any protected page content and redirect to `/login` if membership cannot be confirmed.
8. THE Platform SHALL preserve support for magic-link sign-in. WHEN a magic-link sign-in completes successfully, THE Auth_Service SHALL look up all tenants for the authenticated uid, and apply the same single-tenant redirect, workspace-picker, or empty-state logic defined in criteria 3–5 above.

---

### Requirement 3: Tenant Data Isolation

**User Story:** As a business owner, I want all my business data to be completely
separate from other tenants, so that no other business can read or modify my records.

#### Acceptance Criteria

1. THE Firestore_Service SHALL store all tenant data under the path `tenants/{tenantId}/{collection}` where `{collection}` is one of: `products`, `customers`, `sales`, `receivals`, `weeklyNotes`, `users`, `user_sessions`.
2. THE Firestore_Service SHALL enforce Firestore Security Rules that deny reads and writes to `tenants/{tenantId}/**` for any authenticated user whose uid does not appear in `tenants/{tenantId}/users/{uid}` with status `approved`.
3. THE Firestore_Service SHALL enforce Firestore Security Rules that deny reads and writes to `tenants/{tenantId}/**` for unauthenticated requests.
4. WHEN a user attempts to read or write data for a Tenant they do not belong to, THE Firestore_Service SHALL return a permission-denied error.
5. WHEN THE Firestore_Service returns a permission-denied error for a tenant route, THE Platform SHALL display a "You do not have access to this workspace" message and redirect to the workspace-picker.
6. WHEN a server-side API route receives a request for tenant-scoped data, THE API SHALL verify that the authenticated uid has an approved membership document in `tenants/{tenantId}/users` before executing the query, and return HTTP 403 if verification fails.
7. THE Platform SHALL not expose tenantId, Tenant_Slug, or any business data belonging to one Tenant in any API response, URL, or UI element visible to users of a different Tenant, enforced via both Firestore Security Rules and server-side query scoping.

---

### Requirement 4: Dynamic Product Catalog

**User Story:** As a tenant owner, I want to define my own product catalog with custom
names, units, and prices, so that my sales are not tied to hardcoded pig-food items.

#### Acceptance Criteria

1. THE Product_Catalog SHALL validate that a product has: `name` (1–100 non-whitespace-only characters), `unit` (1–50 characters), `price` (number between 0.01 and 999,999,999.99 inclusive), `isActive` (boolean), `createdAt` (timestamp), and `createdBy` (uid) before persisting to `tenants/{tenantId}/products`.
2. WHEN an Owner or Admin creates or edits a product with a name that matches an existing product in the same Tenant's catalog (case-insensitive, covering both active and inactive products), THE Product_Catalog SHALL reject the operation and display "A product with this name already exists."
3. WHEN a user navigates to the catalog management UI, THE Product_Catalog SHALL display all active products sorted alphabetically by name.
4. WHEN an Owner or Admin edits a product's price, THE Product_Catalog SHALL update only the catalog entry; existing Sale records referencing that product SHALL retain the price captured at the time of the original sale.
5. WHEN an Owner or Admin marks a product as inactive, THE Product_Catalog SHALL hide it from the "Add Sale" form's product picker while retaining it in historical sale records; WHEN the same product is subsequently marked active, it SHALL reappear in the picker.
6. WHEN the catalog management UI renders a Tenant's product list containing up to 200 active products, THE Product_Catalog SHALL complete the render within 2 seconds on a standard broadband connection.
7. WHERE the Tenant is the migrated legacy "Takataka Pigfood" tenant, THE Product_Catalog SHALL be pre-populated with all 13 products defined in `src/utils/pricing.ts` at the time of migration, using the prices defined in that file as each product's initial catalog price.

---

### Requirement 5: Flexible Sales with Inline Pricing

**User Story:** As a staff member, I want to create a sale by picking products from my
company's catalog and entering quantities, with the option to override a product's price
at sale time, so that I can handle one-off pricing without changing the catalog.

#### Acceptance Criteria

1. THE Sale_Form SHALL present a line-item builder where each row contains: a customer picker (searchable dropdown bound to the Tenant's customer list), a sale date field (date picker, default today), a product picker (searchable dropdown bound to the Tenant's active product catalog), a quantity field (positive integer, 1–9,999), a unit price field (number, 0.01–999,999,999.99, pre-filled from catalog price, editable), and a computed line total.
2. WHEN a product is selected in the Sale_Form, THE Sale_Form SHALL auto-fill the unit price field with the product's current catalog price.
3. WHEN a user changes the unit price in a Sale_Line, THE Sale_Form SHALL record the overridden price in the Sale_Line document.
4. WHEN a user changes the unit price in a Sale_Line, THE Product_Catalog SHALL not be modified.
5. THE Sale_Form SHALL allow adding up to 50 Sale_Lines per Sale.
6. WHEN the user submits the Sale_Form with at least one Sale_Line containing a quantity greater than 0, THE Sale_Service SHALL create a `sales` document at `tenants/{tenantId}/sales/{saleId}` and one `saleLines` sub-collection document per line.
7. WHEN the Sale_Service write fails (network error or Firestore error), THE Sale_Form SHALL display an error message and remain open with all entered data preserved.
8. WHEN the user submits the Sale_Form with no Sale_Lines having a quantity greater than 0, THE Sale_Form SHALL display an inline validation error "Add at least one item with a quantity greater than 0."
9. THE Sale_Service SHALL compute and persist `grandTotal` as the sum of `(quantity × unitPrice)` across all Sale_Lines at write time, rounded to 2 decimal places.
10. THE Sale_Service SHALL generate a unique `saleNumber` per Tenant using the pattern `{TENANT_PREFIX}-{YYMMDD}-{4-digit-random}` where `TENANT_PREFIX` is the first 4 characters of the Tenant_Slug uppercased; if a collision occurs, the 4-digit random suffix SHALL be regenerated until a unique value is found.
11. WHEN a Sale is printed as a receipt, THE Receipt_Printer SHALL display the Tenant's business name, the customer name, the sale date in DD/MM/YYYY format, each Sale_Line with product name, quantity, unit price, and line total, and the grand total.

---

### Requirement 6: Per-Tenant User Management and RBAC

**User Story:** As a tenant owner, I want to invite team members, assign roles, and
control their permissions within my workspace, so that each person has appropriate access.

#### Acceptance Criteria

1. THE Tenant SHALL store user membership in `tenants/{tenantId}/users/{uid}` with fields: `role` (owner/admin/staff/viewer), `status` (pending/approved/rejected/suspended), `email`, `displayName`, `permissions` (granular overrides map), and `createdAt`.
2. WHEN an Owner or Admin invites a user by email, THE Invitation_Service SHALL create an invitation document at `tenants/{tenantId}/invitations/{inviteId}` containing the invitee email, role, expiry timestamp (48 hours from creation), and inviter uid; IF an unexpired invitation already exists for that email in the same Tenant, THE Invitation_Service SHALL overwrite it with a new expiry and return without creating a duplicate.
3. WHEN an invited user clicks the invitation link and authenticates successfully, THE Invitation_Service SHALL add the user to `tenants/{tenantId}/users` with status `approved` and the assigned role, and delete the invitation document; IF the Tenant is already at its plan's member limit at acceptance time, THE Invitation_Service SHALL reject the acceptance and display a plan-limit error.
4. IF sign-in fails during invitation acceptance, THEN THE Invitation_Service SHALL display an authentication error message and preserve the invitation document for retry.
5. WHEN an invitation link is accessed after its expiry timestamp, THE Invitation_Service SHALL display a message informing the user that the invitation has expired and to request a new one, and take no further action.
6. THE RBAC_Service SHALL evaluate the granular permissions (canViewDashboard, canViewCustomers, canAddCustomers, canEditCustomer, canViewSales, canAddSale, canEditSale, canDeleteSale, canViewReports, canApproveUser) using the user's role and permission overrides stored in `tenants/{tenantId}/users/{uid}`; a user denied a permission SHALL receive a visible error message and the action SHALL not be executed.
7. WHEN an Owner suspends a user within a Tenant, THE RBAC_Service SHALL deny that user access to all Tenant-scoped routes within 5 seconds of the status update, via the real-time Firestore listener on the user's membership document, without requiring a page reload.
8. THE Platform SHALL limit the number of approved workspace members per Tenant based on the Plan_Tier: basic ≤ 3 members, standard ≤ 10 members, pro = unlimited.
9. WHEN an Admin or Owner attempts to approve a new member and the Tenant is already at its plan's member limit, THE Platform SHALL prevent approval and display a message indicating that the member limit for the current plan has been reached and suggesting an upgrade.

---

### Requirement 7: Tenant Profile and Branding

**User Story:** As a tenant owner, I want to configure my workspace's business name,
logo, and currency, so that receipts and the UI reflect my brand.

#### Acceptance Criteria

1. THE Tenant_Settings SHALL store a settings document containing: `businessName` (string, 1–100 characters), `logoURL` (string, optional), `currency` (ISO 4217 three-letter code, default `KES`), `timezone` (IANA timezone string, default `Africa/Nairobi`), and `updatedAt` (timestamp).
2. WHEN an Owner or Admin saves an updated `businessName`, THE Platform SHALL reflect the new name in the sidebar header and in all receipts generated after the save, within the same page render following the successful save operation.
3. WHEN an Owner uploads a logo image, THE Tenant_Settings SHALL accept only JPEG, PNG, or WebP files no larger than 2 MB, store the uploaded image, and persist the resulting download URL in the settings document.
4. IF a logo image upload exceeds 2 MB or is not a JPEG, PNG, or WebP file, THEN THE Tenant_Settings SHALL reject the upload and display an error message indicating the file size limit and accepted formats, leaving the existing `logoURL` unchanged.
5. THE Receipt_Printer SHALL display the ISO 4217 currency code and `businessName` from the Tenant's settings document on every printed receipt.
6. WHILE the `logoURL` is set, THE Platform SHALL display the Tenant's logo in the sidebar and on receipts.
7. IF the `logoURL` is not set, THEN THE Platform SHALL display the `businessName` as a text placeholder in the sidebar and on receipts in place of the logo.
8. IF the Tenant's settings document cannot be loaded at receipt generation time, THEN THE Receipt_Printer SHALL display an error message indicating that business settings are unavailable and SHALL NOT generate the receipt.

---

### Requirement 8: Billing Per Tenant (Owner-Level Subscription)

**User Story:** As a tenant owner, I want to subscribe to a plan that unlocks features
for my entire workspace, so that my team can use the platform without each member paying
separately.

#### Acceptance Criteria

1. WHEN a Stripe subscription is created for a Tenant, THE Billing_Service SHALL attach the subscription to the tenant document at `tenants/{tenantId}` rather than to any individual user document, so that all members of the Tenant benefit from the plan.
2. WHEN an Owner completes a Stripe Checkout session, THE Billing_Webhook SHALL update `tenants/{tenantId}/subscription` with the plan tier, status, Stripe customer ID, Stripe subscription ID, and `currentPeriodEnd` Unix timestamp.
3. WHEN the `customer.subscription.updated` Stripe event is received, THE Billing_Webhook SHALL update `tenants/{tenantId}/subscription` with the latest plan tier, status, Stripe customer ID, Stripe subscription ID, and `currentPeriodEnd` Unix timestamp.
4. THE Billing_Service SHALL gate feature access per plan tier as follows: basic (Dashboard, Sales, Customers, ≤3 members), standard (basic plus Receivals/Supply tracking, ≤10 members), pro (standard plus Advanced Reports and Session tracking, unlimited members).
5. WHEN a Tenant member (Owner or non-Owner) accesses a plan-gated feature, THE Platform SHALL read the plan tier and status from `tenants/{tenantId}/subscription`; IF the feature is not available on that tier, THE Platform SHALL display an upgrade prompt and prevent access.
6. IF a Tenant's subscription status is `past_due` or `canceled`, THEN THE Platform SHALL restrict all Tenant members to read and list operations only (create, update, and delete operations SHALL be blocked), and display a banner informing members that the workspace subscription requires attention.
7. WHEN a non-Owner member navigates to the Billing settings page, THE Platform SHALL redirect them away and display a message that only the workspace Owner can manage billing.
8. WHEN an Owner or Admin attempts to approve a new workspace member invitation and the Tenant is already at the plan's approved member limit, THE Platform SHALL reject the approval and display a message indicating the member limit has been reached and suggesting an upgrade.

---

### Requirement 9: Legacy Data Migration (Takataka Pigfood Tenant)

**User Story:** As the current Takataka Pigfood owner, I want all existing data preserved
and accessible after the platform upgrade, so that I do not lose any historical records.

#### Acceptance Criteria

1. THE Migration_Script SHALL create a tenant document at `tenants/takataka` with `businessName = "Takataka Pigfood"`, `slug = "takataka"`, and `currency = "KES"`.
2. THE Migration_Script SHALL copy all documents from the root-level `customers` collection into `tenants/takataka/customers`, preserving all field values and document IDs.
3. THE Migration_Script SHALL copy all documents from the root-level `sales` collection into `tenants/takataka/sales`, preserving all field values and document IDs.
4. THE Migration_Script SHALL copy all documents from the root-level `receivals` collection into `tenants/takataka/receivals`, preserving all field values and document IDs.
5. THE Migration_Script SHALL copy all documents from the root-level `weeklyNotes` collection into `tenants/takataka/weeklyNotes`, preserving all field values and document IDs.
6. THE Migration_Script SHALL copy all documents from the root-level `users` collection into `tenants/takataka/users`, preserving uid, role, status, and permission fields.
7. WHEN the Migration_Script completes, THE Platform SHALL serve the Takataka Pigfood workspace at `/takataka/dashboard` with the migrated data, and the count of documents in each destination sub-collection SHALL equal the count in the corresponding source collection at the time of migration.
8. WHEN the Migration_Script is run and a destination document with the same ID already exists, THE Migration_Script SHALL skip that document without modifying it and without counting it as a newly migrated document.
9. IF a document write fails during migration, THEN THE Migration_Script SHALL skip that document, record the document ID and collection in an error log, and continue processing the remaining documents.
10. THE Migration_Script SHALL print a completion summary showing: total documents migrated per collection, total documents skipped per collection, total errors per collection, and SHALL exit with a non-zero exit code if any errors were encountered.

---

### Requirement 10: URL Structure and Navigation

**User Story:** As a user, I want all my workspace URLs to be consistently scoped to my
tenant, so that bookmarks and shared links always open the correct workspace.

#### Acceptance Criteria

1. THE Platform SHALL route all authenticated tenant pages under the path prefix `/{tenant_slug}/`, where `tenant_slug` is 3–63 characters long, contains only lowercase letters, digits, and hyphens, and begins with a lowercase letter (e.g. `/takataka/dashboard`, `/takataka/sales/new`).
2. IF an unauthenticated user requests the bare root `/`, THEN THE Platform SHALL redirect the user to the marketing landing page.
3. IF an authenticated user requests the bare root `/`, THEN THE Platform SHALL redirect the user to the workspace-picker page.
4. WHEN an authenticated user navigates to `/{tenant_slug}/...` for a tenant they belong to, THE Platform SHALL render the correct workspace page and preserve the current URL in the browser address bar.
5. WHEN an authenticated user navigates to `/{tenant_slug}/...` for a tenant they do not belong to, THE Platform SHALL display a "Workspace not found or access denied" page and offer a link back to the workspace-picker.
6. IF a request arrives with a path prefix `/{tenant_slug}/` where `tenant_slug` does not conform to the format defined in criterion 1, THEN THE Platform SHALL return a "Page not found" error page.
7. THE Platform SHALL resolve the active Tenant_Slug from either a path prefix (`/{tenant_slug}/`) or a subdomain (`{tenant_slug}.stocksight.app`), such that the same tenant workspace is served regardless of which routing model is used.

---

### Requirement 11: Receival Module (Standard and Pro Plans)

**User Story:** As a supply-chain manager on a Standard or Pro plan, I want to log
incoming stock receivals with source, weight, and breakdown fractions, so that I can
reconcile stock received against stock sold.

#### Acceptance Criteria

1. WHILE a Tenant's plan is `standard` or `pro`, THE Receival_Module sidebar link SHALL be rendered and SHALL navigate the user to the receival list page when clicked.
2. WHEN a user navigates to the receivals section (via sidebar link or direct URL) on a `basic` plan, THE Platform SHALL display an upgrade prompt and SHALL NOT render the receival list or form.
3. WHEN a receival record is saved, THE Receival_Module SHALL persist a document at `tenants/{tenantId}/receivals/{receivalId}` containing: `date`, `source`, `truckNumber`, `weightIn`, `weightOut`, `netWeight`, `cookedFood`, `bread`, `meat`, `bones`, `veggies`, `notes`, `createdBy`, and `createdAt`.
4. WHEN a receival record is saved with both `weightIn` and `weightOut` provided, THE Receival_Module SHALL compute and persist `netWeight = weightIn - weightOut`; WHEN only `netWeight` is provided, THE Receival_Module SHALL persist the entered value directly; both `weightIn`, `weightOut`, and `netWeight` SHALL be in the range 0.01–99,999 kg.
5. IF the computed or entered `netWeight` is zero or negative, THEN THE Receival_Module SHALL reject the save and display an error message stating that net weight must be a positive value.
6. THE Receival_Module SHALL display an edit action and a delete action on each receival record; WHEN a user without `canEditSale` permission attempts to edit, or without `canDeleteSale` permission attempts to delete, THE Receival_Module SHALL display a permission-denied message and take no further action.

---

### Requirement 12: Reports and Analytics (Tenant-Scoped)

**User Story:** As a tenant owner or admin, I want to view reports and analytics
scoped to my workspace, so that I can track revenue, top customers, and product
performance for my business only.

#### Acceptance Criteria

1. THE Reports_Module SHALL display data only from `tenants/{tenantId}/sales` and `tenants/{tenantId}/receivals`, ensuring no cross-tenant data is ever shown.
2. WHEN a user applies a date-range filter in the Reports_Module, THE Reports_Module SHALL display: total number of sales, total revenue (sum of grandTotal across filtered sales), and the top 5 customers by revenue (sum of quantity × price_at_sale) within the selected range; IF no sales exist in the range, THE Reports_Module SHALL display an empty-state message.
3. WHILE the Tenant plan is `pro`, THE Reports_Module SHALL render an advanced weekly-aggregation report section showing per-week revenue, sales weight (kg), receival weight (kg), and the percentage share of receival weight per product fraction.
4. WHEN any Tenant member navigates to the advanced reports section on a `basic` or `standard` plan, THE Reports_Module SHALL display an upgrade prompt and SHALL NOT render the advanced report content.
5. THE Reports_Module SHALL provide a print action on all report views that triggers the browser print dialog with the report content formatted for printing.
