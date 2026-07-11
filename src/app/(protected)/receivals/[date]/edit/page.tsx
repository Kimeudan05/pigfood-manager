"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { canDo } from "@/lib/rbac";
import { getReceivalsByDateStr, addReceival, updateReceival, deleteReceival, getUniqueTruckNumbers } from "@/lib/firestore";
import { useToast } from "@/contexts/ToastContext";
import { ArrowLeft, Save, Truck, Scale, FileText } from "lucide-react";
import { ReceivalSource, Receival } from "@/types";
import { PageSpinner } from "@/components/ui/Spinner";

export default function EditDailyReceivalPage() {
  const router = useRouter();
  const params = useParams();
  const dateParam = params.date as string;
  const { appUser } = useAuth();
  const { addToast } = useToast();

  const canEdit = canDo(appUser, "canAddSale") || canDo(appUser, "canViewReports");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Existing data tracking
  const [existingPigfood, setExistingPigfood] = useState<Receival | null>(null);
  const [existingConveyor, setExistingConveyor] = useState<Receival | null>(null);
  const [existingNormalTruck, setExistingNormalTruck] = useState<Receival | null>(null);

  // Form State
  const [date, setDate] = useState(dateParam);
  
  // Pigfood Truck State
  const [hasPigfood, setHasPigfood] = useState(false);
  const [pfTruckNumber, setPfTruckNumber] = useState("");
  const [pfWeightIn, setPfWeightIn] = useState<number | "">("");
  const [pfWeightOut, setPfWeightOut] = useState<number | "">("");
  const [pfNetWeight, setPfNetWeight] = useState<number | "">("");

  // Conveyor State
  const [hasConveyor, setHasConveyor] = useState(false);
  const [convNetWeight, setConvNetWeight] = useState<number | "">("");

  // Normal Truck State (for weighing pigfood only)
  const [hasNormalTruck, setHasNormalTruck] = useState(false);
  const [ntTruckNumber, setNtTruckNumber] = useState("");
  const [ntNetWeight, setNtNetWeight] = useState<number | "">("");

  // Fractions (Combined for the day)
  const [cookedFood, setCookedFood] = useState<number | "">("");
  const [bread, setBread] = useState<number | "">("");
  const [meat, setMeat] = useState<number | "">("");
  const [bones, setBones] = useState<number | "">("");
  const [veggies, setVeggies] = useState<number | "">("");
  
  const [notes, setNotes] = useState("");
  const [availableTrucks, setAvailableTrucks] = useState<string[]>([]);

  useEffect(() => {
    if (!appUser) return;
    if (!canEdit) {
      router.replace("/receivals");
      addToast("warning", "You don't have permission to edit receivals.");
      return;
    }

    async function load() {
      try {
        const [receivals, trucks] = await Promise.all([
          getReceivalsByDateStr(dateParam),
          getUniqueTruckNumbers()
        ]);
        
        setAvailableTrucks(trucks);

        if (receivals.length === 0) {
          addToast("error", "No logs found for this date.");
          router.replace("/receivals");
          return;
        }

        // Initialize from existing
        let fCooked = 0, fBread = 0, fMeat = 0, fBones = 0, fVeggies = 0;
        let dayNotes = "";

        receivals.forEach(r => {
          if (r.source === "Pigfood Truck") {
            setExistingPigfood(r);
            setHasPigfood(true);
            setPfTruckNumber(r.truckNumber || "");
            setPfWeightIn(r.weightIn ?? "");
            setPfWeightOut(r.weightOut ?? "");
            setPfNetWeight(r.netWeight ?? "");
          } else if (r.source === "Conveyor (Local)") {
            setExistingConveyor(r);
            setHasConveyor(true);
            setConvNetWeight(r.netWeight ?? "");
          } else if (r.source === "Normal Truck") {
            setExistingNormalTruck(r);
            setHasNormalTruck(true);
            setNtTruckNumber(r.truckNumber || "");
            setNtNetWeight(r.netWeight ?? "");
          }

          // Accumulate fractions (though usually only one source has them)
          fCooked += (r.cookedFood || 0);
          fBread += (r.bread || 0);
          fMeat += (r.meat || 0);
          fBones += (r.bones || 0);
          fVeggies += (r.veggies || 0);
          if (r.notes) dayNotes += r.notes + "\n";
        });

        setCookedFood(fCooked || "");
        setBread(fBread || "");
        setMeat(fMeat || "");
        setBones(fBones || "");
        setVeggies(fVeggies || "");
        setNotes(dayNotes.trim());

      } catch (err) {
        console.error("Load Error:", err);
        addToast("error", "Error loading daily log");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [appUser, canEdit, router, addToast, dateParam]);

  // Auto-calculate Pigfood Net Weight
  useEffect(() => {
    if (typeof pfWeightIn === "number" && typeof pfWeightOut === "number") {
      setPfNetWeight(Math.max(0, pfWeightIn - pfWeightOut));
    }
  }, [pfWeightIn, pfWeightOut]);

  const totalDailyWeight = (Number(pfNetWeight) || 0) + (Number(convNetWeight) || 0) + (Number(ntNetWeight) || 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!appUser) return;
    
    if (!hasPigfood && !hasConveyor && !hasNormalTruck) {
      addToast("error", "Please enable at least one supply source.");
      return;
    }

    setSaving(true);
    try {
      const promises: Promise<any>[] = [];

      // Helper to process a source
      const processSource = async (
        hasSource: boolean,
        existing: Receival | null,
        sourceType: ReceivalSource,
        netW: number | "",
        wIn: number | "",
        wOut: number | "",
        tNum: string,
        applyFractions: boolean
      ) => {
        if (!hasSource) {
          if (existing) promises.push(deleteReceival(existing.id));
          return;
        }

        if (netW === "" || netW <= 0) return;

        const data: any = {
          date,
          source: sourceType,
          netWeight: Number(netW),
          cookedFood: applyFractions ? (Number(cookedFood) || 0) : 0,
          bread: applyFractions ? (Number(bread) || 0) : 0,
          meat: applyFractions ? (Number(meat) || 0) : 0,
          bones: applyFractions ? (Number(bones) || 0) : 0,
          veggies: applyFractions ? (Number(veggies) || 0) : 0,
          notes: applyFractions ? notes : "",
        };

        if (tNum.trim()) data.truckNumber = tNum.trim().toUpperCase();
        else data.truckNumber = null;

        if (wIn !== "") data.weightIn = wIn;
        if (wOut !== "") data.weightOut = wOut;

        if (existing) {
          promises.push(updateReceival(existing.id, data));
        } else {
          promises.push(addReceival(data, appUser.uid));
        }
      };

      // Prioritize who gets fractions/notes
      let pfFractions = false, convFractions = false, ntFractions = false;
      if (hasPigfood) pfFractions = true;
      else if (hasConveyor) convFractions = true;
      else if (hasNormalTruck) ntFractions = true;

      await processSource(hasPigfood, existingPigfood, "Pigfood Truck", pfNetWeight, pfWeightIn, pfWeightOut, pfTruckNumber, pfFractions);
      await processSource(hasConveyor, existingConveyor, "Conveyor (Local)", convNetWeight, "", "", "", convFractions);
      await processSource(hasNormalTruck, existingNormalTruck, "Normal Truck", ntNetWeight, "", "", ntTruckNumber, ntFractions);

      await Promise.all(promises);

      addToast("success", "Daily log updated successfully!");
      router.push("/receivals");
    } catch (err) {
      console.error(err);
      addToast("error", "Failed to update log. Please try again.");
      setSaving(false);
    }
  }

  if (!appUser || !canEdit) return null;
  if (loading) return <PageSpinner />;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Autocomplete Datalist */}
      <datalist id="truck-list">
        {availableTrucks.map(t => <option key={t} value={t} />)}
      </datalist>

      <div className="flex items-center gap-4">
        <Link
          href="/receivals"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm hover:bg-gray-50 hover:text-emerald-600 transition-colors dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-emerald-400"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            Edit Daily Log
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Update supply details for {date}</p>
        </div>
        <div className="text-right hidden sm:block">
           <span className="text-sm text-gray-500">Daily Total</span>
           <p className="text-xl font-bold text-emerald-600">{totalDailyWeight.toLocaleString()} kg</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Date Section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/50">
           <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
           <input
             type="date"
             required
             readOnly
             value={date}
             className="w-full mt-1.5 rounded-xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm cursor-not-allowed dark:border-gray-600 dark:bg-gray-900 dark:text-white"
           />
           <p className="text-xs text-gray-500 mt-2">Date cannot be changed. Delete and recreate if needed.</p>
        </div>

        {/* Sources Selection & Details */}
        <div className="space-y-4">
           {/* Pigfood Truck */}
           <div className={`rounded-2xl border transition-all ${hasPigfood ? 'border-emerald-300 shadow-md bg-white dark:border-emerald-700/50 dark:bg-gray-800/50' : 'border-gray-200 bg-gray-50/50 dark:border-gray-700/50 dark:bg-gray-900/50'}`}>
              <div className="p-4 border-b border-gray-100 dark:border-gray-700/50 flex items-center gap-3">
                 <input type="checkbox" id="hasPigfood" checked={hasPigfood} onChange={e => setHasPigfood(e.target.checked)} className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                 <label htmlFor="hasPigfood" className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 cursor-pointer select-none">
                    <Truck className="h-5 w-5 text-emerald-600" /> Pigfood Truck (Onsite)
                 </label>
              </div>
              
              {hasPigfood && (
                 <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Truck Number</label>
                      <input type="text" list="truck-list" placeholder="e.g. KCA 123Z" value={pfTruckNumber} onChange={e => setPfTruckNumber(e.target.value.toUpperCase())} className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white uppercase" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Weight In (KG)</label>
                      <input type="number" min="0" step="0.1" value={pfWeightIn} onChange={e => setPfWeightIn(e.target.value === "" ? "" : Number(e.target.value))} className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Weight Out (KG)</label>
                      <input type="number" min="0" step="0.1" value={pfWeightOut} onChange={e => setPfWeightOut(e.target.value === "" ? "" : Number(e.target.value))} className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
                    </div>
                    <div className="md:col-span-3">
                      <label className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Net Weight (KG)</label>
                      <input type="number" required={hasPigfood} readOnly value={pfNetWeight} className="w-full mt-1.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-bold text-gray-700 cursor-not-allowed dark:bg-gray-800/80 dark:border-gray-700 dark:text-gray-300" />
                      <p className="text-xs text-gray-500 mt-1">Automatically computed: Weight In - Weight Out</p>
                    </div>
                 </div>
              )}
           </div>

           {/* Conveyor */}
           <div className={`rounded-2xl border transition-all ${hasConveyor ? 'border-emerald-300 shadow-md bg-white dark:border-emerald-700/50 dark:bg-gray-800/50' : 'border-gray-200 bg-gray-50/50 dark:border-gray-700/50 dark:bg-gray-900/50'}`}>
              <div className="p-4 border-b border-gray-100 dark:border-gray-700/50 flex items-center gap-3">
                 <input type="checkbox" id="hasConveyor" checked={hasConveyor} onChange={e => setHasConveyor(e.target.checked)} className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                 <label htmlFor="hasConveyor" className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 cursor-pointer select-none">
                    <Scale className="h-5 w-5 text-emerald-600" /> Conveyor (Local Sorted)
                 </label>
              </div>
              
              {hasConveyor && (
                 <div className="p-6 animate-fade-in">
                    <label className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Net Weight (KG)</label>
                    <input type="number" min="0" step="0.1" required={hasConveyor} value={convNetWeight} onChange={e => setConvNetWeight(e.target.value === "" ? "" : Number(e.target.value))} className="w-full mt-1.5 rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-emerald-600 dark:bg-gray-800 dark:text-white" />
                 </div>
              )}
           </div>

           {/* Normal Truck */}
           <div className={`rounded-2xl border transition-all ${hasNormalTruck ? 'border-blue-300 shadow-md bg-white dark:border-blue-700/50 dark:bg-gray-800/50' : 'border-gray-200 bg-gray-50/50 dark:border-gray-700/50 dark:bg-gray-900/50'}`}>
              <div className="p-4 border-b border-gray-100 dark:border-gray-700/50 flex items-center gap-3">
                 <input type="checkbox" id="hasNormalTruck" checked={hasNormalTruck} onChange={e => setHasNormalTruck(e.target.checked)} className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                 <label htmlFor="hasNormalTruck" className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 cursor-pointer select-none">
                    <Truck className="h-5 w-5 text-blue-500" /> Normal Truck (Pigfood Weight Only)
                 </label>
              </div>
              
              {hasNormalTruck && (
                 <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Truck Number</label>
                      <input type="text" list="truck-list" placeholder="e.g. KCA 123Z" value={ntTruckNumber} onChange={e => setNtTruckNumber(e.target.value.toUpperCase())} className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white uppercase" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-blue-700 dark:text-blue-400">Net Weight (KG)</label>
                      <input type="number" min="0" step="0.1" required={hasNormalTruck} value={ntNetWeight} onChange={e => setNtNetWeight(e.target.value === "" ? "" : Number(e.target.value))} className="w-full rounded-xl border border-blue-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-blue-600 dark:bg-gray-800 dark:text-white" />
                    </div>
                 </div>
              )}
           </div>
        </div>

        {/* Fractions */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/50 space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-700/50">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Fractions (Optional Breakdown)</h2>
            </div>
            <span className="text-xs text-gray-400">Estimated KG</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Cooked Food</label>
              <input type="number" min="0" value={cookedFood} onChange={(e) => setCookedFood(e.target.value === "" ? "" : Number(e.target.value))} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Bread</label>
              <input type="number" min="0" value={bread} onChange={(e) => setBread(e.target.value === "" ? "" : Number(e.target.value))} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Meat</label>
              <input type="number" min="0" value={meat} onChange={(e) => setMeat(e.target.value === "" ? "" : Number(e.target.value))} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Bones</label>
              <input type="number" min="0" value={bones} onChange={(e) => setBones(e.target.value === "" ? "" : Number(e.target.value))} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Veggies</label>
              <input type="number" min="0" value={veggies} onChange={(e) => setVeggies(e.target.value === "" ? "" : Number(e.target.value))} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
            </div>
          </div>
          
          <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-gray-700/50">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Notes / Issues with supply</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>

        {/* Action */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
          <div className="sm:hidden w-full text-center p-4 bg-gray-50 rounded-xl dark:bg-gray-800">
             <span className="text-sm text-gray-500 block mb-1">Daily Total</span>
             <span className="text-2xl font-bold text-emerald-600">{totalDailyWeight.toLocaleString()} kg</span>
          </div>
          
          <div className="w-full sm:w-auto flex-1"></div>
          
          <button
            type="submit"
            disabled={saving || (!hasPigfood && !hasConveyor && !hasNormalTruck)}
            className="w-full sm:w-auto inline-flex justify-center items-center gap-2 rounded-xl bg-emerald-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            Update Daily Log
          </button>
        </div>
      </form>
    </div>
  );
}
