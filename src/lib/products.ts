// ============================================
// StockSight — Product Catalog Service
// ============================================
// All operations are scoped to tenants/{tenantId}/products
// Requirements: 4.1, 4.2, 4.3, 4.4, 4.5

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Product, ProductFormData } from "@/types";
import { validateProduct } from "@/lib/validators";

// ---------- Helpers ----------

/**
 * Normalizes a product name to lowercase, trimmed form for case-insensitive
 * comparison (Req 4.2).
 */
export function normalizeProductName(name: string): string {
  return name.trim().toLowerCase();
}

/** Returns the products sub-collection reference for a tenant. */
function productsCollection(tenantId: string) {
  return collection(db, "tenants", tenantId, "products");
}

// ---------- Read ----------

/**
 * Returns all active products for a tenant, sorted alphabetically by name
 * (Req 4.3).
 */
export async function getActiveProducts(tenantId: string): Promise<Product[]> {
  const q = query(
    productsCollection(tenantId),
    where("isActive", "==", true),
    orderBy("name", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
}

/**
 * Returns all products (active and inactive) for a tenant, sorted
 * alphabetically by name.
 */
export async function getAllProducts(tenantId: string): Promise<Product[]> {
  const q = query(productsCollection(tenantId), orderBy("name", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
}

/**
 * Returns a single product by ID, or `null` if it does not exist.
 */
export async function getProduct(
  tenantId: string,
  id: string
): Promise<Product | null> {
  const ref = doc(db, "tenants", tenantId, "products", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Product;
}

// ---------- Uniqueness ----------

/**
 * Returns `true` when no other product in the tenant's catalog shares the
 * same normalized name (Req 4.2).
 *
 * Pass `excludeId` when editing a product to avoid a false conflict with its
 * own current name.
 */
export async function checkProductNameUnique(
  tenantId: string,
  name: string,
  excludeId?: string
): Promise<boolean> {
  const normalized = normalizeProductName(name);
  const snap = await getDocs(productsCollection(tenantId));
  for (const d of snap.docs) {
    // Skip the document being edited
    if (excludeId && d.id === excludeId) continue;
    const existing = normalizeProductName((d.data().name as string) ?? "");
    if (existing === normalized) return false;
  }
  return true;
}

// ---------- Write ----------

/**
 * Adds a new product to a tenant's catalog.
 *
 * @returns The Firestore document ID of the newly created product.
 * @throws `{ code: 'INVALID_PRODUCT' }` when field validation fails (Req 4.1).
 * @throws `{ code: 'DUPLICATE_NAME' }` when the name already exists in the
 *         catalog (case-insensitive) (Req 4.2).
 */
export async function addProduct(
  tenantId: string,
  data: ProductFormData,
  uid: string
): Promise<string> {
  if (!validateProduct(data)) {
    throw { code: "INVALID_PRODUCT" };
  }

  const isUnique = await checkProductNameUnique(tenantId, data.name);
  if (!isUnique) {
    throw { code: "DUPLICATE_NAME" };
  }

  const docRef = await addDoc(productsCollection(tenantId), {
    name: data.name.trim(),
    unit: data.unit,
    price: data.price,
    isActive: data.isActive,
    createdAt: serverTimestamp(),
    createdBy: uid,
  });

  return docRef.id;
}

/**
 * Updates one or more fields of an existing product.
 *
 * If `data.name` is provided and differs from the current name, a uniqueness
 * check is performed before writing (Req 4.2).
 *
 * @throws `{ code: 'DUPLICATE_NAME' }` when the updated name conflicts with
 *         another product in the tenant's catalog.
 */
export async function updateProduct(
  tenantId: string,
  id: string,
  data: Partial<ProductFormData>
): Promise<void> {
  if (data.name !== undefined) {
    const isUnique = await checkProductNameUnique(tenantId, data.name, id);
    if (!isUnique) {
      throw { code: "DUPLICATE_NAME" };
    }
  }

  const ref = doc(db, "tenants", tenantId, "products", id);
  const updateData: Record<string, unknown> = { ...data };

  // Trim name if present
  if (typeof updateData.name === "string") {
    updateData.name = (updateData.name as string).trim();
  }

  await updateDoc(ref, updateData);
}

/**
 * Toggles a product's active/inactive status (Req 4.5).
 */
export async function setProductActive(
  tenantId: string,
  id: string,
  isActive: boolean
): Promise<void> {
  const ref = doc(db, "tenants", tenantId, "products", id);
  await updateDoc(ref, { isActive });
}
