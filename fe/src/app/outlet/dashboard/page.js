'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import {
  Radio,
  Sliders,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Box,
  Truck,
  Clock,
  RefreshCw,
  MapPin,
  Layers,
  QrCode,
  Activity,
  AlertTriangle,
  ChevronRight,
  Loader2,
  Eye,
  Check,
  Building2,
  ShoppingCart,
  Wifi,
  WifiOff,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function OutletDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [outletLocations, setOutletLocations] = useState([]);
  const [selectedOutletId, setSelectedOutletId] = useState('');

  // Live RFID Scan Modal State
  const [scanModal, setScanModal] = useState({
    isOpen: false,
    scanning: false,
    drawer: null,
    scanResult: null,
  });

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // Fetch Outlet Locations for Super Admin selector
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
      console.error(err);
    }
  };

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (isSuperAdmin && selectedOutletId) {
        params.outletLocationId = selectedOutletId;
      }
      const res = await apiRequest('/outlet/dashboard', { params });
      if (res && res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat data Dashboard Outlet');
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, selectedOutletId]);

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    if (!authLoading) {
      fetchDashboard();
    }
  }, [fetchDashboard, authLoading]);

  // Handle Live RFID Scan Simulator
  const handleTriggerRfidScan = async (drawer) => {
    setScanModal({
      isOpen: true,
      scanning: true,
      drawer,
      scanResult: null,
    });

    try {
      // Simulate 800ms scanning delay for authentic sensor feel
      await new Promise((r) => setTimeout(r, 600));
      const res = await apiRequest('/outlet/dashboard/simulate-rfid-scan', {
        method: 'POST',
        body: JSON.stringify({
          drawerId: drawer?.id,
          drawerCode: drawer?.code,
        }),
      });

      setScanModal((prev) => ({
        ...prev,
        scanning: false,
        scanResult: res.data,
      }));
      toast.success(`Sensor Antena ${drawer?.rfidAntenna} berhasil memindai baki!`);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Gagal memindai sensor RFID');
      setScanModal((prev) => ({ ...prev, scanning: false }));
    }
  };

  const stats = data?.stats || {
    totalGoldPieces: 0,
    totalGoldWeight: 0,
    itemsWithRfid: 0,
    rfidCoveragePercent: 100,
    incomingPosCount: 0,
    incomingPieces: 0,
    tebusanToday: 0,
    totalAntennas: 4,
    activeAntennas: 4,
  };

  const drawers = data?.vaultDrawers || [];
  const incomingPos = data?.incomingPos || [];
  const recentHistories = data?.recentHistories || [];

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header & Location Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <Radio className="w-3.5 h-3.5" />
              <span>Sistem Sensor RFID UHF Real-Time Aktif (Gen2 EPC)</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
              <span>Vault Cabang:</span>
              <span className="text-emerald-700">{data?.location?.name || 'Outlet Pegadaian'}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono font-medium">
                {data?.location?.code || 'OUTLET'}
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Pemantauan inventori fisik otomatis berbasis multi-antena RFID, status baki brankas, dan penerimaan distribusi dari HO.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button
              onClick={fetchDashboard}
              className="p-2.5 text-slate-500 hover:text-slate-700 hover:bg-white border border-slate-200 rounded-xl shadow-sm transition-all"
              title="Refresh Data"
            >
              <RefreshCw size={15} />
            </button>

            <Link
              href="/outlet/orders"
              className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              <ShoppingCart size={14} />
              <span>Request Emas ke HO</span>
            </Link>
          </div>
        </div>

        {/* Super Admin Location Context Switcher */}
        {isSuperAdmin && (
          <div className="bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                <MapPin size={16} />
              </div>
              <div>
                <span className="text-xs font-bold text-blue-950 block">Pilih Cabang Outlet yang Dipantau (Super Admin Mode):</span>
                <span className="text-[11px] text-blue-700">
                  Lihat sensor brankas dan inventori RFID per cabang secara spesifik.
                </span>
              </div>
            </div>

            <select
              value={selectedOutletId}
              onChange={(e) => setSelectedOutletId(e.target.value)}
              className="bg-white border border-blue-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm min-w-55"
            >
              {outletLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.code})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Card 1: Total Stok Emas Cabang */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Stok Emas di Cabang</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Box className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-slate-900">{stats.totalGoldPieces}</span>
              <span className="text-xs text-slate-500 font-medium">Keping</span>
              <span className="text-xs text-slate-400 font-normal">({stats.totalGoldWeight}g)</span>
            </div>
            <div className="text-[11px] text-emerald-700 mt-1 font-semibold flex items-center gap-1">
              <Check className="w-3 h-3" />
              <span>{stats.itemsWithRfid} keping terdeteksi RFID</span>
            </div>
          </div>

          {/* Card 2: Kiriman Menuju Cabang */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Kiriman dari HO</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-slate-900">{stats.incomingPosCount}</span>
              <span className="text-xs text-slate-500 font-medium">PO Aktif</span>
              <span className="text-xs text-slate-400 font-normal">({stats.incomingPieces} pcs)</span>
            </div>
            <Link
              href="/outlet/orders"
              className="text-[11px] text-blue-600 hover:text-blue-800 mt-1 font-semibold flex items-center gap-1 transition-colors"
            >
              <span>Terima & Pairing RFID</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Card 3: Kesehatan Antena RFID */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Status Sensor RFID</span>
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <Radio className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-slate-900">{stats.activeAntennas} / {stats.totalAntennas}</span>
              <span className="text-xs text-slate-500 font-medium">Antena</span>
            </div>
            <div className="text-[11px] text-teal-700 mt-1 font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-teal-500" />
              <span>Semua Antena Online (100%)</span>
            </div>
          </div>

          {/* Card 4: Transaksi Penebusan Nasabah */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Penebusan Nasabah</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-slate-900">{stats.tebusanToday}</span>
              <span className="text-xs text-slate-500 font-medium">Selesai</span>
            </div>
            <div className="text-[11px] text-amber-700 mt-1 font-semibold">
              Baki Tebusan Siap Serah
            </div>
          </div>
        </div>

        {/* CORE: Smart Vault RFID Multi-Antenna Matrix Visualizer */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Radio className="w-5 h-5 text-emerald-700" />
                <span>Monitoring Brankas Cerdas Cabang (RFID Multi-Antenna Matrix)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Setiap baki dihubungkan ke antena pembaca RFID UHF (920-925 MHz). Sensor mendeteksi keberadaan fisik keping emas secara nirkabel secara real-time.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Sinyal Terdeteksi
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-200" /> Slot Kosong
              </span>
            </div>
          </div>

          {/* Drawers Grid */}
          {loading ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
              <span className="text-xs">Memuat sensor antena brankas cabang...</span>
            </div>
          ) : drawers.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Belum ada baki RFID yang terkonfigurasi di brankas cabang ini.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {drawers.map((drw) => {
                const percentFilled = drw.capacity > 0 ? Math.round((drw.itemCount / drw.capacity) * 100) : 0;
                return (
                  <div
                    key={drw.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 hover:border-emerald-300 transition-all shadow-sm space-y-3"
                  >
                    {/* Drawer Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 text-xs">{drw.name}</h3>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <Wifi size={10} />
                            <span>{drw.rfidAntenna}</span>
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Kategori: <span className="font-semibold text-slate-700">{drw.category}</span> • Frekuensi: {drw.frequencyMhz} MHz
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleTriggerRfidScan(drw)}
                        className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-semibold flex items-center gap-1 shadow-xs transition-colors shrink-0"
                        title="Simulasikan Pindai Sinyal Sensor Antena"
                      >
                        <Radio size={12} className="text-emerald-700 animate-pulse" />
                        <span>Ping Antena</span>
                      </button>
                    </div>

                    {/* Capacity Indicator */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-slate-600 font-medium">
                          Terisi: <strong className="text-slate-900">{drw.itemCount}</strong> / {drw.capacity} Keping ({drw.totalWeight}g)
                        </span>
                        <span className="text-emerald-700 font-bold">{percentFilled}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${percentFilled}%` }}
                        />
                      </div>
                    </div>

                    {/* Visual RFID Tagged Chips Grid */}
                    <div className="pt-1">
                      <span className="text-[10px] font-semibold text-slate-500 block mb-1.5 uppercase tracking-wider">
                        Deteksi Sinyal Keping Emas (Antena Sensor Matrix):
                      </span>
                      {drw.items.length === 0 ? (
                        <div className="p-3 bg-white rounded-lg border border-dashed border-slate-200 text-center text-[11px] text-slate-400">
                          Baki kosong. Belum ada keping emas tersimpan di baki ini.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {drw.items.map((it) => (
                            <div
                              key={it.id}
                              className="p-2 rounded-lg bg-white border border-emerald-200 shadow-xs flex flex-col justify-between"
                            >
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="font-mono font-bold text-slate-900">{it.id}</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                              </div>
                              <div className="text-[10px] text-slate-600 font-semibold mt-0.5">
                                {it.brand} {it.weight}g
                              </div>
                              <div className="text-[9px] font-mono text-emerald-800 mt-1 truncate" title={it.rfidTag}>
                                {it.rfidTag || 'NO-RFID'}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Split Section: Incoming Shipments & Activity History */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Kiriman Menuju Cabang (Incoming POs from HO) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-600" />
                <span>Kiriman Menuju Cabang (PO dari HO)</span>
              </h3>
              <Link href="/outlet/orders" className="text-xs text-blue-600 hover:text-blue-800 font-semibold">
                Lihat Semua
              </Link>
            </div>

            {incomingPos.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Tidak ada kiriman emas aktif yang sedang menuju ke cabang saat ini.
              </div>
            ) : (
              <div className="space-y-2.5">
                {incomingPos.map((po) => (
                  <div
                    key={po.id}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{po.id}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800">
                          {po.status}
                        </span>
                      </div>
                      <div className="text-slate-500 text-[11px] mt-0.5">
                        Muatan: <strong className="text-slate-700">{po.totalPieces} Keping</strong> ({po.totalWeight}g) • Resi:{' '}
                        <span className="font-mono">{po.trackingNumber || 'PGD-EXP-HO'}</span>
                      </div>
                    </div>

                    {po.canReceiveRfid && (
                      <Link
                        href="/outlet/orders"
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm shrink-0 transition-colors"
                      >
                        <Radio size={12} className="animate-pulse" />
                        <span>Terima RFID</span>
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Log Aktivitas Fisik Sensor RFID di Outlet */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-700" />
                <span>Log Aktivitas Sensor RFID & Fisik Cabang</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">Live Sensing</span>
            </div>

            {recentHistories.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Belum ada rekaman aktivitas fisik tercatat di outlet ini.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {recentHistories.map((h) => (
                  <div key={h.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <Radio size={12} className="text-emerald-700" />
                        <span>{h.event}</span>
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(h.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">{h.details}</p>
                    <div className="text-[10px] text-slate-400">
                      Oleh: <span className="font-medium text-slate-600">{h.actor}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* MODAL: Live RFID Tray Scanner Simulator */}
        {scanModal.isOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                    <Radio size={16} className={scanModal.scanning ? 'animate-spin' : ''} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Pemindaian Sensor RFID: {scanModal.drawer?.name}
                    </h3>
                    <span className="text-[11px] text-emerald-800 font-mono">
                      Antena: {scanModal.drawer?.rfidAntenna} • 922.5 MHz (EPC UHF)
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setScanModal({ ...scanModal, isOpen: false })}
                  className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1"
                >
                  ×
                </button>
              </div>

              {scanModal.scanning ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 animate-ping opacity-75" />
                    <Radio className="w-8 h-8 text-emerald-700 absolute inset-0 m-auto" />
                  </div>
                  <span className="font-semibold text-slate-800 text-sm">Memancarkan Sinyal UHF ke Baki...</span>
                  <span className="text-slate-400 text-xs">Mendeteksi pantulan tag RFID keping emas...</span>
                </div>
              ) : scanModal.scanResult ? (
                <div className="space-y-4">
                  {/* Ping Metadata */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Tag Terdeteksi</span>
                      <span className="font-bold text-emerald-700 text-sm">{scanModal.scanResult.totalDetected} pcs</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Latensi Reader</span>
                      <span className="font-bold text-slate-800 text-sm">{scanModal.scanResult.pingLatencyMs} ms</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Status Antena</span>
                      <span className="font-bold text-emerald-700 text-sm">ONLINE</span>
                    </div>
                  </div>

                  {/* List of Detected Tags */}
                  <div>
                    <h4 className="font-bold text-slate-700 mb-1.5">Hasil Pembacaan Tag Fisik:</h4>
                    {scanModal.scanResult.detectedTags.length === 0 ? (
                      <div className="p-4 bg-slate-50 rounded-xl text-center text-slate-400 text-xs">
                        Tidak ada tag RFID yang terdeteksi di baki ini (Baki kosong).
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y">
                        {scanModal.scanResult.detectedTags.map((t, idx) => (
                          <div key={idx} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                            <div>
                              <div className="font-mono font-bold text-slate-900">{t.itemId}</div>
                              <div className="text-[11px] text-slate-500">
                                {t.brand} {t.weight}g • Tag: <span className="font-mono text-emerald-700">{t.rfidTag}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                ✓ {t.signalRssi}
                              </span>
                              <div className="text-[10px] text-slate-400 mt-0.5">{t.readCount} reads/sec</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="pt-4 flex justify-end border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setScanModal({ ...scanModal, isOpen: false })}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-semibold text-xs transition-colors"
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
