// ============================================
// Firestore Service Layer
// ============================================
// All database operations for customers and sales.

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { Customer, CustomerFormData, Sale, SaleFormData, SaleItems, SaleTotals } from "@/types";
import { calculateTotals, generateSaleNumberLegacy } from "@/utils/pricing";

// ---------- Customer Operations ----------

const customersRef = collection(db, "customers");
const salesRef = collection(db, "sales");

/** Add a new customer */
export async function addCustomer(data: CustomerFormData, userId: string): Promise<string> {
  const docRef = await addDoc(customersRef, {
    ...data,
    createdBy: userId,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/** Update an existing customer */
export async function updateCustomer(id: string, data: Partial<CustomerFormData>): Promise<void> {
  const docRef = doc(db, "customers", id);
  await updateDoc(docRef, { ...data });
}

/** Delete a customer */
export async function deleteCustomer(id: string): Promise<void> {
  const docRef = doc(db, "customers", id);
  await deleteDoc(docRef);
}

/** Get a single customer by ID */
export async function getCustomer(id: string): Promise<Customer | null> {
  const docRef = doc(db, "customers", id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Customer;
}

/** Get all customers */
export async function getAllCustomers(): Promise<Customer[]> {
  const q = query(customersRef, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer));
}

/** Search customers by name */
export async function searchCustomers(searchTerm: string): Promise<Customer[]> {
  // Firestore doesn't support native full-text search,
  // so we fetch all and filter client-side for simplicity
  const all = await getAllCustomers();
  const term = searchTerm.toLowerCase();
  return all.filter(
    (c) =>
      c.fullName.toLowerCase().includes(term) ||
      c.phone.includes(term) ||
      c.location.toLowerCase().includes(term)
  );
}

// ---------- Sale Operations ----------

/** Add a new sale with auto-calculated totals */
export async function addSale(data: SaleFormData, userId: string): Promise<string> {
  const items: SaleItems = {
    cookedFood: data.cookedFood,
    bread: data.bread,
    bread25: data.bread25 ?? 0,
    meat25: data.meat25,
    meat30: data.meat30,
    meat40: data.meat40 ?? 0,
    bones: data.bones,
    bones10: data.bones10 ?? 0,
    bones13: data.bones13 ?? 0,
    gradeA: data.gradeA,
    veggies: data.veggies,
    unga: data.unga ?? 0,
    BSF: data.BSF ?? 0,
  };

  const totals: SaleTotals = calculateTotals(items);
  const saleNumber = generateSaleNumberLegacy();

  const docRef = await addDoc(salesRef, {
    saleNumber,
    customerId: data.customerId,
    customerName: data.customerName,
    ...items,
    ...totals,
    createdBy: userId,
    createdAt: data.saleDate ? Timestamp.fromDate(new Date(data.saleDate)) : serverTimestamp(),
  });

  return docRef.id;
}

/** Update an existing sale */
export async function updateSale(id: string, data: SaleFormData): Promise<void> {
  const items: SaleItems = {
    cookedFood: data.cookedFood,
    bread: data.bread,
    bread25: data.bread25 ?? 0,
    meat25: data.meat25,
    meat30: data.meat30,
    meat40: data.meat40 ?? 0,
    bones: data.bones,
    bones10: data.bones10 ?? 0,
    bones13: data.bones13 ?? 0,
    gradeA: data.gradeA,
    veggies: data.veggies,
    unga: data.unga ?? 0,
    BSF: data.BSF ?? 0,
  };

  const totals: SaleTotals = calculateTotals(items);
  const docRef = doc(db, "sales", id);

  const updateData: any = {
    customerId: data.customerId,
    customerName: data.customerName,
    ...items,
    ...totals,
  };

  if (data.saleDate) {
    updateData.createdAt = Timestamp.fromDate(new Date(data.saleDate));
  }

  await updateDoc(docRef, updateData);
}

/** Delete a sale */
export async function deleteSale(id: string): Promise<void> {
  const docRef = doc(db, "sales", id);
  await deleteDoc(docRef);
}

/** Get a single sale by ID */
export async function getSale(id: string): Promise<Sale | null> {
  const docRef = doc(db, "sales", id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Sale;
}

/** Get all sales ordered by date */
export async function getAllSales(): Promise<Sale[]> {
  const q = query(salesRef, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Sale));
}

/** Get sales for a specific customer */
export async function getCustomerSales(customerId: string): Promise<Sale[]> {
  const q = query(
    salesRef,
    where("customerId", "==", customerId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Sale));
}

/** Get recent sales (limited) */
export async function getRecentSales(count: number = 10): Promise<Sale[]> {
  const q = query(salesRef, orderBy("createdAt", "desc"), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Sale));
}

/** Get sales within a date range */
export async function getSalesByDateRange(start: Date, end: Date): Promise<Sale[]> {
  const q = query(
    salesRef,
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<=", Timestamp.fromDate(end)),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Sale));
}

// ---------- User Management Operations ----------

const usersRef = collection(db, "users");

/** Get all users ordered by creation date */
export async function getAllUsers(): Promise<import("@/types").AppUser[]> {
  const q = query(usersRef, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() } as import("@/types").AppUser));
}

/** Find a user document by email address */
export async function getUserByEmail(email: string): Promise<import("@/types").AppUser | null> {
  const q = query(usersRef, where("email", "==", email));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { uid: d.id, ...d.data() } as import("@/types").AppUser;
}

/** Update a user's role */
export async function updateUserRole(uid: string, role: import("@/types").UserRole): Promise<void> {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, { role });
}

/** Update a user's status (approve / reject) */
export async function updateUserStatus(uid: string, status: import("@/types").UserStatus): Promise<void> {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, { status });
}

/** Update per-user granular permission overrides */
export async function updateUserPermissions(
  uid: string,
  permissions: Partial<import("@/types").GranularPermissions>
): Promise<void> {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, { permissions });
}

/** Update general fields on a user doc */
export async function updateUserDoc(
  uid: string,
  data: Partial<import("@/types").AppUser>
): Promise<void> {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, data);
}

/** Permanently delete a user doc from Firestore */
export async function deleteUserDoc(uid: string): Promise<void> {
  const ref = doc(db, "users", uid);
  await import("firebase/firestore").then(({ deleteDoc }) => deleteDoc(ref));
}

/** Update a user's Stripe subscription info */
export async function updateUserSubscription(
  uid: string,
  subscription: import("@/types").Subscription
): Promise<void> {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, { subscription });
}

/** Find a user by their Stripe customer ID */
export async function getUserByStripeCustomerId(
  stripeCustomerId: string
): Promise<import("@/types").AppUser | null> {
  const q = query(usersRef, where("subscription.stripeCustomerId", "==", stripeCustomerId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { uid: d.id, ...d.data() } as import("@/types").AppUser;
}



const receivalsRef = collection(db, "receivals");

/** Add a new receival */
export async function addReceival(data: import("@/types").ReceivalFormData, userId: string): Promise<string> {
  const docRef = await addDoc(receivalsRef, {
    ...data,
    createdBy: userId,
    createdAt: data.date ? Timestamp.fromDate(new Date(data.date)) : serverTimestamp(),
  });
  return docRef.id;
}

/** Update an existing receival */
export async function updateReceival(id: string, data: Partial<import("@/types").ReceivalFormData>): Promise<void> {
  const docRef = doc(db, "receivals", id);
  const updateData: any = { ...data };
  if (data.date) {
    updateData.createdAt = Timestamp.fromDate(new Date(data.date));
  }
  await updateDoc(docRef, updateData);
}

/** Delete a receival */
export async function deleteReceival(id: string): Promise<void> {
  const docRef = doc(db, "receivals", id);
  await deleteDoc(docRef);
}

/** Get a single receival by ID */
export async function getReceival(id: string): Promise<import("@/types").Receival | null> {
  const docRef = doc(db, "receivals", id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as import("@/types").Receival;
}

/** Get all receivals */
export async function getAllReceivals(): Promise<import("@/types").Receival[]> {
  const q = query(receivalsRef, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as import("@/types").Receival));
}

/** Get receivals within a date range */
export async function getReceivalsByDateRange(start: Date, end: Date): Promise<import("@/types").Receival[]> {
  const q = query(
    receivalsRef,
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<=", Timestamp.fromDate(end)),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as import("@/types").Receival));
}

/** Get receivals for a specific date string (YYYY-MM-DD) */
export async function getReceivalsByDateStr(dateStr: string): Promise<import("@/types").Receival[]> {
  const q = query(
    receivalsRef,
    where("date", "==", dateStr)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as import("@/types").Receival));
}

/** Get unique truck numbers used in receivals */
export async function getUniqueTruckNumbers(): Promise<string[]> {
  // Currently fetching all and extracting. For large datasets, 
  // a separate collection or cloud function should maintain this list.
  const all = await getAllReceivals();
  const set = new Set<string>();
  all.forEach(r => {
    if (r.truckNumber && r.truckNumber.trim() !== "") {
      set.add(r.truckNumber.trim().toUpperCase());
    }
  });
  return Array.from(set).sort();
}

// ---------- Reports & Notes ----------

const weeklyNotesRef = collection(db, "weeklyNotes");

/** Save or update a note for a specific week */
export async function saveWeeklyNote(weekKey: string, note: string, userId: string): Promise<void> {
  const docRef = doc(db, "weeklyNotes", weekKey);
  await setDoc(docRef, {
    note,
    createdBy: userId,
    updatedAt: serverTimestamp(),
  });
}

/** Get all weekly notes */
export async function getWeeklyNotes(): Promise<import("@/types").WeeklyNote[]> {
  const q = query(weeklyNotesRef);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as import("@/types").WeeklyNote));
}

/** Delete a weekly note */
export async function deleteWeeklyNote(weekKey: string): Promise<void> {
  await deleteDoc(doc(db, "weeklyNotes", weekKey));
}

// ---------- Session Tracking ----------

const sessionsRef = collection(db, "user_sessions");

/** Start a new user session */
export async function startUserSession(
  userId: string,
  email: string | null,
  displayName: string | null,
  photoURL: string | null
): Promise<string> {
  const now = Date.now();
  const docRef = await addDoc(sessionsRef, {
    userId,
    email,
    displayName,
    photoURL,
    startTime: now,
    lastActive: now,
    duration: 0,
  });
  return docRef.id;
}

/** Update an existing user session's lastActive and duration */
export async function updateUserSession(sessionId: string, startTime: number): Promise<void> {
  const docRef = doc(db, "user_sessions", sessionId);
  const now = Date.now();
  // Duration in seconds
  const duration = Math.floor((now - startTime) / 1000);
  await updateDoc(docRef, {
    lastActive: now,
    duration,
  });
}

/** Get currently active sessions (active within last 5 minutes) */
export async function getActiveSessions(): Promise<import("@/types").UserSession[]> {
  const fiveMinsAgo = Date.now() - 5 * 60 * 1000;
  const q = query(
    sessionsRef,
    where("lastActive", ">=", fiveMinsAgo),
    orderBy("lastActive", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as import("@/types").UserSession));
}

/** Get sessions since a specific timestamp */
export async function getSessionsSince(timestamp: number): Promise<import("@/types").UserSession[]> {
  const q = query(
    sessionsRef,
    where("startTime", ">=", timestamp),
    orderBy("startTime", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as import("@/types").UserSession));
}


// ============================================
// Tenant-Scoped Service Layer (Multi-Tenant)
// ============================================
// All functions below accept `tenantId` as first parameter and use the path
// `tenants/{tenantId}/{collection}` instead of root-level collection refs.
// Existing root-collection functions above are kept for backward compatibility
// during the migration period and are marked @deprecated.

import { TenantMember, WeeklyNote, Receival, ReceivalFormData } from "@/types";

// ---------- Tenant-Scoped Customer Functions ----------

/**
 * Add a new customer scoped to the given tenant.
 * _Requirements: 3.1_
 */
export async function addCustomerT(
  tenantId: string,
  data: CustomerFormData,
  userId: string
): Promise<string> {
  const ref = collection(db, "tenants", tenantId, "customers");
  const docRef = await addDoc(ref, {
    ...data,
    createdBy: userId,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Update an existing customer in the tenant scope.
 * _Requirements: 3.1_
 */
export async function updateCustomerT(
  tenantId: string,
  id: string,
  data: Partial<CustomerFormData>
): Promise<void> {
  const docRef = doc(db, "tenants", tenantId, "customers", id);
  await updateDoc(docRef, { ...data });
}

/**
 * Delete a customer from the tenant scope.
 * _Requirements: 3.1_
 */
export async function deleteCustomerT(
  tenantId: string,
  id: string
): Promise<void> {
  const docRef = doc(db, "tenants", tenantId, "customers", id);
  await deleteDoc(docRef);
}

/**
 * Get a single customer by ID within the tenant scope.
 * _Requirements: 3.1_
 */
export async function getCustomerT(
  tenantId: string,
  id: string
): Promise<Customer | null> {
  const docRef = doc(db, "tenants", tenantId, "customers", id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Customer;
}

/**
 * Get all customers for the given tenant.
 * _Requirements: 3.1_
 */
export async function getAllCustomersT(
  tenantId: string
): Promise<Customer[]> {
  const ref = collection(db, "tenants", tenantId, "customers");
  const q = query(ref, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer));
}

/**
 * Search customers by name, phone, or location within the tenant scope.
 * _Requirements: 3.1_
 */
export async function searchCustomersT(
  tenantId: string,
  searchTerm: string
): Promise<Customer[]> {
  const all = await getAllCustomersT(tenantId);
  const term = searchTerm.toLowerCase();
  return all.filter(
    (c) =>
      c.fullName.toLowerCase().includes(term) ||
      c.phone.includes(term) ||
      c.location.toLowerCase().includes(term)
  );
}

// ---------- Tenant-Scoped Sale Functions ----------

/**
 * Get all sales for the given tenant ordered by date (header only).
 * Note: full two-level model with saleLines is implemented in task 6.4.
 * _Requirements: 3.1_
 */
export async function getAllSalesT(tenantId: string): Promise<Sale[]> {
  const ref = collection(db, "tenants", tenantId, "sales");
  const q = query(ref, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Sale));
}

/**
 * Delete a sale from the tenant scope.
 * Note: deletion of saleLines sub-collection will be handled in task 6.4.
 * _Requirements: 3.1_
 */
export async function deleteSaleT(
  tenantId: string,
  id: string
): Promise<void> {
  const docRef = doc(db, "tenants", tenantId, "sales", id);
  await deleteDoc(docRef);
}

/**
 * Get sales within a date range for the given tenant.
 * _Requirements: 3.1_
 */
export async function getSalesByDateRangeT(
  tenantId: string,
  start: Date,
  end: Date
): Promise<Sale[]> {
  const ref = collection(db, "tenants", tenantId, "sales");
  const q = query(
    ref,
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<=", Timestamp.fromDate(end)),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Sale));
}

/**
 * Get recent sales (limited) for the given tenant.
 * _Requirements: 3.1_
 */
export async function getRecentSalesT(
  tenantId: string,
  count: number = 10
): Promise<Sale[]> {
  const ref = collection(db, "tenants", tenantId, "sales");
  const q = query(ref, orderBy("createdAt", "desc"), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Sale));
}

/**
 * Get sales for a specific customer within the tenant scope.
 * _Requirements: 3.1_
 */
export async function getCustomerSalesT(
  tenantId: string,
  customerId: string
): Promise<Sale[]> {
  const ref = collection(db, "tenants", tenantId, "sales");
  const q = query(
    ref,
    where("customerId", "==", customerId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Sale));
}

// ---------- Tenant-Scoped Receival Functions ----------

/**
 * Add a new receival scoped to the given tenant.
 * _Requirements: 3.1_
 */
export async function addReceivalT(
  tenantId: string,
  data: ReceivalFormData,
  userId: string
): Promise<string> {
  const ref = collection(db, "tenants", tenantId, "receivals");
  const docRef = await addDoc(ref, {
    ...data,
    createdBy: userId,
    createdAt: data.date ? Timestamp.fromDate(new Date(data.date)) : serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Update an existing receival in the tenant scope.
 * _Requirements: 3.1_
 */
export async function updateReceivalT(
  tenantId: string,
  id: string,
  data: Partial<ReceivalFormData>
): Promise<void> {
  const docRef = doc(db, "tenants", tenantId, "receivals", id);
  const updateData: Record<string, unknown> = { ...data };
  if (data.date) {
    updateData.createdAt = Timestamp.fromDate(new Date(data.date));
  }
  await updateDoc(docRef, updateData);
}

/**
 * Delete a receival from the tenant scope.
 * _Requirements: 3.1_
 */
export async function deleteReceivalT(
  tenantId: string,
  id: string
): Promise<void> {
  const docRef = doc(db, "tenants", tenantId, "receivals", id);
  await deleteDoc(docRef);
}

/**
 * Get a single receival by ID within the tenant scope.
 * _Requirements: 3.1_
 */
export async function getReceivalT(
  tenantId: string,
  id: string
): Promise<Receival | null> {
  const docRef = doc(db, "tenants", tenantId, "receivals", id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Receival;
}

/**
 * Get all receivals for the given tenant.
 * _Requirements: 3.1_
 */
export async function getAllReceivalsT(tenantId: string): Promise<Receival[]> {
  const ref = collection(db, "tenants", tenantId, "receivals");
  const q = query(ref, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Receival));
}

/**
 * Get receivals within a date range for the given tenant.
 * _Requirements: 3.1_
 */
export async function getReceivalsByDateRangeT(
  tenantId: string,
  start: Date,
  end: Date
): Promise<Receival[]> {
  const ref = collection(db, "tenants", tenantId, "receivals");
  const q = query(
    ref,
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<=", Timestamp.fromDate(end)),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Receival));
}

/**
 * Get receivals for a specific date string (YYYY-MM-DD) within the tenant scope.
 * _Requirements: 3.1_
 */
export async function getReceivalsByDateStrT(
  tenantId: string,
  dateStr: string
): Promise<Receival[]> {
  const ref = collection(db, "tenants", tenantId, "receivals");
  const q = query(ref, where("date", "==", dateStr));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Receival));
}

/**
 * Get unique truck numbers used in receivals for the given tenant.
 * _Requirements: 3.1_
 */
export async function getUniqueTruckNumbersT(tenantId: string): Promise<string[]> {
  const all = await getAllReceivalsT(tenantId);
  const set = new Set<string>();
  all.forEach((r) => {
    if (r.truckNumber && r.truckNumber.trim() !== "") {
      set.add(r.truckNumber.trim().toUpperCase());
    }
  });
  return Array.from(set).sort();
}

// ---------- Tenant-Scoped Weekly Notes Functions ----------

/**
 * Save or update a note for a specific week within the tenant scope.
 * _Requirements: 3.1_
 */
export async function saveWeeklyNoteT(
  tenantId: string,
  weekKey: string,
  note: string,
  userId: string
): Promise<void> {
  const docRef = doc(db, "tenants", tenantId, "weeklyNotes", weekKey);
  await setDoc(docRef, {
    note,
    createdBy: userId,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get all weekly notes for the given tenant.
 * _Requirements: 3.1_
 */
export async function getWeeklyNotesT(tenantId: string): Promise<WeeklyNote[]> {
  const ref = collection(db, "tenants", tenantId, "weeklyNotes");
  const q = query(ref);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as WeeklyNote));
}

/**
 * Delete a weekly note for the given tenant.
 * _Requirements: 3.1_
 */
export async function deleteWeeklyNoteT(
  tenantId: string,
  weekKey: string
): Promise<void> {
  await deleteDoc(doc(db, "tenants", tenantId, "weeklyNotes", weekKey));
}

// ---------- Tenant-Scoped User / Member Functions ----------

/**
 * Get all members of the given tenant.
 * _Requirements: 3.1, 6.1_
 */
export async function getTenantMembers(tenantId: string): Promise<TenantMember[]> {
  const ref = collection(db, "tenants", tenantId, "users");
  const q = query(ref, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() } as TenantMember));
}

/**
 * Update fields on a tenant member document.
 * _Requirements: 3.1, 6.1_
 */
export async function updateTenantMember(
  tenantId: string,
  uid: string,
  data: Partial<TenantMember>
): Promise<void> {
  const docRef = doc(db, "tenants", tenantId, "users", uid);
  await updateDoc(docRef, data as Record<string, unknown>);
}

/**
 * Get a single tenant member by UID.
 * Returns null if the user is not a member of the tenant.
 * _Requirements: 3.1, 6.1_
 */
export async function getTenantMember(
  tenantId: string,
  uid: string
): Promise<TenantMember | null> {
  const docRef = doc(db, "tenants", tenantId, "users", uid);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() } as TenantMember;
}


export const tenantCollection = (
  tenantId: string,
  collectionName: string
) => {
  return collection(db, "tenants", tenantId, collectionName);
};

export const tenantDoc = (
  tenantId: string,
  collectionName: string,
  id: string
) => {
  return doc(db, "tenants", tenantId, collectionName, id);
};

export const tenantSaleRef = (
  tenantId: string,
  saleId: string
) => {
  return doc(db, "tenants", tenantId, "sales", saleId);
};

export const tenantSaleLinesCollection = (
  tenantId: string,
  saleId: string
) => {
  return collection(
    db,
    "tenants",
    tenantId,
    "sales",
    saleId,
    "saleLines"
  );
};