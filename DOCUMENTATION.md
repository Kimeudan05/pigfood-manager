# Takataka Pigfood Manager - Technical Documentation

This document provides a comprehensive technical overview of the Takataka Pigfood Manager application. It details the system architecture, technology stack, directory layout, database schema, authorization matrix, and core logic components.

---

## 1. System Overview & Architecture

The **Takataka Pigfood Manager** is a modern, single-page-like web dashboard designed to manage pig food sales, customer relationships, access controls, and financial reporting. 

The application utilizes a **Client-Side Serverless Architecture** built with Next.js, powered directly by Google Firebase. Database queries, authentication state management, and computations are performed client-side, making the app highly performant and reactive.

### Tech Stack
* **Framework**: [Next.js 16.x](https://nextjs.org/) (App Router layout, React 19, TypeScript)
* **Styling**: [Tailwind CSS 4.x](https://tailwindcss.com/) with Vanilla CSS custom configurations
* **Backend-as-a-Service**: [Google Firebase v12](https://firebase.google.com/)
  * **Firebase Authentication**: For user logins (Email/Password & Magic Sign-In Links)
  * **Cloud Firestore**: Real-time NoSQL database
* **Data Visualizations**: [Recharts 3.x](https://recharts.org/) for analytics and sales reports
* **Import/Export Utilities**:
  * [SheetJS (xlsx)](https://sheetjs.com/) for importing and exporting customer spreadsheets
  * Native JS Blobs for CSV ledger exports
* **Testing Suite**: [Vitest](https://vitest.dev/) for blazing-fast unit testing

---

## 2. Directory Structure

```
pigfood-manager/
├── src/
│   ├── app/                    # Next.js App Router Pages & Layouts
│   │   ├── (protected)/        # Authenticated-only pages
│   │   │   ├── customers/      # Customer directory and management
│   │   │   ├── dashboard/      # Primary analytics dashboard
│   │   │   ├── profile/        # Current user profile configurations
│   │   │   ├── reports/        # Interactive sales and product reports
│   │   │   ├── sales/          # Sales logs and ticket creation
│   │   ├── forgot-password/    # Password recovery route
│   │   ├── login/              # Sign-in portal
│   │   ├── register/           # Registration portal
│   │   ├── layout.tsx          # Root HTML layout structure
│   │   ├── page.tsx            # Landing redirect controller
│   │   └── providers.tsx       # Auth, Theme, and UI context providers
│   ├── components/             # Reusable React components
│   │   ├── layout/             # Sidebar, Navbar, and navigational components
│   │   └── ui/                 # Basic building blocks (Modal, Spinner, Toast)
│   ├── contexts/               # React Context Providers for global state
│   │   ├── AuthContext.tsx     # Session state & Firebase Auth integration
│   │   ├── ThemeContext.tsx    # Light / Dark theme toggles
│   │   └── ToastContext.tsx    # Flash notification messages
│   ├── lib/                    # Configuration layers
│   │   ├── firebase.ts         # Firebase client SDK initialization
│   │   ├── firestore.ts        # Database queries wrapper
│   │   └── rbac.ts             # Authorization role permissions checks
│   ├── types/                  # Shared TypeScript type declarations
│   └── utils/                  # Pure utility helper functions
│       ├── csv.ts              # Data conversion to CSV format
│       ├── formatters.ts       # Text, Date, and Currency formatters
│       └── pricing.ts          # Pig food prices configuration and calculations
├── vitest.config.ts            # Testing framework configuration
├── tailwind.config.ts          # Styling design system definitions
└── package.json                # Project dependencies and script endpoints
```

---

## 3. Database Schema (Cloud Firestore)

Firestore is structured as a NoSQL document database. We utilize three main collections: `users`, `customers`, and `sales`.

### Collection: `users`
Tracks authenticated staff profiles and roles. Documents are keyed by the user's Firebase UID.

```typescript
interface AppUser {
  uid: string;           // Match Firebase Auth UID
  email: string | null;  // User email address
  displayName: string;   // Full name
  photoURL: string | null;
  role: 'owner' | 'admin' | 'staff';
  createdAt: Timestamp;  // Registration time
}
```

### Collection: `customers`
Stores customer details. Managed by owners/admins/staff.

```typescript
interface Customer {
  id: string;            // Firestore Auto ID
  fullName: string;      // Customer full name
  phone: string;         // Customer contact number
  location: string;      // Location / Farm address
  notes: string;         // Delivery instructions or custom info
  createdBy: string;     // Creator user UID
  createdAt: Timestamp;  // Creation timestamp
}
```

### Collection: `sales`
Logs sales transactions. Stores both raw quantities (so pricing changes don't corrupt historical data) and the calculated totals computed at checkout.

```typescript
interface Sale {
  id: string;            // Firestore Auto ID
  saleNumber: string;    // Formatted ticket string e.g. TK-YYMMDD-XXXX
  customerId: string;    // Customer ID reference
  customerName: string;  // Customer name snapshot
  
  // Quantities purchased
  cookedFood: number;
  bread: number;
  meat25: number;
  meat30: number;
  bones: number;
  gradeA: number;
  veggies: number;
  
  // Computed values (in KES)
  cookedFoodTotal: number;
  breadTotal: number;
  meat25Total: number;
  meat30Total: number;
  bonesTotal: number;
  gradeATotal: number;
  veggiesTotal: number;
  grandTotal: number;
  
  createdBy: string;     // Staff member UID who registered the sale
  createdAt: Timestamp;  // Transaction timestamp
}
```

---

## 4. Role-Based Access Control (RBAC)

The system restricts page navigation and destructive actions based on the user's role: `owner`, `admin`, or `staff`.

| Permission | Owner | Admin | Staff | Description |
| :--- | :---: | :---: | :---: | :--- |
| **Manage Users** | ✅ | ❌ | ❌ | Can register/delete or change user roles. |
| **Delete Records** | ✅ | ✅ | ❌ | Can delete transactions or customers. |
| **View Reports** | ✅ | ✅ | ❌ | Can view dashboard analytics and charts. |
| **Create Records** | ✅ | ✅ | ✅ | Can create sales tickets and register customers. |
| **Edit Records** | ✅ | ✅ | ❌ | Can modify existing customer/sale profiles. |

---

## 5. Pricing Engine

All product prices are hardcoded in the pricing utility to ensure calculations remain consistent and easy to maintain.

### Product Configuration Matrix

| Product Key | Display Label | Price (per bag) | Total Property |
| :--- | :--- | :---: | :--- |
| `cookedFood` | Cooked Food | KES 20 | `cookedFoodTotal` |
| `bread` | Bread | KES 20 | `breadTotal` |
| `meat25` | Meat @ 25 | KES 25 | `meat25Total` |
| `meat30` | Meat @ 30 | KES 30 | `meat30Total` |
| `bones` | Bones | KES 15 | `bonesTotal` |
| `gradeA` | Grade A | KES 5 | `gradeATotal` |
| `veggies` | Veggies | KES 6 | `veggiesTotal` |

### Math Formula
For any set of quantities $Q$, the total for each item $i$ with unit price $P_i$ is computed as:

$$\text{Total}_i = Q_i \times P_i$$

$$\text{Grand Total} = \sum (\text{Total}_i)$$

These calculations are executed in `src/utils/pricing.ts#calculateTotals` whenever a new sale is made or modified.

---

## 6. Data Import & Export

### Excel Import / Export (Customers)
Located in `src/app/(protected)/customers/page.tsx`, SheetJS (`xlsx`) parses uploads and produces sheets:
* **Import**: Validates `.xlsx` or `.xls` files client-side, extracting row items and mapping them to `fullName`, `phone`, `location`, and `notes`. It recursively inserts documents into Firestore.
* **Export**: Dynamically builds worksheets containing customer details, downloads them directly as a `.xlsx` workbook.

### CSV Export (Sales Ledger)
Located in `src/utils/csv.ts`, generates clean CSV representations of sales reports. It surrounds all string values with double quotes (`"`) to ensure addresses containing commas do not corrupt the CSV boundaries.
