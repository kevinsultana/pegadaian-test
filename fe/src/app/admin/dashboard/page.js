'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { apiRequest } from '@/lib/api';
import {
  Users,
  MapPin,
  Layers,
  ShieldCheck,
  Plus,
  ArrowRight,
  TrendingUp,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalLocations: 0,
    totalCabinets: 32,
    recentAudits: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [usersRes, locsRes, auditRes] = await Promise.all([
          apiRequest('/master/users'),
          apiRequest('/master/locations'),
          apiRequest('/audit/logs?limit=5'),
        ]);

        setStats({
          totalUsers: usersRes.data?.total || 0,
          totalLocations: locsRes.data?.locations?.length || 0,
          totalCabinets: 32,
          recentAudits: auditRes.data?.logs || [],
        });
      } catch (err) {
        console.error('Failed to load admin stats:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Welcome Banner */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold uppercase mb-3">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Super Admin Master Control</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              Pusat Kendali Vault Enterprise
            </h1>
            <p className="text-slate-600 text-sm mt-1 max-w-2xl leading-relaxed">
              Kelola master user RBAC, lokasi sentral Head Office & seluruh Outlet Hub, lemari besi, kapasitas laci, dan pantau log audit transaksi secara menyeluruh.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/admin/users"
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah User Baru</span>
            </Link>
            <Link
              href="/admin/locations"
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs border border-slate-200 flex items-center gap-2 transition-colors shadow-sm"
            >
              <MapPin className="w-4 h-4 text-slate-500" />
              <span>Master Lokasi</span>
            </Link>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Pengguna</span>
              <div className="p-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">{stats.totalUsers} User</div>
            <div className="text-[11px] text-emerald-700 font-medium mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Multi-Role Terproteksi RBAC</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Titik Vault</span>
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                <MapPin className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">{stats.totalLocations} Titik</div>
            <div className="text-[11px] text-slate-500 mt-1">1 HO Central + Outlet Hub</div>
          </div>

          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Lemari Vault HO</span>
              <div className="p-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-100">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">{stats.totalCabinets} Lemari</div>
            <div className="text-[11px] text-amber-700 font-medium mt-1">8 Slot Modular / Lemari</div>
          </div>

          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status Arsitektur</span>
              <div className="p-2 bg-purple-50 text-purple-700 rounded-xl border border-purple-100">
                <Activity className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">Active</div>
            <div className="text-[11px] text-slate-500 mt-1">QR (HO) & RFID (Outlet)</div>
          </div>
        </div>

        {/* Quick Navigations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 flex items-center justify-between mb-2">
              <span>Manajemen Modul Head Office (HO)</span>
              <Link href="/ho/dashboard" className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1">
                Buka HO <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </h2>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Pusat penyimpanan utama seluruh stok emas Pegadaian dengan penandaan QR Code per lemari, per laci, dan per keping emas.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/ho/cabinets"
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-emerald-600 hover:bg-white text-xs font-medium transition-all shadow-sm group"
              >
                <div className="font-bold text-slate-900 group-hover:text-emerald-700">Lemari & Slot Modular</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Konfigurasi Modular Slot & Laci</div>
              </Link>
              <Link
                href="/ho/inventory"
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-emerald-600 hover:bg-white text-xs font-medium transition-all shadow-sm group"
              >
                <div className="font-bold text-slate-900 group-hover:text-emerald-700">Inbound & Cetak QR</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Pendaftaran keping emas masuk HO</div>
              </Link>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 flex items-center justify-between mb-2">
              <span>Audit Trail Log Terakhir</span>
              <Link href="/audit" className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1">
                Lihat Semua <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </h2>
            <div className="space-y-2 mt-4">
              {stats.recentAudits.length === 0 ? (
                <div className="text-xs text-slate-400 italic py-4 text-center">Belum ada riwayat audit terbaru</div>
              ) : (
                stats.recentAudits.map((log) => (
                  <div key={log.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                    <div className="truncate mr-2">
                      <span className="font-semibold text-emerald-700 font-mono text-[11px] mr-2">[{log.action}]</span>
                      <span className="text-slate-700">{log.details}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 font-medium">{log.actor}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
