'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Package,
  Search,
  Filter,
  QrCode,
  Radio,
  Layers,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  Eye,
  X,
  Coins,
  Scale,
  Building2,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Download,
  Check,
  Tag,
  Clock,
  ArrowRight,
} from 'lucide-react';

export default function OutletInventoryPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({
    totalItems: 0,
    totalWeight: 0,
    totalEstimatedValue: 0,
    rfidTaggedCount: 0,
    rfidUntaggedCount: 0,
    byBrand: {},
    byWeight: {},
    byCabinet: {},
  });
  const [locationInfo, setLocationInfo] = useState(null);
  const [cabinetsList, setCabinetsList] = useState([]);

  // Super Admin Location Switcher
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [outletLocations, setOutletLocations] = useState([]);
  const [selectedOutletId, setSelectedOutletId] = useState('');

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [filterBrand, setFilterBrand] = useState('ALL');
  const [filterWeight, setFilterWeight] = useState('ALL');
  const [filterCabinet, setFilterCabinet] = useState('ALL');
  const [filterRfid, setFilterRfid] = useState('ALL');

  // Detail Modal State
  const [detailModal, setDetailModal] = useState({
    isOpen: false,
    item: null,
    loading: false,
  });

  // Copy feedback state
  const [copiedId, setCopiedId] = useState(null);

  // Fetch Outlets for Super Admin
  const fetchLocations = async () => {
    try {
      const res = await apiRequest('/master/locations');
      const allLocs = res.data?.locations || (Array.isArray(res.data) ? res.data : []);
      const outletsOnly = allLocs.filter((l) => l.type === 'OUTLET_HUB');
      setOutletLocations(outletsOnly);
      if (outletsOnly.length > 0 && !selectedOutletId) {
        setSelectedOutletId(outletsOnly[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch locations:', err);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchLocations();
    }
  }, [isSuperAdmin]);

  // Fetch Inventory Data
  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      if (filterBrand !== 'ALL') params.brand = filterBrand;
      if (filterWeight !== 'ALL') params.weight = filterWeight;
      if (filterCabinet !== 'ALL') params.cabinetCode = filterCabinet;
      if (filterRfid !== 'ALL') params.rfidStatus = filterRfid;

      if (isSuperAdmin && selectedOutletId) {
        params.outletLocationId = selectedOutletId;
      }

      const res = await apiRequest('/outlet/inventory', { params });
      if (res && res.data) {
        setItems(res.data.items || []);
        setStats(res.data.stats || {});
        setLocationInfo(res.data.location || null);
        setCabinetsList(res.data.cabinets || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat inventori emas cabang');
    } finally {
      setLoading(false);
    }
  }, [search, filterBrand, filterWeight, filterCabinet, filterRfid, isSuperAdmin, selectedOutletId]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Handle Open Detail Modal
  const handleOpenDetail = async (item) => {
    setDetailModal({ isOpen: true, item, loading: true });
    try {
      const res = await apiRequest(`/outlet/inventory/${item.id}`);
      if (res && res.data?.item) {
        setDetailModal({ isOpen: true, item: res.data.item, loading: false });
      } else {
        setDetailModal((prev) => ({ ...prev, loading: false }));
      }
    } catch (err) {
      console.error('Failed to fetch item history detail:', err);
      setDetailModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(`Tersalin: ${text}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearch('');
    setFilterBrand('ALL');
    setFilterWeight('ALL');
    setFilterCabinet('ALL');
    setFilterRfid('ALL');
  };

  const hasActiveFilters = search || filterBrand !== 'ALL' || filterWeight !== 'ALL' || filterCabinet !== 'ALL' || filterRfid !== 'ALL';

  // Format Currency
  const formatRupiah = (val) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        {/* Header & Breadcrumb */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 tracking-wider uppercase mb-1">
                <span>OUTLET / CABANG</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span>INVENTORI & BRANKAS</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                <Package className="w-7 h-7 text-emerald-600" />
                Inventori Emas Cabang (Smart Vault)
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Monitoring real-time seluruh stok fisik keping emas, koordinat baki RFID, dan spesifikasi karat di brankas outlet.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Location Switcher for Super Admin */}
              {isSuperAdmin && outletLocations.length > 0 && (
                <div className="flex items-center gap-2 bg-emerald-50/80 px-3 py-1.5 rounded-xl border border-emerald-200/80">
                  <Building2 className="w-4 h-4 text-emerald-700" />
                  <label htmlFor="outletSelect" className="text-xs font-bold text-emerald-900">
                    Lokasi:
                  </label>
                  <select
                    id="outletSelect"
                    value={selectedOutletId}
                    onChange={(e) => setSelectedOutletId(e.target.value)}
                    className="bg-white text-xs font-semibold text-emerald-900 border border-emerald-300 rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    {outletLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quick Actions */}
              <button
                onClick={fetchInventory}
                disabled={loading}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition duration-150 active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh Data
              </button>

              <Link
                href="/outlet/cabinets"
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition duration-150 active:scale-95"
              >
                <Layers className="w-3.5 h-3.5" />
                Peta Lemari & Laci RFID
              </Link>
            </div>
          </div>
        </div>

        {/* Top 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Keping Emas */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:border-emerald-200 transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Keping Emas</p>
                <h3 className="text-3xl font-extrabold text-slate-900 mt-1">
                  {stats.totalItems || 0}
                  <span className="text-sm font-semibold text-slate-500 ml-1.5">Keping</span>
                </h3>
              </div>
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 group-hover:scale-110 transition">
                <Coins className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md">
                <CheckCircle2 className="w-3 h-3" />
                Tersimpan di Brankas
              </span>
              <span>di {locationInfo?.name || 'Cabang'}</span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500" />
          </div>

          {/* Card 2: Total Berat Gram */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:border-emerald-200 transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Berat Fisik</p>
                <h3 className="text-3xl font-extrabold text-slate-900 mt-1">
                  {(stats.totalWeight || 0).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                  <span className="text-sm font-semibold text-slate-500 ml-1.5">Gram</span>
                </h3>
              </div>
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition">
                <Scale className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <span className="text-slate-600 font-medium">
                Rata-rata: {stats.totalItems ? (stats.totalWeight / stats.totalItems).toFixed(1) : 0} g / keping
              </span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500" />
          </div>

          {/* Card 3: Estimasi Nilai Emas */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:border-emerald-200 transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Estimasi Nilai Emas</p>
                <h3 className="text-2xl font-extrabold text-slate-900 mt-1">
                  {formatRupiah(stats.totalEstimatedValue)}
                </h3>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition">
                <Sparkles className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <span className="text-slate-500">Standar Acuan: Rp 1.450.000 / g</span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500" />
          </div>

          {/* Card 4: Sensor RFID Tagged */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:border-emerald-200 transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status Sensor RFID</p>
                <h3 className="text-3xl font-extrabold text-slate-900 mt-1">
                  {stats.rfidTaggedCount || 0}
                  <span className="text-sm font-semibold text-slate-400"> / {stats.totalItems || 0}</span>
                </h3>
              </div>
              <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 group-hover:scale-110 transition">
                <Radio className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {stats.totalItems ? Math.round((stats.rfidTaggedCount / stats.totalItems) * 100) : 0}% Terpantau UHF
              </span>
              {stats.rfidUntaggedCount > 0 && (
                <span className="text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-md">
                  {stats.rfidUntaggedCount} Menunggu Pairing
                </span>
              )}
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500" />
          </div>
        </div>

        {/* Brand & Weight Breakdown Badges */}
        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Brand:</span>
            {Object.entries(stats.byBrand || {}).map(([brandName, count]) => (
              <button
                key={brandName}
                onClick={() => setFilterBrand(filterBrand === brandName ? 'ALL' : brandName)}
                className={`text-xs px-2.5 py-1 rounded-lg font-bold border transition ${
                  filterBrand === brandName
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
                }`}
              >
                {brandName} <span className="opacity-80 font-normal">({count})</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Kategori Berat:</span>
            {Object.entries(stats.byWeight || {}).map(([weightStr, count]) => (
              <button
                key={weightStr}
                onClick={() => {
                  const numWeight = weightStr.replace('g', '');
                  setFilterWeight(filterWeight === numWeight ? 'ALL' : numWeight);
                }}
                className={`text-xs px-2.5 py-1 rounded-lg font-bold border transition ${
                  filterWeight === weightStr.replace('g', '')
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-amber-300'
                }`}
              >
                {weightStr} <span className="opacity-80 font-normal">({count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="lg:col-span-2 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari Serial No, RFID EPC, Brand, atau Posisi..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-slate-800 transition"
              />
            </div>

            {/* Filter Lemari */}
            <div>
              <select
                value={filterCabinet}
                onChange={(e) => setFilterCabinet(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none text-slate-700 font-medium"
              >
                <option value="ALL">Semua Lemari Brankas</option>
                {cabinetsList.map((cab) => (
                  <option key={cab.id} value={cab.code}>
                    {cab.code} - {cab.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Status RFID */}
            <div>
              <select
                value={filterRfid}
                onChange={(e) => setFilterRfid(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none text-slate-700 font-medium"
              >
                <option value="ALL">Semua Status RFID</option>
                <option value="TAGGED">RFID Tagged (Aktif)</option>
                <option value="UNTAGGED">Belum Pairing RFID</option>
              </select>
            </div>

            {/* Reset Filter Button */}
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition"
                >
                  <X className="w-3.5 h-3.5" />
                  Reset Filter
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Inventory Table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Daftar Keping Emas Cabang
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {items.length} keping ditemukan
                </span>
              </h2>
            </div>
            <div className="text-xs text-slate-400">
              Menampilkan stok fisik keping emas di <strong className="text-slate-700">{locationInfo?.name || 'Cabang'}</strong>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-12 text-center">No</th>
                  <th className="py-3.5 px-4">Serial Number</th>
                  <th className="py-3.5 px-4">Brand & Karat</th>
                  <th className="py-3.5 px-4 text-center">Berat</th>
                  <th className="py-3.5 px-4">Posisi Penyimpanan</th>
                  <th className="py-3.5 px-4">Tag RFID (EPC)</th>
                  <th className="py-3.5 px-4 text-center">Status Sensor</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                      Memuat daftar inventori emas cabang...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <div className="max-w-xs mx-auto space-y-2">
                        <Package className="w-10 h-10 mx-auto text-slate-300" />
                        <p className="font-bold text-slate-700">Tidak ada keping emas ditemukan</p>
                        <p className="text-xs text-slate-400">
                          {hasActiveFilters
                            ? 'Coba ubah kata kunci pencarian atau reset filter untuk melihat semua keping.'
                            : 'Belum ada emas yang disimpan di outlet ini. Buat PO ke HO terlebih dahulu.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => (
                    <tr
                      key={it.id}
                      className="hover:bg-slate-50/80 transition duration-150 group"
                    >
                      {/* No */}
                      <td className="py-3.5 px-4 text-center text-slate-400 font-medium">
                        {idx + 1}
                      </td>

                      {/* Serial Number */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 group-hover:text-emerald-700 transition">
                            {it.id}
                          </span>
                          <button
                            onClick={() => copyToClipboard(it.id, it.id)}
                            title="Salin Serial Number"
                            className="p-1 text-slate-400 hover:text-emerald-600 rounded hover:bg-slate-100 transition"
                          >
                            {copiedId === it.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Brand & Karat */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="inline-block px-2 py-0.5 rounded font-extrabold text-[11px] bg-amber-50 text-amber-900 border border-amber-200">
                            {it.brand}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500">
                            {it.purity || '999.9'} (24K)
                          </span>
                        </div>
                      </td>

                      {/* Berat */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block font-extrabold text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800">
                          {it.weight}g
                        </span>
                      </td>

                      {/* Posisi Penyimpanan */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-bold text-slate-800">
                            <Layers className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            <span>{it.cabinet?.code || 'LEMARI-01'}</span>
                            <span className="text-slate-300">›</span>
                            <span className="text-slate-600">{it.drawer?.name || 'Laci'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              Slot: {it.slotPosition || 'R1-01'}
                            </span>
                            {it.drawer?.rfidAntenna && (
                              <span className="text-slate-400">
                                Antena: {it.drawer.rfidAntenna}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Tag RFID (EPC) */}
                      <td className="py-3.5 px-4">
                        {it.rfidTag ? (
                          <div className="flex items-center gap-1.5">
                            <Radio className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                            <span className="font-mono text-xs font-semibold text-purple-950 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/80">
                              {it.rfidTag}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <AlertCircle className="w-3 h-3" />
                            Belum Ada RFID
                          </span>
                        )}
                      </td>

                      {/* Status Sensor */}
                      <td className="py-3.5 px-4 text-center">
                        {it.rfidTag ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Terdeteksi UHF
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            Manual
                          </span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleOpenDetail(it)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition active:scale-95"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Detail & QR
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="px-6 py-3.5 bg-slate-50/75 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
            <div>
              Total <strong className="text-slate-800">{items.length} keping emas</strong> di inventori cabang{' '}
              <strong className="text-slate-800">{locationInfo?.name}</strong>
            </div>
            <div className="flex items-center gap-4">
              <span>
                Total Berat:{' '}
                <strong className="text-slate-800">
                  {items.reduce((acc, it) => acc + (it.weight || 0), 0).toFixed(1)}g
                </strong>
              </span>
              <span>
                Estimasi:{' '}
                <strong className="text-emerald-700 font-bold">
                  {formatRupiah(items.reduce((acc, it) => acc + (it.weight || 0), 0) * 1450000)}
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* Modal Detail & QR Code Keping Emas */}
        {detailModal.isOpen && detailModal.item && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto space-y-5">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Detail Keping Emas & Kartu Identitas
                    </h3>
                    <p className="text-xs text-slate-400">
                      SN: {detailModal.item.id} • {detailModal.item.brand} {detailModal.item.weight}g
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDetailModal({ isOpen: false, item: null, loading: false })}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* QR Code & Identification Box */}
              <div className="bg-gradient-to-br from-amber-50/50 via-white to-emerald-50/40 p-5 rounded-2xl border border-amber-200/60 flex flex-col items-center text-center space-y-3">
                {detailModal.item.qrDataUrl ? (
                  <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={detailModal.item.qrDataUrl}
                      alt={`QR Code ${detailModal.item.id}`}
                      className="w-40 h-40 object-contain mx-auto"
                    />
                  </div>
                ) : (
                  <div className="w-40 h-40 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                    <QrCode className="w-12 h-12" />
                  </div>
                )}

                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Serial Number Keping
                  </span>
                  <div className="flex items-center justify-center gap-2 mt-0.5">
                    <span className="text-lg font-mono font-extrabold text-slate-900">
                      {detailModal.item.id}
                    </span>
                    <button
                      onClick={() => copyToClipboard(detailModal.item.id, 'modal-id')}
                      className="p-1 text-slate-400 hover:text-emerald-600 rounded transition"
                      title="Salin SN"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* RFID Tag Badge */}
                <div className="w-full bg-white p-3 rounded-xl border border-purple-200 flex items-center justify-between text-left">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-purple-600" />
                    <div>
                      <p className="text-[10px] font-bold text-purple-900 uppercase">Tag RFID (EPC Tag)</p>
                      <p className="font-mono text-xs font-extrabold text-purple-950">
                        {detailModal.item.rfidTag || 'Belum Terpasang Tag RFID'}
                      </p>
                    </div>
                  </div>
                  {detailModal.item.rfidTag && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                      922.5 MHz
                    </span>
                  )}
                </div>
              </div>

              {/* Specifications Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Brand Emas</span>
                  <span className="font-bold text-slate-900 text-sm">{detailModal.item.brand}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Berat & Kadar</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {detailModal.item.weight} Gram ({detailModal.item.purity || '999.9'})
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Lemari & Laci Vault</span>
                  <span className="font-bold text-slate-900">
                    {detailModal.item.cabinet?.code || detailModal.item.drawer?.slot?.cabinet?.code || 'CAB-OUTLET-01'}
                  </span>
                  <span className="text-slate-500 block text-[11px]">
                    {detailModal.item.drawer?.name || 'Laci Utama'}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Koordinat Baki</span>
                  <span className="font-bold text-emerald-700 text-sm">
                    Slot {detailModal.item.slotPosition || 'R1-01'}
                  </span>
                  {detailModal.item.drawer?.rfidAntenna && (
                    <span className="text-slate-400 block text-[11px]">
                      {detailModal.item.drawer.rfidAntenna}
                    </span>
                  )}
                </div>
              </div>

              {/* Movement / History Timeline */}
              {detailModal.item.histories && detailModal.item.histories.length > 0 && (
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    Riwayat Pergerakan Keping
                  </h4>
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {detailModal.item.histories.map((h, i) => (
                      <div key={h.id || i} className="text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-800">{h.event}</span>
                          <span className="text-slate-400">
                            {new Date(h.timestamp).toLocaleString('id-ID', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>
                        <p className="text-slate-600 text-[11px]">{h.details}</p>
                        <div className="text-[10px] text-slate-400">Oleh: {h.actor} ({h.locationCode})</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <Link
                  href={`/outlet/cabinets/${detailModal.item.cabinet?.code || detailModal.item.drawer?.slot?.cabinet?.code || 'CAB-OUTLET-JKT-10D'}`}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Lihat di Grid Lemari
                </Link>
                <button
                  onClick={() => setDetailModal({ isOpen: false, item: null, loading: false })}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
