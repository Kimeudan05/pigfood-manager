"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { canDo } from "@/lib/rbac";
import { addReceival } from "@/lib/firestore";
import { useToast } from "@/contexts/ToastContext";
import { ArrowLeft, Save, Truck, Scale, FileText } from "lucide-react";
import { ReceivalSource } from "@/types";

export default function NewReceivalPage() {
  const router = useRouter();
  const { appUser } = useAuth();
  const { addToast } = useToast();

  const canAdd = canDo(appUser, "canAddSale") || canDo(appUser, "canViewReports");

  useEffect(() => {
    if (!appUser) return;
    if (!canAdd) {
      router.replace("/receivals");
      addToast("warning", "You don't have permission to add receivals.");
    }
  }, [appUser, canAdd, router, addToast]);

  const [saving, setSaving] = useState(false);
  
  // Form State
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState<ReceivalSource>("Pigfood Truck");
  const [truckNumber, setTruckNumber] = useState("");
  const [weightIn, setWeightIn] = useState<number | "">("");
  const [weightOut, setWeightOut] = useState<number | "">("");
  const [netWeight, setNetWeight] = useState<number | "">("");
  const [notes, setNotes] = useState("");

  // Fractions
  const [cookedFood, setCookedFood] = useState<number | "">("");
  const [bread, setBread] = useState<number | "">("");
  const [meat, setMeat] = useState<number | "">("");
  const [bones, setBones] = useState<number | "">("");
  const [veggies, setVeggies] = useState<number | "">("");

  // Auto-calculate Net Weight for Pigfood Truck
  useEffect(() => {
    if (source === "Pigfood Truck") {
      if (typeof weightIn === "number" && typeof weightOut === "number") {
        setNetWeight(Math.max(0, weightIn - weightOut));
      } else {
        setNetWeight("");
      }
    }
  }, [weightIn, weightOut, source]);

  // Reset truck-specific fields when source changes
  useEffect(() => {
    if (source !== "Pigfood Truck") {
      setWeightIn("");
      setWeightOut("");
    }
    if (source === "Conveyor (Local)") {
      setTruckNumber("");
    }
  }, [source]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!appUser) return;
    
    if (netWeight === "" || netWeight <= 0) {
      addToast("error", "Please provide a valid net weight.");
      return;
    }

    setSaving(true);
    try {
      const dataToSubmit: any = {
        date,
        source,
        netWeight: Number(netWeight),
        cookedFood: Number(cookedFood) || 0,
        bread: Number(bread) || 0,
        meat: Number(meat) || 0,
        bones: Number(bones) || 0,
        veggies: Number(veggies) || 0,
      };

      if (truckNumber.trim()) dataToSubmit.truckNumber = truckNumber.trim();
      if (weightIn !== "") dataToSubmit.weightIn = weightIn;
      if (weightOut !== "") dataToSubmit.weightOut = weightOut;
      if (notes.trim()) dataToSubmit.notes = notes.trim();

      await addReceival(dataToSubmit, appUser.uid);
      
      addToast("success", "Receival logged successfully!");
      router.push("/receivals");
    } catch (err) {
      console.error(err);
      addToast("error", "Failed to log receival. Please try again.");
      setSaving(false);
    }
  }

  if (!appUser || !canAdd) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      <div className="flex items-center gap-4">
        <Link
          href="/receivals"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm hover:bg-gray-50 hover:text-emerald-600 transition-colors dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-emerald-400"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            Log New Receival
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Record incoming supply weights</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/50 space-y-6">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-4 dark:border-gray-700/50">
            <Truck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Supply Details</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Source</label>
              <select
                required
                value={source}
                onChange={(e) => setSource(e.target.value as ReceivalSource)}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option value="Pigfood Truck">Pigfood Truck (Onsite)</option>
                <option value="Normal Truck">Normal Truck (Weigh Pigfood Only)</option>
                <option value="Conveyor (Local)">Conveyor (Local Sorted)</option>
              </select>
            </div>

            {source !== "Conveyor (Local)" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Truck Number (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. KCA 123Z"
                  value={truckNumber}
                  onChange={(e) => setTruckNumber(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white uppercase"
                />
              </div>
            )}
          </div>
        </div>

        {/* Weights */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/50 space-y-6">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-4 dark:border-gray-700/50">
            <Scale className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Weights</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {source === "Pigfood Truck" && (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Weight In (KG)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="Total Truck Weight"
                    value={weightIn}
                    onChange={(e) => setWeightIn(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Weight Out (KG)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="Empty Truck Weight"
                    value={weightOut}
                    onChange={(e) => setWeightOut(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5 md:col-span-1">
              <label className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Net Weight (KG)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                required
                placeholder={source === "Pigfood Truck" ? "Auto-calculated" : "Enter total pigfood weight"}
                value={netWeight}
                onChange={(e) => setNetWeight(e.target.value === "" ? "" : Number(e.target.value))}
                readOnly={source === "Pigfood Truck"}
                className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 font-bold ${
                  source === "Pigfood Truck"
                    ? "bg-gray-50 border-gray-200 text-gray-700 cursor-not-allowed dark:bg-gray-800/80 dark:border-gray-700 dark:text-gray-300"
                    : "bg-white border-emerald-300 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20 dark:bg-gray-800 dark:border-emerald-600 dark:text-white"
                }`}
              />
              {source === "Pigfood Truck" && (
                <p className="text-xs text-gray-500 mt-1">Automatically computed: Weight In - Weight Out</p>
              )}
            </div>
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
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving || (source === "Pigfood Truck" && netWeight === "")}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            Save Receival
          </button>
        </div>
      </form>
    </div>
  );
}
