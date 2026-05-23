# 🐖 Takataka Pigfood Manager

A professional, real-time management dashboard for pig food sales, customer relationships, access control, and financial analytics. Built on top of **Next.js 16 (App Router)** and **Google Firebase / Cloud Firestore**.

---

## 🚀 Key Features

* **Real-time Sales Log**: Register and manage sales with automatic calculations matching product pricing structures.
* **Customer Directory**: Add, search, and update customer profiles. Supports importing/exporting from Microsoft Excel.
* **Granular Role-Based Access Control (RBAC)**: Enforce screen restrictions and access permissions for `Owner`, `Admin`, and `Staff` roles.
* **Interactive Analytics Reports**: Dynamic data visualizations for weekly/monthly sales, revenue stats, and customer metrics using Recharts.
* **Data Portability**: Export sales statements as CSV ledger logs or upload/download customer tables as spreadsheets.
* **Unit Test Suite**: 100% test coverage on core math, date/currency formatting, and access rules.

---

## 🛠️ Technology Stack

* **Front-end**: Next.js 16.x (React 19, TypeScript)
* **Styling**: Tailwind CSS 4.x (using modern PostCSS configuration)
* **Database & Auth**: Google Firebase (Cloud Firestore & Authentication)
* **Testing**: Vitest (blazing-fast unit testing runner)

---

## 📋 Prerequisites

To run this project locally, ensure you have:
* **Node.js** v20.x or higher installed.
* **npm** v10.x or higher installed.
* A **Google Firebase** project created via the [Firebase Console](https://console.firebase.google.com/).

---

## ⚙️ Initial Setup

### 1. Configure Environment Variables

Create a `.env.local` file in the root of the project by copying the example file:

```bash
cp .env.local.example .env.local
```

Open `.env.local` and replace the placeholder values with your Firebase App credentials found in:
* **Firebase Console** ➔ **Project Settings** ➔ **General** ➔ **Your Apps** ➔ **Web App (Config)**.

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 2. Install Project Dependencies

Run the following command in the project root directory:

```bash
npm install
```

---

## 💻 Running the Project

### Local Development Server

Start the local development server with:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to access the dashboard.

### Production Build

To verify build safety or compile a production bundle, execute:

```bash
# Compile and build the project
npm run build

# Start the built production server
npm run start
```

### Code Quality (Linting)

To run ESLint and check for static analysis problems:

```bash
npm run lint
```

---

## 🧪 Testing Guide

This project includes a comprehensive unit testing suite using **Vitest** to verify the math logic, text processors, and security matrix.

### Running Tests Once

Runs all tests and outputs a pass/fail summary (perfect for CI or commit checks):

```bash
npm run test
```

### Running Tests in Watch Mode

Starts the test runner in interactive mode, auto-reloading tests as you edit files:

```bash
npm run test:watch
```

### What is Tested?

The test suite covers:
1. **Pricing Calculations** (`src/utils/__tests__/pricing.test.ts`): Ensures product cost structures align, grand total math is accurate, and unique sale tickets are generated correctly.
2. **Formatting Helpers** (`src/utils/__tests__/formatters.test.ts`): Validates currency formatter (KES outputs), date formatting, and text truncation logic.
3. **Role Permissions** (`src/lib/__tests__/rbac.test.ts`): Checks that user action permissions are strictly locked or allowed for Owners, Admins, and Staff.

---

## 📖 Deep-Dive Architecture

For a detailed walkthrough of database schemas, role matrices, product formulas, and spreadsheet import rules, please check out the full [DOCUMENTATION.md](DOCUMENTATION.md) file.
