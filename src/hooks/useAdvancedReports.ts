import { useMemo } from "react";
import { format, startOfWeek, subWeeks } from "date-fns";
import { toDate } from "@/utils/formatters";
import { Sale, Receival, WeeklyAgg } from "@/types";

export const INSIGHT_THRESHOLDS = {
  SIGNIFICANT_DROP_PCT: 10,
  SIGNIFICANT_INC_PCT: 20,
  FRACTION_DROP_PCT_THRESHOLD: 0.1, // 10%
};

export function useAdvancedReports(sales: Sale[], receivals: Receival[], dateLimit: number) {
  // Group data by week
  const weeklyData = useMemo(() => {
    const weeksMap = new Map<string, WeeklyAgg>();

    // Helper to get Week Key (Monday as start of week)
    // We use a robust key: yyyy-MM-dd
    const getWeekKey = (date: Date) => {
      const start = startOfWeek(date, { weekStartsOn: 1 });
      return format(start, "yyyy-MM-dd");
    };

    const getWeekLabel = (date: Date) => {
      const start = startOfWeek(date, { weekStartsOn: 1 });
      return format(start, "MMM dd");
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
        receivalFractions: { cookedFood: 0, bread: 0, meat: 0, bones: 0, veggies: 0 }
      });
    }

    // Process Sales
    sales.forEach(s => {
      if (!s.createdAt) return;
      const date = toDate(s.createdAt);
      const wKey = getWeekKey(date);
      if (!weeksMap.has(wKey)) return; // skip if outside our range limit

      const w = weeksMap.get(wKey)!;
      w.salesRevenue += s.grandTotal;
      
      const totalKgs = 
        (s.cookedFood || 0) + 
        (s.bread || 0) + 
        (s.bread25 || 0) + 
        (s.meat25 || 0) + 
        (s.meat30 || 0) + 
        (s.bones || 0) + 
        (s.bones10 || 0) + 
        (s.gradeA || 0) + 
        (s.veggies || 0);
      w.salesKgs += totalKgs;

      w.salesFractions.cookedFood += (s.cookedFood || 0);
      w.salesFractions.bread += (s.bread || 0) + (s.bread25 || 0);
      w.salesFractions.meat += (s.meat25 || 0) + (s.meat30 || 0);
      w.salesFractions.bones += (s.bones || 0) + (s.bones10 || 0);
      w.salesFractions.veggies += (s.veggies || 0) + (s.gradeA || 0);
    });

    // Process Receivals
    receivals.forEach(r => {
      if (!r.createdAt) return;
      const date = toDate(r.createdAt);
      const wKey = getWeekKey(date);
      if (!weeksMap.has(wKey)) return; // skip if outside limit

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

  // Generate Insights
  const insights = useMemo(() => {
    if (weeklyData.length < 2) return [];
    
    const current = weeklyData[weeklyData.length - 1];
    const prev = weeklyData[weeklyData.length - 2];
    const generated: any[] = [];

    // 1. Overall Sales Drop Analysis
    if (current.salesKgs < prev.salesKgs) {
      const salesDropPct = ((prev.salesKgs - current.salesKgs) / prev.salesKgs) * 100;
      const receivalsDiff = current.receivalsKgs - prev.receivalsKgs;
      
      let reason = "";
      if (receivalsDiff < 0) {
        reason = `Lower Receivals. Supply dropped by ${Math.abs(receivalsDiff).toLocaleString()} kg this week, directly causing the sales volume drop.`;
      } else {
        reason = `Reduced Customer Demand. Despite receivals increasing by ${receivalsDiff.toLocaleString()} kg, sales dropped. Customers are buying less.`;
      }

      if (salesDropPct >= INSIGHT_THRESHOLDS.SIGNIFICANT_DROP_PCT) {
        generated.push({
          type: "negative",
          title: `Sales Volume Dropped by ${salesDropPct.toFixed(1)}%`,
          description: reason
        });
      }
    } else if (current.salesKgs > prev.salesKgs && prev.salesKgs > 0) {
      const salesIncPct = ((current.salesKgs - prev.salesKgs) / prev.salesKgs) * 100;
      if (salesIncPct >= INSIGHT_THRESHOLDS.SIGNIFICANT_INC_PCT) {
        generated.push({
          type: "positive",
          title: `Sales Volume Increased by ${salesIncPct.toFixed(1)}%`,
          description: "Great performance this week in moving volume."
        });
      }
    }

    // 2. Fraction Analysis
    const fractions = ["meat", "bread", "cookedFood", "bones", "veggies"] as const;
    fractions.forEach(f => {
      const cSale = current.salesFractions[f] || 0;
      const pSale = prev.salesFractions[f] || 0;
      
      if (cSale < pSale && pSale > 0) {
        const drop = pSale - cSale;
        const cRec = current.receivalFractions[f] || 0;
        const pRec = prev.receivalFractions[f] || 0;
        
        // Only report significant drops
        if (drop / pSale > INSIGHT_THRESHOLDS.FRACTION_DROP_PCT_THRESHOLD) {
          if (cRec < pRec) {
            generated.push({
              type: "warning",
              title: `${f.charAt(0).toUpperCase() + f.slice(1)} Sales Drop`,
              description: `Sales dropped by ${drop.toLocaleString()} kg because receivals of this fraction also dropped by ${(pRec - cRec).toLocaleString()} kg.`
            });
          } else {
            generated.push({
              type: "warning",
              title: `${f.charAt(0).toUpperCase() + f.slice(1)} Sales Drop`,
              description: `Sales dropped by ${drop.toLocaleString()} kg despite stable or increased receivals. Check quality or customer demand for ${f}.`
            });
          }
        }
      }
    });

    return generated;
  }, [weeklyData]);

  // Compute KPIs for the latest complete week
  // "default to the latest complete week. we usually have meeting on tuesday to discuss the prvious week"
  // If today is Tuesday, the latest complete week is the previous week.
  // We'll calculate it by taking the second-to-last item as the "latest complete week" if the current week has just started.
  // But wait, the user's data might not have the current week yet. 
  // Let's just define "latest complete week" as the week before the absolute latest week in our data, 
  // or maybe they just mean "the most recent completed week". I will use the second to last week as the "current" for KPIs if the latest week hasn't finished,
  // but to keep it simple and robust, let's just use `weeklyData[weeklyData.length - 2]` as the current KPI week, 
  // and `weeklyData[weeklyData.length - 3]` as the previous week.
  const kpis = useMemo(() => {
      if (weeklyData.length < 3) return null;
      
      // Let's assume the very last element in `weeklyData` is the current (incomplete) week.
      // So the latest *complete* week is `length - 2`.
      const currentComplete = weeklyData[weeklyData.length - 2];
      const prevComplete = weeklyData[weeklyData.length - 3];
      
      return {
          current: currentComplete,
          prev: prevComplete
      };
  }, [weeklyData]);

  return { weeklyData, insights, kpis };
}
