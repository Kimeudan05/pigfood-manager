import { describe, it, expect } from "vitest";
import { calculateTotals, getEmptySaleItems, generateSaleNumber, PRODUCTS } from "../pricing";
import { SaleItems } from "@/types";

describe("Pricing Utility", () => {
  describe("PRODUCTS Configuration", () => {
    it("should contain the correct product list and prices", () => {
      expect(PRODUCTS).toBeInstanceOf(Array);
      expect(PRODUCTS.length).toBe(8);

      const cookedFood = PRODUCTS.find((p) => p.key === "cookedFood");
      expect(cookedFood).toBeDefined();
      expect(cookedFood?.price).toBe(20);

      const meat25 = PRODUCTS.find((p) => p.key === "meat25");
      expect(meat25?.price).toBe(25);

      const veggies = PRODUCTS.find((p) => p.key === "veggies");
      expect(veggies?.price).toBe(6);
    });
  });

  describe("calculateTotals", () => {
    it("should calculate correct totals for zero items", () => {
      const emptyItems = getEmptySaleItems();
      const totals = calculateTotals(emptyItems);

      expect(totals.cookedFoodTotal).toBe(0);
      expect(totals.breadTotal).toBe(0);
      expect(totals.meat25Total).toBe(0);
      expect(totals.meat30Total).toBe(0);
      expect(totals.bonesTotal).toBe(0);
      expect(totals.gradeATotal).toBe(0);
      expect(totals.veggiesTotal).toBe(0);
      expect(totals.grandTotal).toBe(0);
    });

    it("should calculate correct totals for single items", () => {
      const items: SaleItems = {
        cookedFood: 2, // 2 * 20 = 40
        bread: 1,      // 1 * 20 = 20
        meat25: 4,     // 4 * 25 = 100
        meat30: 0,
        bones: 10,     // 10 * 15 = 150
        bones10: 0,
        gradeA: 5,     // 5 * 5  = 25
        veggies: 3,    // 3 * 6  = 18
      };

      const totals = calculateTotals(items);

      expect(totals.cookedFoodTotal).toBe(40);
      expect(totals.breadTotal).toBe(20);
      expect(totals.meat25Total).toBe(100);
      expect(totals.meat30Total).toBe(0);
      expect(totals.bonesTotal).toBe(150);
      expect(totals.gradeATotal).toBe(25);
      expect(totals.veggiesTotal).toBe(18);
      
      const expectedGrandTotal = 40 + 20 + 100 + 0 + 150 + 25 + 18;
      expect(totals.grandTotal).toBe(expectedGrandTotal);
    });
  });

  describe("getEmptySaleItems", () => {
    it("should return an object with all quantities set to zero", () => {
      const empty = getEmptySaleItems();
      expect(empty).toEqual({
        cookedFood: 0,
        bread:      0,
        meat25:     0,
        meat30:     0,
        bones:      0,
        bones10:    0,
        gradeA:     0,
        veggies:    0,
      });
    });
  });

  describe("generateSaleNumber", () => {
    it("should generate a unique sale number in the TK-YYMMDD-RANDOM format", () => {
      const saleNum = generateSaleNumber();
      expect(saleNum).toMatch(/^TK-\d{6}-\d{4}$/);
    });

    it("should generate unique values on subsequent calls", () => {
      const saleNum1 = generateSaleNumber();
      const saleNum2 = generateSaleNumber();
      // While there is a tiny probability of collision in random suffix,
      // it should almost never be equal.
      expect(saleNum1).not.toBe(saleNum2);
    });
  });
});
