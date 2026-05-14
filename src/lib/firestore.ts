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
} from "firebase/firestore";
import { db } from "./firebase";
import { Customer, CustomerFormData, Sale, SaleFormData, SaleItems, SaleTotals } from "@/types";
import { calculateTotals, generateSaleNumber } from "@/utils/pricing";

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
    meat25: data.meat25,
    meat30: data.meat30,
    bones: data.bones,
    gradeA: data.gradeA,
    veggies: data.veggies,
  };

  const totals: SaleTotals = calculateTotals(items);
  const saleNumber = generateSaleNumber();

  const docRef = await addDoc(salesRef, {
    saleNumber,
    customerId: data.customerId,
    customerName: data.customerName,
    ...items,
    ...totals,
    createdBy: userId,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

/** Update an existing sale */
export async function updateSale(id: string, data: SaleFormData): Promise<void> {
  const items: SaleItems = {
    cookedFood: data.cookedFood,
    bread: data.bread,
    meat25: data.meat25,
    meat30: data.meat30,
    bones: data.bones,
    gradeA: data.gradeA,
    veggies: data.veggies,
  };

  const totals: SaleTotals = calculateTotals(items);
  const docRef = doc(db, "sales", id);

  await updateDoc(docRef, {
    customerId: data.customerId,
    customerName: data.customerName,
    ...items,
    ...totals,
  });
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
