'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { apiRequest } from '@/lib/api';
import {
  Building2,
  Layers,
  QrCode,
  PackageCheck,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  Boxes,
  Loader2,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';
import Link from 'next/link';

export default function HODashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHOData() {
      try {
        const [cabRes, invRes] = await Promise.all([
          apiRequest('/ho/cabinets'),
          apiRequest('/ho/stats'),
        ]);

        const cabs = cabRes.data?.cabinets || (Array.isArray(cabRes.data) ? cabRes.data : []);
        setStats({
          cabinets: cabs,
          totalCabinets: cabs.length || 32,
          inventorySummary: invRes.data || {},
        });
      } catch (err) {
        console.error('Failed to load HO dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    }
    loadHOData();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Banner */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold uppercase mb-3">
              <Building2 className="w-4 h-4 text-emerald-700" />
              <span>Head Office (HO) Central Vault</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              Vault HO Central Pegadaian
            </h1>
            <p className="text-slate-600 text-sm mt-1 max-w-2xl leading-relaxed">
              Pusat penyimpanan & distribusi emas dengan teknologi penandaan QR Code presisi. Kelola lemari besi, kapasitas laci modular, penerimaan emas batangan (Inbound), serta picking PO outlet.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/ho/cabinets"
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Kelola Lemari & Laci</span>
            </Link>
            <Link
              href="/ho/inventory"
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs border border-slate-200 flex items-center gap-2 transition-colors shadow-sm"
            >
              <QrCode className="w-4 h-4 text-slate-500" />
              <span>Inventori & QR Emas</span>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Lemari Besi</span>
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {stats?.totalCabinets || 32} Lemari
            </div>
            <div className="text-[11px] text-emerald-700 font-medium mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>8 Slot Modular per Unit</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Keping Emas di HO</span>
              <div className="p-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-100">
                <Boxes className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-amber-800 mt-2">
              {stats?.inventorySummary?.totalPieces || stats?.inventorySummary?.totalCount || 0} Keping
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Total Berat: <strong className="text-slate-700">{stats?.inventorySummary?.totalWeightGram || stats?.inventorySummary?.totalWeightGrams || 0} g</strong>
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Terkunci Proses PO</span>
              <div className="p-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
                <PackageCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {stats?.inventorySummary?.allocatedPoCount || 0} Keping
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Berat PO: <strong className="text-slate-700">{stats?.inventorySummary?.allocatedWeightGram || 0} g</strong>
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Penandaan Vault</span>
              <div className="p-2 bg-purple-50 text-purple-700 rounded-xl border border-purple-100">
                <QrCode className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">QR System</div>
            <div className="text-[11px] text-slate-500 mt-1">Lemari, Laci & Keping Emas</div>
          </div>
        </div>

        {/* Cabinets Overview Preview Grid */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-700" />
                <span>Status Lemari Besi Vault HO Central</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Setiap lemari memiliki 8 slot yang dapat dikonfigurasi modular (1 Laci Besar atau 8 Laci Kecil Cluster).
              </p>
            </div>
            <Link
              href="/ho/cabinets"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 self-start sm:self-auto"
            >
              <span>Buka Konfigurasi Lemari & Laci</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-700 mb-2" />
              <span className="text-xs">Memuat data lemari...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {stats?.cabinets?.map((cab) => {
                const occ = cab.metrics?.totalOccupied ?? cab.totalOccupied ?? 0;

                return (
                  <Link
                    key={cab.id}
                    href={`/ho/cabinets/${cab.code}`}
                    className={`p-3 rounded-xl transition-all group border ${
                      occ > 0
                        ? 'bg-amber-50/50 border-amber-200 hover:border-amber-300 hover:shadow-sm'
                        : 'bg-slate-50/60 hover:bg-white border-slate-200 hover:border-emerald-500 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-bold font-mono ${occ > 0 ? 'text-amber-800' : 'text-slate-700'}`}>
                        {cab.code.replace('HO-CAB-', 'CAB-')}
                      </span>
                      <QrCode className={`w-3.5 h-3.5 ${occ > 0 ? 'text-amber-700' : 'text-slate-400'}`} />
                    </div>
                    <div className="mt-2 flex items-baseline justify-between text-[10px]">
                      <span className="text-slate-400">Terisi:</span>
                      <span className={`font-bold ${occ > 0 ? 'text-amber-800' : 'text-slate-600'}`}>{occ} pcs</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
