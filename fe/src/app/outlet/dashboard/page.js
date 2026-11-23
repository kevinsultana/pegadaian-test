'use client';

import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Radio,
  Sliders,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Box
} from 'lucide-react';
import Link from 'next/link';

export default function OutletDashboardPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold uppercase mb-3">
              <Radio className="w-4 h-4" />
              <span>Outlet Hub Vault (RFID Multi-Antenna)</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Vault Cabang Pegadaian (Outlet)
            </h1>
            <p className="text-slate-500 text-sm mt-1 max-w-2xl leading-relaxed">
              Node vault cabang dengan teknologi deteksi RFID real-time. Setiap keping emas yang dikirim dari HO akan di-tag RFID saat penerimaan dan dipantau di slot matrix visual.
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Modul Outlet Hub Siap Diintegrasikan</h2>
              <p className="text-xs text-slate-500">
                Sesuai rencana kerja terpadu per modul, fitur master data user, lokasi HO & Outlet, lemari besi, kapasitas laci, dan autentikasi telah aktif dan terhubung ke backend database.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div className="font-bold text-slate-900 flex items-center gap-2 mb-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>Master Data Terpusat</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Super Admin dapat mendaftarkan outlet baru dan menugaskan petugas cabang dengan peran RBAC spesifik.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div className="font-bold text-slate-900 flex items-center gap-2 mb-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>PO Permintaan Emas</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Outlet dapat memesan kebutuhan emas ke HO, stok di lemari HO otomatis terkunci saat diproses.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div className="font-bold text-slate-900 flex items-center gap-2 mb-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>Tagging RFID & Tebusan</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Alur penerimaan barang di outlet dengan input tag RFID (otomatis/manual) dan tebusan nasabah.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
