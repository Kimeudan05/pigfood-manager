import { useMemo } from "react";
import { format, startOfWeek, subWeeks, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { toDate, formatCurrency } from "@/utils/formatters";
import { Sale, Receival, WeeklyAgg, PeriodAgg } from "@/types";

export const INSIGHT_THRESHOLDS = {
  SIGNIFICANT_DROP_PCT: 10,
  SIGNIFICANT_INC_PCT: 20,
  FRACTION_DROP_PCT_THRESHOLD: 0.1, // 10%
  PRICE_CHANGE_PCT_THRESHOLD: 5,    // 5% avg price change to flag
};

// ─────────────────────────────────────────────
// Helper: aggregate all sales/receivals within a date range into one PeriodAgg
// ─────────────────────────────────────────────
export function aggregatePeriod(
  sales: Sale[],
  receivals: Receival[],
  startDate: Date,
  endDate: Date,
  label: string
): PeriodAgg {
  const period: PeriodAgg = {
    label,
    startDate,
    endDate,
    salesRevenue: 0,
    salesKgs: 0,
    receivalsKgs: 0,
    pigfoodTruckKgs: 0,
    normalTruckKgs: 0,
    conveyorKgs: 0,
    salesFractions: { cookedFood: 0, bread: 0, meat: 0, bones: 0, veggies: 0 },
    salesRevenueFractions: { cookedFood: 0, bread: 0, meat: 0, bones: 0, veggies: 0 },
    receivalFractions: { cookedFood: 0, bread: 0, meat: 0, bones: 0, veggies: 0 },
  };

  const interval = { start: startOfDay(startDate), end: endOfDay(endDate) };

  sales.forEach((s) => {
    if (!s.createdAt) return;
    const date = toDate(s.createdAt);
    if (!isWithinInterval(date, interval)) return;

    period.salesRevenue += s.grandTotal;

    const totalKgs =
      (s.cookedFood || 0) +
      (s.bread || 0) +
      (s.bread25 || 0) +
      (s.meat25 || 0) +
      (s.meat30 || 0) +
      (s.meat40 || 0) +
      (s.bones || 0) +
      (s.bones10 || 0) +
      (s.gradeA || 0) +
      (s.veggies || 0);
    period.salesKgs += totalKgs;

    period.salesFractions.cookedFood += s.cookedFood || 0;
    period.salesFractions.bread += (s.bread || 0) + (s.bread25 || 0);
    period.salesFractions.meat += (s.meat25 || 0) + (s.meat30 || 0) + (s.meat40 || 0);
    period.salesFractions.bones += (s.bones || 0) + (s.bones10 || 0);
    period.salesFractions.veggies += (s.veggies || 0) + (s.gradeA || 0);

    period.salesRevenueFractions.cookedFood += s.cookedFoodTotal || 0;
    period.salesRevenueFractions.bread += (s.breadTotal || 0) + (s.bread25Total || 0);
    period.salesRevenueFractions.meat +=
      (s.meat25Total || 0) + (s.meat30Total || 0) + (s.meat40Total || 0);
    period.salesRevenueFractions.bones += (s.bonesTotal || 0) + (s.bones10Total || 0);
    period.salesRevenueFractions.veggies += (s.veggiesTotal || 0) + (s.gradeATotal || 0);
  });

  receivals.forEach((r) => {
    if (!r.createdAt) return;
    const date = toDate(r.createdAt);
    if (!isWithinInterval(date, interval)) return;

    period.receivalsKgs += r.netWeight;

    if (r.source === "Pigfood Truck") period.pigfoodTruckKgs += r.netWeight;
    else if (r.source === "Normal Truck") period.normalTruckKgs += r.netWeight;
    else if (r.source === "Conveyor (Local)") period.conveyorKgs += r.netWeight;

    period.receivalFractions.cookedFood += r.cookedFood || 0;
    period.receivalFractions.bread += r.bread || 0;
    period.receivalFractions.meat += r.meat || 0;
    period.receivalFractions.bones += r.bones || 0;
    period.receivalFractions.veggies += r.veggies || 0;
  });

  return period;
}

// ─────────────────────────────────────────────
// Helper: generate comparison insights between two PeriodAgg blocks
// ─────────────────────────────────────────────
export function generateComparisonInsights(periodA: PeriodAgg, periodB: PeriodAgg) {
  const generated: any[] = [];

  // 1. Revenue comparison
  const revDiff = periodB.salesRevenue - periodA.salesRevenue;
  const revPct =
    periodA.salesRevenue > 0
      ? ((revDiff / periodA.salesRevenue) * 100).toFixed(1)
      : null;

  generated.push({
    type: revDiff >= 0 ? "positive" : "negative",
    title: `Revenue: ${revDiff >= 0 ? "+" : ""}${formatCurrency(revDiff)}${revPct ? ` (${revDiff >= 0 ? "+" : ""}${revPct}%)` : ""}`,
    description: `${periodA.label}: ${formatCurrency(periodA.salesRevenue)} → ${periodB.label}: ${formatCurrency(periodB.salesRevenue)}`,
  });

  // 2. Volume comparison
  const volDiff = periodB.salesKgs - periodA.salesKgs;
  const volPct =
    periodA.salesKgs > 0
      ? ((volDiff / periodA.salesKgs) * 100).toFixed(1)
      : null;

  generated.push({
    type: volDiff >= 0 ? "positive" : "negative",
    title: `Volume Sold: ${volDiff >= 0 ? "+" : ""}${volDiff.toLocaleString()} kg${volPct ? ` (${volDiff >= 0 ? "+" : ""}${volPct}%)` : ""}`,
    description: `${periodA.label}: ${periodA.salesKgs.toLocaleString()} kg → ${periodB.label}: ${periodB.salesKgs.toLocaleString()} kg`,
  });

  // 3. Per-fraction comparison with price change detection
  const fractions = ["meat", "bread", "cookedFood", "bones", "veggies"] as const;
  const fractionDetails: string[] = [];

  fractions.forEach((f) => {
    const aVol = periodA.salesFractions[f] || 0;
    const bVol = periodB.salesFractions[f] || 0;
    const aRev = periodA.salesRevenueFractions[f] || 0;
    const bRev = periodB.salesRevenueFractions[f] || 0;
    if (aVol === 0 && bVol === 0) return;

    const volChange = bVol - aVol;
    const revChange = bRev - aRev;

    const aAvgPrice = aVol > 0 ? aRev / aVol : 0;
    const bAvgPrice = bVol > 0 ? bRev / bVol : 0;
    const priceChangePct =
      aAvgPrice > 0 ? ((bAvgPrice - aAvgPrice) / aAvgPrice) * 100 : 0;

    const fName = f === "cookedFood" ? "Cooked Food" : f.charAt(0).toUpperCase() + f.slice(1);
    let detail = `${fName}: ${volChange >= 0 ? "+" : ""}${volChange.toLocaleString()} kg (Rev: ${revChange >= 0 ? "+" : ""}${formatCurrency(revChange)})`;

    if (Math.abs(priceChangePct) >= INSIGHT_THRESHOLDS.PRICE_CHANGE_PCT_THRESHOLD) {
      detail += ` ⚠️ Avg price: KES ${aAvgPrice.toFixed(0)} → ${bAvgPrice.toFixed(0)}/kg`;
    }

    fractionDetails.push(detail);
  });

  if (fractionDetails.length > 0) {
    generated.push({
      type: "info",
      title: "Fraction-by-Fraction Comparison",
      description: "",
      list: fractionDetails,
    });
  }

  // 4. Receivals comparison
  const recDiff = periodB.receivalsKgs - periodA.receivalsKgs;
  generated.push({
    type: "info",
    title: `Receivals: ${recDiff >= 0 ? "+" : ""}${recDiff.toLocaleString()} kg`,
    description: `${periodA.label}: ${periodA.receivalsKgs.toLocaleString()} kg → ${periodB.label}: ${periodB.receivalsKgs.toLocaleString()} kg`,
  });

  return generated;
}

// ─────────────────────────────────────────────
// Main Hook
// ─────────────────────────────────────────────
export function useAdvancedReports(sales: Sale[], receivals: Receival[], dateLimit: number) {
  // Group data by week
  const weeklyData = useMemo(() => {
    const weeksMap = new Map<string, WeeklyAgg>();

    // Helper to get Week Key (Monday as start of week)
    const getWeekKey = (date: Date) => {
      const start = startOfWeek(date, { weekStartsOn: 1 });
      return format(start, "yyyy-MM-dd");
    };

    // Initialize map with empty weeks for the last N weeks to ensure continuous X-axis
    const now = new Date();
    for (let i = dateLimit - 1; i >= 0; i--) {
      const wDate = subWeeks(now, i);
      const start = startOfWeek(wDate, { weekStartsOn: 1 });
      const wKey = format(start, "yyyy-MM-dd");
      const wLabel = format(start, "MMM dd");
      weeksMap.set(wKey, {
        weekKey: wKey,
        weekLabel: wLabel,
        timestamp: start.getTime(),
        salesRevenue: 0,
        salesKgs: 0,
        receivalsKgs: 0,
        pigfoodTruckKgs: 0,
        normalTruckKgs: 0,
        conveyorKgs: 0,
        salesFractions: { cookedFood: 0, bread: 0, meat: 0, bones: 0, veggies: 0 },
        salesRevenueFractions: { cookedFood: 0, bread: 0, meat: 0, bones: 0, veggies: 0 },
        receivalFractions: { cookedFood: 0, bread: 0, meat: 0, bones: 0, veggies: 0 },
      });
    }

    // Process Sales
    sales.forEach((s) => {
      if (!s.createdAt) return;
      const date = toDate(s.createdAt);
      const wKey = getWeekKey(date);
      if (!weeksMap.has(wKey)) return;

      const w = weeksMap.get(wKey)!;
      w.salesRevenue += s.grandTotal;

      const totalKgs =
        (s.cookedFood || 0) +
        (s.bread || 0) +
        (s.bread25 || 0) +
        (s.meat25 || 0) +
        (s.meat30 || 0) +
        (s.meat40 || 0) +
        (s.bones || 0) +
        (s.bones10 || 0) +
        (s.gradeA || 0) +
        (s.veggies || 0);
      w.salesKgs += totalKgs;

      w.salesFractions.cookedFood += s.cookedFood || 0;
      w.salesFractions.bread += (s.bread || 0) + (s.bread25 || 0);
      w.salesFractions.meat += (s.meat25 || 0) + (s.meat30 || 0) + (s.meat40 || 0);
      w.salesFractions.bones += (s.bones || 0) + (s.bones10 || 0);
      w.salesFractions.veggies += (s.veggies || 0) + (s.gradeA || 0);

      w.salesRevenueFractions.cookedFood += s.cookedFoodTotal || 0;
      w.salesRevenueFractions.bread += (s.breadTotal || 0) + (s.bread25Total || 0);
      w.salesRevenueFractions.meat +=
        (s.meat25Total || 0) + (s.meat30Total || 0) + (s.meat40Total || 0);
      w.salesRevenueFractions.bones += (s.bonesTotal || 0) + (s.bones10Total || 0);
      w.salesRevenueFractions.veggies += (s.veggiesTotal || 0) + (s.gradeATotal || 0);
    });

    // Process Receivals
    receivals.forEach((r) => {
      if (!r.createdAt) return;
      const date = toDate(r.createdAt);
      const wKey = getWeekKey(date);
      if (!weeksMap.has(wKey)) return;

      const w = weeksMap.get(wKey)!;
      w.receivalsKgs += r.netWeight;

      if (r.source === "Pigfood Truck") w.pigfoodTruckKgs += r.netWeight;
      else if (r.source === "Normal Truck") w.normalTruckKgs += r.netWeight;
      else if (r.source === "Conveyor (Local)") w.conveyorKgs += r.netWeight;

      w.receivalFractions.cookedFood += r.cookedFood || 0;
      w.receivalFractions.bread += r.bread || 0;
      w.receivalFractions.meat += r.meat || 0;
      w.receivalFractions.bones += r.bones || 0;
      w.receivalFractions.veggies += r.veggies || 0;
    });

    return Array.from(weeksMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [sales, receivals, dateLimit]);

  // Generate Insights (price-aware)
  const insights = useMemo(() => {
    if (weeklyData.length < 3) return [];

    // Compare second-to-last (latest complete) vs third-to-last
    const current = weeklyData[weeklyData.length - 2];
    const prev = weeklyData[weeklyData.length - 3];
    const generated: any[] = [];

    // 1. Overall Sales Volume / Revenue Analysis
    if (current.salesKgs < prev.salesKgs) {
      const salesDropPct = ((prev.salesKgs - current.salesKgs) / prev.salesKgs) * 100;
      const salesDropKg = prev.salesKgs - current.salesKgs;
      const revenueDiff = current.salesRevenue - prev.salesRevenue;
      const receivalsDiff = current.receivalsKgs - prev.receivalsKgs;

      let reason = "";
      if (receivalsDiff < 0) {
        reason = `Lower Receivals. Supply dropped by ${Math.abs(receivalsDiff).toLocaleString()} kg this week, directly causing the sales volume drop. Revenue ${revenueDiff < 0 ? "dropped" : "increased"} by ${formatCurrency(Math.abs(revenueDiff))}.`;
      } else {
        reason = `Reduced Customer Demand. Despite receivals increasing by ${receivalsDiff.toLocaleString()} kg, sales dropped. Customers are buying less. Revenue ${revenueDiff < 0 ? "dropped" : "increased"} by ${formatCurrency(Math.abs(revenueDiff))}.`;
      }

      generated.push({
        type: "negative",
        title: `Sales Volume Dropped by ${salesDropKg.toLocaleString()} kg (${salesDropPct.toFixed(1)}%)`,
        description: reason,
      });
    } else if (current.salesKgs > prev.salesKgs && prev.salesKgs > 0) {
      const salesIncPct = ((current.salesKgs - prev.salesKgs) / prev.salesKgs) * 100;
      const salesIncKg = current.salesKgs - prev.salesKgs;
      const revenueDiff = current.salesRevenue - prev.salesRevenue;

      generated.push({
        type: "positive",
        title: `Sales Volume Increased by ${salesIncKg.toLocaleString()} kg (${salesIncPct.toFixed(1)}%)`,
        description: `Great performance last week in moving volume. Revenue ${revenueDiff < 0 ? "dropped" : "increased"} by ${formatCurrency(Math.abs(revenueDiff))}.`,
      });
    }

    // 2. Price-Aware Fraction Analysis
    const fractions = ["meat", "bread", "cookedFood", "bones", "veggies"] as const;
    const fractionDetails: string[] = [];
    const priceChangeInsights: any[] = [];

    let bestFraction = { name: "", revDiff: -Infinity };
    let worstFraction = { name: "", revDiff: Infinity };

    fractions.forEach((f) => {
      const cVol = current.salesFractions[f] || 0;
      const pVol = prev.salesFractions[f] || 0;
      const volDiff = cVol - pVol;

      const cRev = current.salesRevenueFractions[f] || 0;
      const pRev = prev.salesRevenueFractions[f] || 0;
      const revDiff = cRev - pRev;

      // Effective average price per kg
      const cAvgPrice = cVol > 0 ? cRev / cVol : 0;
      const pAvgPrice = pVol > 0 ? pRev / pVol : 0;
      const priceChangePct =
        pAvgPrice > 0 ? ((cAvgPrice - pAvgPrice) / pAvgPrice) * 100 : 0;
      const hasPriceChange =
        Math.abs(priceChangePct) >= INSIGHT_THRESHOLDS.PRICE_CHANGE_PCT_THRESHOLD &&
        cVol > 0 && pVol > 0;

      const fName =
        f === "cookedFood"
          ? "Cooked Food"
          : f.charAt(0).toUpperCase() + f.slice(1);

      if (revDiff > bestFraction.revDiff) bestFraction = { name: fName, revDiff };
      if (revDiff < worstFraction.revDiff) worstFraction = { name: fName, revDiff };

      if (volDiff !== 0 || cVol > 0 || pVol > 0) {
        let detail = "";
        if (volDiff > 0) {
          detail = `${fName}: +${volDiff.toLocaleString()} kg (+ ${formatCurrency(revDiff)})`;
        } else if (volDiff < 0) {
          detail = `${fName}: ${volDiff.toLocaleString()} kg (- ${formatCurrency(Math.abs(revDiff))})`;
        } else if (cVol > 0 || pVol > 0) {
          detail = `${fName}: No volume change`;
        }

        if (hasPriceChange) {
          detail += ` ⚠️ Price: KES ${pAvgPrice.toFixed(0)} → ${cAvgPrice.toFixed(0)}/kg`;
        }

        if (detail) fractionDetails.push(detail);

        // Generate a separate warning insight card for significant price changes
        if (hasPriceChange) {
          const direction = priceChangePct > 0 ? "increased" : "decreased";
          const dirIcon = priceChangePct > 0 ? "📈" : "📉";
          priceChangeInsights.push({
            type: "warning",
            title: `${dirIcon} ${fName} price ${direction} by ${Math.abs(priceChangePct).toFixed(0)}%`,
            description:
              `Avg price changed from KES ${pAvgPrice.toFixed(0)}/kg → KES ${cAvgPrice.toFixed(0)}/kg. ` +
              `Volume: ${volDiff >= 0 ? "+" : ""}${volDiff.toLocaleString()} kg | ` +
              `Revenue impact: ${revDiff >= 0 ? "+" : ""}${formatCurrency(revDiff)}. ` +
              (revDiff > 0 && volDiff < 0
                ? "Revenue went up despite lower volume — driven by the higher price."
                : revDiff > 0 && volDiff >= 0
                ? "Both price and volume increased — strong performance."
                : revDiff < 0 && volDiff < 0
                ? "Both price and volume dropped — worth investigating."
                : ""),
          });
        }
      }
    });

    if (fractionDetails.length > 0) {
      let footerStr = "";
      if (bestFraction.revDiff > 0) {
        footerStr += `${bestFraction.name} was the best performer (+ ${formatCurrency(bestFraction.revDiff)}). `;
      }
      if (worstFraction.revDiff < 0) {
        footerStr += `${worstFraction.name} had the biggest drop (- ${formatCurrency(Math.abs(worstFraction.revDiff))}).`;
      }

      generated.push({
        type: "info",
        title: "Fraction Sales Breakdown",
        description: "",
        list: fractionDetails,
        footer: footerStr.trim(),
      });
    }

    // Insert price change warnings after the fraction breakdown
    generated.push(...priceChangeInsights);

    // 3. Source Quality / Receivals Comparison
    if (current.receivalsKgs > 0) {
      generated.push({
        type: "info",
        title: "Receival Sources Breakdown",
        description: `Total Receivals: ${current.receivalsKgs.toLocaleString()} kg. Pigfood Trucks: ${current.pigfoodTruckKgs.toLocaleString()} kg, Normal Trucks: ${current.normalTruckKgs.toLocaleString()} kg, Conveyor (Local): ${current.conveyorKgs.toLocaleString()} kg.`,
      });
    }

    return generated;
  }, [weeklyData]);

  // Compute KPIs for the latest complete week
  const kpis = useMemo(() => {
    if (weeklyData.length < 3) return null;

    // The last element is the current (possibly incomplete) week.
    // The second-to-last is the latest complete week.
    const currentComplete = weeklyData[weeklyData.length - 2];
    const prevComplete = weeklyData[weeklyData.length - 3];

    return {
      current: currentComplete,
      prev: prevComplete,
    };
  }, [weeklyData]);

  return { weeklyData, insights, kpis };
}
