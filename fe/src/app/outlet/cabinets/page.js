'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import {
  Layers,
  Plus,
  Search,
  Box,
  MapPin,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Radio,
  Sliders,
  Sparkles,
  Trash2,
  X,
  Loader2,
  Eye,
  QrCode,
  Building2,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';

export default function OutletCabinetsPage() {
  const { user, loading: authLoading } = useAuth();
  const [cabinets, setCabinets] = useState([]);
  const [locationInfo, setLocationInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [outletLocations, setOutletLocations] = useState([]);
  const [selectedOutletId, setSelectedOutletId] = useState('');

  // Create Cabinet Modal
  const [createModal, setCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: 'Lemari RFID Vault 02 (Smart Cabinet)',
    code: 'CAB-OUTLET-JKT-02',
    totalDrawers: 10,
    rowsPerDrawer: 6,
    colsPerDrawer: 55,
    description: 'Lemari modular RFID cabang (10 Laci x 6 Row x 55 Item = 3.300 Kapasitas)',
  });

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // Fetch Outlet Locations for Super Admin
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

  const fetchCabinets = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      if (isSuperAdmin && selectedOutletId) {
        params.outletLocationId = selectedOutletId;
      }

      const res = await apiRequest('/outlet/cabinets', { params });
      if (res && res.data) {
        setCabinets(res.data.cabinets || []);
        setLocationInfo(res.data.location || null);
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat daftar lemari outlet');
    } finally {
      setLoading(false);
    }
  }, [search, isSuperAdmin, selectedOutletId]);

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    if (!authLoading) {
      fetchCabinets();
    }
  }, [fetchCabinets, authLoading]);

  // Handle Create Cabinet
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      setCreating(true);
      const body = {
        ...createForm,
        locationId: isSuperAdmin ? selectedOutletId : undefined,
      };

      const res = await apiRequest('/outlet/cabinets', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      Swal.fire({
        icon: 'success',
        title: 'Lemari RFID Berhasil Dibuat!',
        text: `Lemari ${res.data?.code} dengan ${createForm.totalDrawers} laci (${createForm.rowsPerDrawer} row x ${createForm.colsPerDrawer} item = ${createForm.totalDrawers * createForm.rowsPerDrawer * createForm.colsPerDrawer} kapasitas) siap digunakan.`,
        confirmButtonColor: '#047857',
      });

      setCreateModal(false);
      fetchCabinets();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Gagal membuat lemari baru');
    } finally {
      setCreating(false);
    }
  };

  // Handle Delete Cabinet
  const handleDeleteCabinet = async (cab) => {
    const isConfirmed = await Swal.fire({
      title: 'Hapus Lemari RFID?',
      text: `Apakah Anda yakin ingin menghapus lemari ${cab.code} (${cab.name})? Lemari hanya bisa dihapus jika seluruh laci kosong.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus Lemari',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!isConfirmed.isConfirmed) return;

    try {
      await apiRequest(`/outlet/cabinets/${cab.id}`, { method: 'DELETE' });
      toast.success(`Lemari ${cab.code} berhasil dihapus`);
      fetchCabinets();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Gagal menghapus lemari');
    }
  };

  // Aggregated KPIs
  const totalDrawersCount = cabinets.reduce((acc, c) => acc + (c.drawerCount || 0), 0);
  const totalCapacitySlots = cabinets.reduce((acc, c) => acc + (c.totalCapacity || 0), 0);
  const totalUsedGold = cabinets.reduce((acc, c) => acc + (c.usedCapacity || 0), 0);
  const totalWeightGrams = cabinets.reduce((acc, c) => acc + (c.totalWeightGrams || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold mb-2">
              <Layers className="w-3.5 h-3.5" />
              <span>Smart Safe & RFID Modular Cabinets (Outlet Hub)</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
              <span>Lemari & Baki RFID Cabang:</span>
              <span className="text-emerald-700">{locationInfo?.name || 'Outlet Pegadaian'}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono font-medium">
                {locationInfo?.code || 'OUTLET'}
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Pemetaan lemari brankas cerdas cabang dengan laci modular RFID dinamis (10 laci x 6 row x 55 item = 3.300 slot per lemari), sensor antena, dan visual matrix.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button
              onClick={fetchCabinets}
              className="p-2.5 text-slate-500 hover:text-slate-700 hover:bg-white border border-slate-200 rounded-xl shadow-sm transition-all"
              title="Refresh Lemari"
            >
              <RefreshCw size={15} />
            </button>

            <button
              onClick={() => setCreateModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus size={14} />
              <span>Tambah Lemari RFID Baru</span>
            </button>
          </div>
        </div>

        {/* Super Admin Location Context Switcher */}
        {isSuperAdmin && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                <MapPin size={16} />
              </div>
              <div>
                <span className="text-xs font-bold text-blue-950 block">Pilih Cabang Outlet (Super Admin Mode):</span>
                <span className="text-[11px] text-blue-700">
                  Kelola dan petakan lemari brankas RFID di cabang yang dipilih.
                </span>
              </div>
            </div>

            <select
              value={selectedOutletId}
              onChange={(e) => setSelectedOutletId(e.target.value)}
              className="bg-white border border-blue-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm min-w-[220px]"
            >
              {outletLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.code})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-slate-500">Total Lemari Cabang</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{cabinets.length} Unit</div>
            <div className="text-[11px] text-emerald-700 mt-0.5 font-medium">Modular RFID Aktif</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-slate-500">Total Baki / Laci RFID</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{totalDrawersCount} Laci</div>
            <div className="text-[11px] text-teal-700 mt-0.5 font-medium">{totalDrawersCount} Antena Sensor</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-slate-500">Kapasitas Slot Penyimpanan</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{totalCapacitySlots.toLocaleString('id-ID')} Slot</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Dinamis Row x Col</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-slate-500">Keping Emas Tersimpan</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{totalUsedGold} Keping</div>
            <div className="text-[11px] text-amber-700 mt-0.5 font-semibold">({totalWeightGrams} Gram)</div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <Search className="w-4 h-4 text-slate-400 ml-1.5" />
          <input
            type="text"
            placeholder="Cari lemari berdasarkan kode atau nama..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs bg-transparent focus:outline-none text-slate-900"
          />
        </div>

        {/* Cabinets Grid Cards */}
        {loading ? (
          <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
            <span className="text-xs">Memuat lemari RFID cabang...</span>
          </div>
        ) : cabinets.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
            <Layers className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-700 text-sm">Belum ada Lemari RFID di Cabang Ini</p>
            <p className="text-xs mt-1">Klik tombol &quot;Tambah Lemari RFID Baru&quot; untuk memetakan brankas baru.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {cabinets.map((cab) => {
              const percent = cab.totalCapacity > 0 ? Math.round((cab.usedCapacity / cab.totalCapacity) * 100) : 0;
              return (
                <div
                  key={cab.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-slate-900">{cab.code}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <Radio size={10} />
                            <span>RFID Multi-Antena</span>
                          </span>
                        </div>
                        <h2 className="font-semibold text-slate-800 text-xs mt-1">{cab.name}</h2>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{cab.description}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteCabinet(cab)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Hapus Lemari"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    {/* Capacity Progress */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-600 font-medium">
                          Terisi: <strong className="text-slate-900">{cab.usedCapacity}</strong> / {cab.totalCapacity} Keping
                        </span>
                        <span className="font-bold text-emerald-700">{percent}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                        <span>{cab.drawerCount} Laci Modular</span>
                        <span>{cab.totalWeightGrams} Gram Emas</span>
                        <span>{cab.rfidTaggedCount} Ter-Tagging</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Link to Detail / Grid Visualizer */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-mono">
                      QR: {cab.qrCode}
                    </span>
                    <Link
                      href={`/outlet/cabinets/${cab.code}`}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                    >
                      <span>Buka & Monitoring Grid</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MODAL: Tambah Lemari RFID Baru (Dinamis: Laci, Row, Col) */}
        {createModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 text-xs my-8">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-700" />
                    <span>Tambah Lemari RFID Baru (Konfigurasi Dinamis)</span>
                  </h3>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Petakan brankas cerdas cabang dengan jumlah laci, baris (row), dan kolom item yang fleksibel.
                  </p>
                </div>
                <button
                  onClick={() => setCreateModal(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Nama Lemari / Brankas <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="Contoh: Lemari RFID Vault 02"
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Kode Lemari Unik <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.code}
                    onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })}
                    placeholder="Contoh: CAB-OUTLET-JKT-02"
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Dinamis Grid Parameters */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Sliders size={13} className="text-emerald-700" />
                    <span>Spesifikasi Struktur Rak & Grid Emas:</span>
                  </span>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-500 font-medium mb-1">Jumlah Laci</label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        required
                        value={createForm.totalDrawers}
                        onChange={(e) => setCreateForm({ ...createForm, totalDrawers: parseInt(e.target.value, 10) || 1 })}
                        className="w-full p-2 border border-slate-300 rounded-lg font-bold text-center bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 font-medium mb-1">Row per Laci</label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        required
                        value={createForm.rowsPerDrawer}
                        onChange={(e) => setCreateForm({ ...createForm, rowsPerDrawer: parseInt(e.target.value, 10) || 1 })}
                        className="w-full p-2 border border-slate-300 rounded-lg font-bold text-center bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 font-medium mb-1">Item per Row</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        required
                        value={createForm.colsPerDrawer}
                        onChange={(e) => setCreateForm({ ...createForm, colsPerDrawer: parseInt(e.target.value, 10) || 1 })}
                        className="w-full p-2 border border-slate-300 rounded-lg font-bold text-center bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-[11px] leading-relaxed">
                    ✨ <strong>Kalkulasi Kapasitas:</strong> Tiap laci berkapasitas{' '}
                    <strong>{createForm.rowsPerDrawer * createForm.colsPerDrawer} slot</strong> ({createForm.rowsPerDrawer} baris x {createForm.colsPerDrawer} kolom). Total kapasitas lemari:{' '}
                    <strong>{(createForm.totalDrawers * createForm.rowsPerDrawer * createForm.colsPerDrawer).toLocaleString('id-ID')} keping emas</strong>.
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Keterangan Tambahan</label>
                  <textarea
                    rows={2}
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setCreateModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-semibold shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {creating && <Loader2 size={13} className="animate-spin" />}
                    <span>Buat Lemari RFID</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
