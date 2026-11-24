'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  History,
  Search,
  Filter,
  Radio,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Clock,
  RefreshCw,
  Eye,
  X,
  Coins,
  Scale,
  Building2,
  ChevronRight,
  Sparkles,
  Truck,
  UserCheck,
  FileText,
  Calendar,
  Package,
  QrCode,
  MapPin,
  ArrowRight,
  ExternalLink,
  Sliders,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';

const STATUS_CONFIG = {
  IN_HO: {
    label: 'Tersimpan di Vault HO',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  ALLOCATED_PO: {
    label: 'Dialokasikan untuk PO',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
  },
  IN_TRANSIT: {
    label: 'Dalam Pengiriman (In Transit)',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    dot: 'bg-blue-500',
  },
  IN_OUTLET: {
    label: 'Tersimpan di Vault Cabang',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    dot: 'bg-purple-500',
  },
  SOLD: {
    label: 'Terjual ke Nasabah',
    color: 'bg-slate-100 text-slate-700 border-slate-300',
    dot: 'bg-slate-500',
  },
  DITEBUS_NASABAH: {
    label: 'Ditebus Nasabah',
    color: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    dot: 'bg-cyan-500',
  },
};

export default function GoldTraceabilityView({ scope = 'HO' }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isHO = scope === 'HO';

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [brandFilter, setBrandFilter] = useState('ALL');

  // Outlet locations for filtering
  const [locations, setLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');

  // Selected item modal
  const [selectedItem, setSelectedItem] = useState(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [itemDetail, setItemDetail] = useState(null);
  const [activeDetailTab, setActiveDetailTab] = useState('MILESTONES'); // 'MILESTONES' | 'RAW'

  // Fetch Locations
  const fetchLocations = async () => {
    try {
      const res = await apiRequest('/master/locations');
      const all = res.data?.locations || (Array.isArray(res.data) ? res.data : []);
      setLocations(all);
      if (!isHO && !selectedLocationId) {
        const defaultOutlet = all.find((l) => l.type === 'OUTLET_HUB');
        if (defaultOutlet) setSelectedLocationId(defaultOutlet.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  // Fetch Items List
  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        scope,
        search,
        status: statusFilter,
        brand: brandFilter,
      };

      if (!isHO) {
        params.outletLocationId = isSuperAdmin ? selectedLocationId : user?.locationId;
      } else if (selectedLocationId) {
        params.outletLocationId = selectedLocationId;
      }

      const res = await apiRequest('/traceability/items', { params });
      if (res && res.data) {
        setItems(res.data.items || []);
      }
    } catch (err) {
      console.error('Fetch Traceability Items Error:', err);
      toast.error('Gagal memuat daftar riwayat keping emas');
    } finally {
      setLoading(false);
    }
  }, [scope, isHO, search, statusFilter, brandFilter, selectedLocationId, isSuperAdmin, user?.locationId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Open Item Timeline Modal
  const handleOpenItemTimeline = async (serialNumber) => {
    setSelectedItem(serialNumber);
    setTimelineLoading(true);
    setItemDetail(null);
    setActiveDetailTab('MILESTONES');

    try {
      const res = await apiRequest(`/traceability/items/${encodeURIComponent(serialNumber)}`);
      if (res && res.data) {
        setItemDetail(res.data);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Gagal memuat rekam jejak keping emas');
      setSelectedItem(null);
    } finally {
      setTimelineLoading(false);
    }
  };

  // KPI calculations
  const totalItemsCount = items.length;
  const inHOCount = items.filter((it) => it.currentStatus === 'IN_HO').length;
  const inTransitCount = items.filter((it) => it.currentStatus === 'IN_TRANSIT').length;
  const inOutletCount = items.filter((it) => it.currentStatus === 'IN_OUTLET').length;
  const soldCount = items.filter((it) => it.currentStatus === 'SOLD').length;

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12 max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 tracking-wider uppercase mb-1">
                <span>{isHO ? 'HEAD OFFICE (HO)' : 'OUTLET / CABANG'}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span>TRACEABILITY & AUDIT</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                <History className="w-7 h-7 text-emerald-600" />
                {isHO
                  ? 'Lacak & Riwayat Keping Emas (Nasional / Global)'
                  : 'Lacak & Riwayat Keping Emas Cabang'}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {isHO
                  ? 'Buku jejak digital (Traceability) seluruh keping emas di ekosistem Pegadaian. Pantau perjalanan emas dari supplier HO hingga ke brankas cabang dan nasabah.'
                  : 'Rekam jejak riwayat fisik keping emas yang pernah atau sedang tersimpan di brankas cabang ini (Lemari, Laci, dan Baris/Row).'}
              </p>
            </div>

            {/* Location Switcher */}
            <div className="flex items-center gap-2.5">
              {(!isHO || isSuperAdmin) && locations.length > 0 && (
                <div className="flex items-center gap-2 bg-emerald-50/80 px-3 py-1.5 rounded-xl border border-emerald-200/80">
                  <Building2 className="w-4 h-4 text-emerald-700" />
                  <label htmlFor="traceLocSelect" className="text-xs font-bold text-emerald-900">
                    {isHO ? 'Filter Unit:' : 'Cabang:'}
                  </label>
                  <select
                    id="traceLocSelect"
                    value={selectedLocationId}
                    onChange={(e) => setSelectedLocationId(e.target.value)}
                    className="bg-white text-xs font-semibold text-emerald-900 border border-emerald-300 rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    {isHO && <option value="">Semua Lokasi Nasional</option>}
                    {locations
                      .filter((l) => (isHO ? true : l.type === 'OUTLET_HUB'))
                      .map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} ({loc.code})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <button
                onClick={fetchItems}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Segarkan</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4 KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Keping Terlacak</p>
                <h3 className="text-3xl font-extrabold text-slate-900 mt-1">
                  {totalItemsCount}
                  <span className="text-sm font-semibold text-slate-500 ml-1.5">Keping</span>
                </h3>
              </div>
              <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                <Coins className="w-6 h-6" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-600" />
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Di Lemari HO</p>
                <h3 className="text-3xl font-extrabold text-slate-900 mt-1">
                  {inHOCount}
                  <span className="text-sm font-semibold text-slate-500 ml-1.5">Keping</span>
                </h3>
              </div>
              <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                <Building2 className="w-6 h-6" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500" />
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Di Brankas Cabang</p>
                <h3 className="text-3xl font-extrabold text-slate-900 mt-1">
                  {inOutletCount}
                  <span className="text-sm font-semibold text-slate-500 ml-1.5">Keping</span>
                </h3>
              </div>
              <div className="w-11 h-11 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                <Layers className="w-6 h-6" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500" />
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Terjual / Ditebus</p>
                <h3 className="text-3xl font-extrabold text-slate-900 mt-1">
                  {soldCount}
                  <span className="text-sm font-semibold text-slate-500 ml-1.5">Keping</span>
                </h3>
              </div>
              <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                <UserCheck className="w-6 h-6" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500" />
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari Nomor Seri Emas, QR Payload, EPC Tag RFID, atau Brand..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800 transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">Semua Status</option>
              <option value="IN_HO">Tersimpan di HO</option>
              <option value="IN_TRANSIT">Dalam Pengiriman</option>
              <option value="IN_OUTLET">Tersimpan di Cabang</option>
              <option value="SOLD">Terjual ke Nasabah</option>
            </select>

            {/* Brand Filter */}
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">Semua Brand</option>
              <option value="ANTAM">ANTAM</option>
              <option value="UBS">UBS</option>
              <option value="LOTUS ARCHI">LOTUS ARCHI</option>
              <option value="GALERI 24">GALERI 24</option>
            </select>
          </div>
        </div>

        {/* Table of Gold Items */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              Daftar Keping Emas & Posisi Fisik Real-Time
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {items.length} keping
              </span>
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-12 text-center">No</th>
                  <th className="py-3.5 px-4">No. Seri Keping</th>
                  <th className="py-3.5 px-4">Brand & Gramatur</th>
                  <th className="py-3.5 px-4">Identitas Digital (QR & RFID)</th>
                  <th className="py-3.5 px-4">Posisi Fisik Terkini</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">Riwayat</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-14 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                      Memuat data lacak riwayat keping emas...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-14 text-center">
                      <Coins className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                      <p className="font-bold text-slate-700">Tidak ada keping emas ditemukan</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Coba sesuaikan kata kunci pencarian atau filter status.
                      </p>
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => {
                    const st = STATUS_CONFIG[it.currentStatus] || {
                      label: it.currentStatus,
                      color: 'bg-slate-100 text-slate-700 border-slate-200',
                      dot: 'bg-slate-400',
                    };

                    return (
                      <tr key={it.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 text-center text-slate-400 font-medium">
                          {idx + 1}
                        </td>

                        {/* Serial Number */}
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          <button
                            onClick={() => handleOpenItemTimeline(it.id)}
                            className="hover:text-emerald-700 hover:underline flex items-center gap-1 group text-left"
                            title="Klik untuk membuka riwayat jejak keping"
                          >
                            <span>{it.id}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        </td>

                        {/* Brand & Weight */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800">{it.brand}</div>
                          <div className="text-[11px] text-slate-500">
                            {it.weight} Gram • Kadar {it.purity || '999.9'}
                          </div>
                        </td>

                        {/* Digital ID (QR & RFID) */}
                        <td className="py-3.5 px-4 font-mono text-[11px] space-y-0.5">
                          {it.rfidTag ? (
                            <div className="text-emerald-800 font-semibold flex items-center gap-1">
                              <Radio size={11} className="text-emerald-600" />
                              <span>{it.rfidTag}</span>
                            </div>
                          ) : (
                            <div className="text-slate-400 text-[10px] italic">Belum pairing RFID</div>
                          )}
                          <div className="text-slate-500 text-[10px] truncate max-w-xs">
                            QR: {it.qrCode}
                          </div>
                        </td>

                        {/* Physical Position */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-800">
                            {it.currentLocation?.fullDisplay || '-'}
                          </div>
                          {it.slotPosition && it.slotPosition !== '-' && (
                            <div className="text-[11px] font-mono text-purple-700 bg-purple-50 inline-block px-1.5 py-0.2 rounded mt-0.5">
                              Slot: {it.slotPosition}
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${st.color}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                            {st.label}
                          </span>
                        </td>

                        {/* Total Events */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                            {it.totalEvents || 1} Event
                          </span>
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => handleOpenItemTimeline(it.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition shadow-2xs"
                          >
                            <History size={13} className="text-emerald-700" />
                            <span>Jejak Emas</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL: DETAIL TIMELINE JEJAK KEPING EMAS (GOLD LIFECYCLE) */}
        {selectedItem && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-6 flex flex-col max-h-[92vh] border border-slate-200">
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-100 text-emerald-800 rounded-2xl shadow-2xs">
                    <History size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-base">
                        Buku Riwayat & Jejak Fisik Keping Emas
                      </h3>
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Traceability Pass
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Rekam jejak komprehensif dari pengadaan awal HO, distribusi, pairing RFID, hingga lokasi fisik terkini
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-xl p-1"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {timelineLoading ? (
                  <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                    <Loader2 size={32} className="animate-spin text-emerald-600 mb-3" />
                    <span className="text-xs font-semibold">Memuat riwayat jejak keping {selectedItem}...</span>
                  </div>
                ) : itemDetail ? (
                  <>
                    {/* Item Profile Card */}
                    <div className="bg-linear-to-br from-slate-900 via-slate-800 to-emerald-950 text-white rounded-2xl p-5 shadow-md relative overflow-hidden">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">
                            SERTIFIKAT KEPING TERVERIFIKASI
                          </div>
                          <h2 className="text-2xl font-mono font-extrabold tracking-wider text-amber-300">
                            {itemDetail.item.id}
                          </h2>
                          <div className="text-sm font-semibold text-slate-200">
                            {itemDetail.item.brand} • {itemDetail.item.weight} Gram • Kadar {itemDetail.item.purity || '999.9'}
                          </div>
                        </div>

                        <div className="text-right space-y-1">
                          <span
                            className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-emerald-200 backdrop-blur-md"
                          >
                            {STATUS_CONFIG[itemDetail.item.currentStatus]?.label || itemDetail.item.currentStatus}
                          </span>
                          <div className="font-mono text-[11px] text-slate-300">
                            RFID: {itemDetail.item.rfidTag || 'Belum Pairing RFID'}
                          </div>
                        </div>
                      </div>

                      {/* Current Location Bar */}
                      <div className="mt-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-300 gap-2">
                        <div className="flex items-center gap-1.5">
                          <MapPin size={14} className="text-emerald-400 shrink-0" />
                          <span>
                            Lokasi Terkini:{' '}
                            <strong className="text-white">
                              {itemDetail.item.currentLocation?.locationName} •{' '}
                              {itemDetail.item.currentLocation?.cabinetName || itemDetail.item.currentLocation?.cabinetCode} ›{' '}
                              {itemDetail.item.currentLocation?.drawerName}
                            </strong>
                          </span>
                        </div>
                        {itemDetail.item.currentLocation?.slotPosition && (
                          <div className="font-mono bg-white/10 px-2 py-0.5 rounded text-amber-300 text-[11px]">
                            Posisi Slot: {itemDetail.item.currentLocation?.slotPosition}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tabs View (Milestones vs Raw Event Logs) */}
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveDetailTab('MILESTONES')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeDetailTab === 'MILESTONES'
                              ? 'bg-emerald-700 text-white shadow-2xs'
                              : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                          Tahapan Perjalanan Fisik ({itemDetail.milestones.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveDetailTab('RAW')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeDetailTab === 'RAW'
                              ? 'bg-emerald-700 text-white shadow-2xs'
                              : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                          Log Audit Trail ({itemDetail.rawHistories.length})
                        </button>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">
                        Terdaftar sejak:{' '}
                        {new Date(itemDetail.item.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    {/* TAB 1: MILESTONES LIFECYCLE */}
                    {activeDetailTab === 'MILESTONES' && (
                      <div className="space-y-6 relative before:absolute before:inset-0 before:left-5 before:w-0.5 before:bg-slate-200">
                        {itemDetail.milestones.map((ms, idx) => (
                          <div key={idx} className="relative flex items-start gap-4">
                            {/* Marker Icon */}
                            <div className="w-10 h-10 rounded-2xl bg-white border-2 border-emerald-600 shadow-sm flex items-center justify-center text-emerald-700 shrink-0 z-10">
                              <span className="font-bold text-xs">{idx + 1}</span>
                            </div>

                            {/* Milestone Content Box */}
                            <div className="flex-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-2">
                                <h4 className="font-bold text-slate-900 text-sm">{ms.title}</h4>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  {new Date(ms.timestamp).toLocaleString('id-ID', {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                  })}
                                </span>
                              </div>

                              {/* Details Content */}
                              <div className="text-xs text-slate-600 space-y-1.5 pt-1">
                                {ms.code === 'HO_INBOUND' && (
                                  <div className="space-y-1">
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">No. PO Inbound Supplier:</span>
                                      <span className="font-mono font-bold text-slate-800">{ms.details.poNumber}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Supplier:</span>
                                      <span className="font-bold text-emerald-800">{ms.details.supplier}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Pembuat Order / Approval:</span>
                                      <span>{ms.details.orderedBy} • Approved: {ms.details.approvedBy}</span>
                                    </div>
                                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px]">
                                      <strong>Peletakan Fisik (Put-Away):</strong> {ms.details.initialPlacement} (oleh: {ms.details.putAwayBy})
                                    </div>
                                  </div>
                                )}

                                {ms.code === 'DISTRIBUTION_DISPATCH' && (
                                  <div className="space-y-1">
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">No. PO Distribusi Cabang:</span>
                                      <span className="font-mono font-bold text-slate-800">{ms.details.poNumber}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Cabang Tujuan:</span>
                                      <span className="font-bold text-blue-900">{ms.details.targetOutlet} ({ms.details.targetOutletCode})</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Pemesan & Approval HO:</span>
                                      <span>Diminta: {ms.details.requestedBy} • Approved: {ms.details.approvedBy}</span>
                                    </div>
                                    <div className="p-2.5 bg-blue-50/60 rounded-xl border border-blue-200 text-[11px] text-blue-950 space-y-0.5">
                                      <div><strong>Picking Lemari HO:</strong> Diambil oleh {ms.details.pickedBy}</div>
                                      <div><strong>Pengiriman:</strong> No. Surat Jalan / Resi {ms.details.trackingNumber}</div>
                                      <div><strong>Ekspedisi:</strong> {ms.details.courier} ({ms.details.vehicle})</div>
                                    </div>
                                  </div>
                                )}

                                {ms.code === 'OUTLET_RECEIVED_PAIRED' && (
                                  <div className="space-y-1">
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Lokasi Penerimaan Cabang:</span>
                                      <span className="font-bold text-purple-900">{ms.details.outletName}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Petugas Penerima:</span>
                                      <span className="font-semibold text-slate-800">{ms.details.receivedBy}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Tag RFID (EPC):</span>
                                      <span className="font-mono font-bold text-emerald-700">{ms.details.rfidTag}</span>
                                    </div>
                                    <div className="p-2.5 bg-purple-50/60 rounded-xl border border-purple-200 text-[11px] text-purple-950">
                                      <strong>Penempatan di Brankas Cabang:</strong> {ms.details.initialPlacement}
                                    </div>
                                  </div>
                                )}

                                {ms.code.startsWith('INTERNAL_MUTATION') && (
                                  <div className="p-2.5 bg-violet-50/60 rounded-xl border border-violet-200 text-[11px] text-violet-950 space-y-1">
                                    <div><strong>Rincian Pemindahan Baki/Row:</strong> {ms.details.description}</div>
                                    <div className="text-slate-500">Petugas: {ms.actor}</div>
                                  </div>
                                )}

                                {ms.code.startsWith('EXTERNAL_MUTATION') && (
                                  <div className="p-2.5 bg-cyan-50/60 rounded-xl border border-cyan-200 text-[11px] text-cyan-950 space-y-1">
                                    <div><strong>Rincian Mutasi Cabang:</strong> {ms.details.description}</div>
                                    <div className="text-slate-500">Petugas: {ms.actor}</div>
                                  </div>
                                )}

                                {ms.code === 'CUSTOMER_SALE' && (
                                  <div className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-200 text-[11px] text-amber-950 space-y-1">
                                    <div className="font-bold">Penjualan Selesai ke Nasabah: {ms.details.customerName} (NIK: {ms.details.customerNik})</div>
                                    <div>{ms.details.description}</div>
                                    <div className="text-slate-500">Petugas Kasir: {ms.actor}</div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* TAB 2: RAW EVENT LOGS */}
                    {activeDetailTab === 'RAW' && (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                            <tr>
                              <th className="p-3">Waktu</th>
                              <th className="p-3">Event Key</th>
                              <th className="p-3">Aktor</th>
                              <th className="p-3">Lokasi Unit</th>
                              <th className="p-3">Keterangan Aktivitas</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {itemDetail.rawHistories.map((h) => (
                              <tr key={h.id} className="hover:bg-slate-50">
                                <td className="p-3 font-mono text-[11px] text-slate-500">
                                  {new Date(h.timestamp).toLocaleString('id-ID')}
                                </td>
                                <td className="p-3">
                                  <span className="font-mono font-bold text-[10px] bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded">
                                    {h.event}
                                  </span>
                                </td>
                                <td className="p-3 font-semibold text-slate-800">{h.actor}</td>
                                <td className="p-3 font-mono text-slate-600">{h.locationCode}</td>
                                <td className="p-3 text-slate-600">{h.details}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : null}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/80 rounded-b-2xl">
                <span className="text-xs text-slate-500">
                  {itemDetail ? `ID Keping: ${itemDetail.item.id} • Terverifikasi Enkripsi Smart Vault` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100"
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
