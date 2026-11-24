'use client';

import React, { useState, useEffect, useCallback, useMemo, use } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { apiRequest } from '@/lib/api';
import {
  Layers,
  ArrowLeft,
  Radio,
  Sliders,
  Sparkles,
  QrCode,
  Box,
  CheckCircle2,
  Clock,
  Printer,
  X,
  Loader2,
  Search,
  Eye,
  Edit2,
  Wifi,
  Activity,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';

export default function OutletCabinetDetailPage({ params }) {
  const unwrappedParams = use(params);
  const code = unwrappedParams.code;

  const [cabinet, setCabinet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDrawerId, setSelectedDrawerId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Item Detail Modal
  const [selectedItem, setSelectedItem] = useState(null);

  // Edit Drawer Modal
  const [editDrawerModal, setEditDrawerModal] = useState({
    isOpen: false,
    drawer: null,
    submitting: false,
    formData: {
      name: '',
      category: '',
      rows: 6,
      cols: 55,
      rfidAntenna: '',
    },
  });

  // Cabinet QR Modal
  const [qrModal, setQrModal] = useState(false);

  // Live RFID Ping Modal
  const [pingModal, setPingModal] = useState({
    isOpen: false,
    scanning: false,
    result: null,
  });

  const loadCabinetDetail = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiRequest(`/outlet/cabinets/${code}`);
      const cab = res.data?.cabinet;
      setCabinet(cab);

      // Default pilih laci pertama jika belum ada yang dipilih
      if (cab?.drawers?.length > 0 && !selectedDrawerId) {
        setSelectedDrawerId(cab.drawers[0].id);
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat detail lemari RFID');
    } finally {
      setLoading(false);
    }
  }, [code, selectedDrawerId]);

  useEffect(() => {
    loadCabinetDetail();
  }, [loadCabinetDetail]);

  const activeDrawer = cabinet?.drawers?.find((d) => d.id === selectedDrawerId) || cabinet?.drawers?.[0];

  // Open Edit Drawer Modal
  const handleOpenEditDrawer = (drw) => {
    setEditDrawerModal({
      isOpen: true,
      drawer: drw,
      submitting: false,
      formData: {
        name: drw.name,
        category: drw.category || '',
        rows: drw.rows || 6,
        cols: drw.cols || 55,
        rfidAntenna: drw.rfidAntenna || 'ANT-01',
      },
    });
  };

  // Submit Edit Drawer
  const handleEditDrawerSubmit = async (e) => {
    e.preventDefault();
    const { drawer, formData } = editDrawerModal;
    try {
      setEditDrawerModal((prev) => ({ ...prev, submitting: true }));
      await apiRequest(`/outlet/cabinets/drawers/${drawer.id}`, {
        method: 'PUT',
        body: JSON.stringify(formData),
      });

      toast.success(`Konfigurasi Laci ${drawer.code} berhasil diperbarui`);
      setEditDrawerModal({ isOpen: false, drawer: null, submitting: false, formData: {} });
      loadCabinetDetail();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Gagal mengubah konfigurasi laci');
      setEditDrawerModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // Handle Live Ping Antena
  const handlePingAntenna = async (drw) => {
    setPingModal({ isOpen: true, scanning: true, result: null });
    try {
      await new Promise((r) => setTimeout(r, 600));
      const res = await apiRequest('/outlet/dashboard/simulate-rfid-scan', {
        method: 'POST',
        body: JSON.stringify({ drawerId: drw.id, drawerCode: drw.code }),
      });
      setPingModal({ isOpen: true, scanning: false, result: res.data });
      toast.success(`Antena ${drw.rfidAntenna} berhasil memindai seluruh slot baki!`);
    } catch (err) {
      console.error(err);
      toast.error('Gagal memindai sensor antena');
      setPingModal((prev) => ({ ...prev, scanning: false }));
    }
  };

  const rowsCount = activeDrawer?.rows || 6;
  const colsCount = activeDrawer?.cols || 55;
  const drawerItems = activeDrawer?.items || [];
  const drawerCapacity = activeDrawer?.capacity || rowsCount * colsCount;
  const percentFilled = drawerCapacity > 0 ? Math.round((drawerItems.length / drawerCapacity) * 100) : 0;

  // Strict 1-to-1 mapping from slot position to item
  // Hook called unconditionally at top level (Rules of Hooks)
  const slotToItemMap = useMemo(() => {
    const map = {};
    const placedItemIds = new Set();
    const unplacedItems = [];

    const parseSlotPos = (pos) => {
      if (!pos) return null;
      const s = String(pos).trim().toUpperCase();

      // Format "R1-05" or "R1-C5"
      const matchRC = s.match(/^R(\d+)[-C](\d+)$/);
      if (matchRC) {
        const r = parseInt(matchRC[1], 10);
        const c = parseInt(matchRC[2], 10);
        if (r >= 1 && r <= rowsCount && c >= 1 && c <= colsCount) {
          return { row: r, col: c };
        }
      }

      // Format "SLOT-05" or "SLOT-5" or numeric "5"
      const matchSlot = s.match(/^(?:SLOT-?)?0*(\d+)$/);
      if (matchSlot) {
        const linear = parseInt(matchSlot[1], 10);
        if (linear >= 1 && linear <= drawerCapacity) {
          const r = Math.floor((linear - 1) / colsCount) + 1;
          const c = ((linear - 1) % colsCount) + 1;
          return { row: r, col: c };
        }
      }

      return null;
    };

    // Pass 1: Place items that have an explicit valid coordinate
    drawerItems.forEach((it) => {
      const coord = parseSlotPos(it.slotPosition);
      if (coord) {
        const key = `R${coord.row}-${String(coord.col).padStart(2, '0')}`;
        if (!map[key] && !placedItemIds.has(it.id)) {
          map[key] = it;
          placedItemIds.add(it.id);
          return;
        }
      }
      unplacedItems.push(it);
    });

    // Pass 2: Place any unplaced items sequentially into empty slots
    let currLinear = 1;
    for (const it of unplacedItems) {
      if (placedItemIds.has(it.id)) continue;

      while (currLinear <= drawerCapacity) {
        const r = Math.floor((currLinear - 1) / colsCount) + 1;
        const c = ((currLinear - 1) % colsCount) + 1;
        const key = `R${r}-${String(c).padStart(2, '0')}`;
        currLinear++;

        if (!map[key]) {
          map[key] = it;
          placedItemIds.add(it.id);
          break;
        }
      }
    }

    return map;
  }, [drawerItems, rowsCount, colsCount, drawerCapacity]);

  if (loading && !cabinet) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <Loader2 size={32} className="animate-spin text-emerald-700 mb-2" />
          <span className="text-xs">Memuat visual grid lemari RFID...</span>
        </div>
      </DashboardLayout>
    );
  }

  if (!cabinet) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-slate-500">
          Lemari RFID {code} tidak ditemukan.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/outlet/cabinets"
              className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 shadow-sm transition-colors"
              title="Kembali ke Daftar Lemari"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm text-slate-900">{cabinet.code}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <Radio size={10} />
                  <span>Brankas RFID Modular Cabang</span>
                </span>
                <span className="text-xs text-slate-500">• {cabinet.location?.name}</span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-0.5">{cabinet.name}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setQrModal(true)}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <QrCode size={14} className="text-emerald-700" />
              <span>Label QR Lemari</span>
            </button>
          </div>
        </div>

        {/* Overview Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-xs">
          <div>
            <span className="text-slate-400 text-[10px] block font-medium">Total Laci Modular</span>
            <span className="text-base font-bold text-slate-900">{cabinet.slots?.length || 10} Laci RFID</span>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] block font-medium">Kapasitas Maksimal</span>
            <span className="text-base font-bold text-slate-900">
              {cabinet.totalCapacity?.toLocaleString('id-ID')} Slot Emas
            </span>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] block font-medium">Emas Fisik Tersimpan</span>
            <span className="text-base font-bold text-emerald-700">{cabinet.usedCapacity} Keping</span>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] block font-medium">Sisa Slot Tersedia</span>
            <span className="text-base font-bold text-slate-700">
              {cabinet.availableCapacity?.toLocaleString('id-ID')} Slot
            </span>
          </div>
        </div>

        {/* 10 Drawers Tabs Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <Layers size={14} className="text-emerald-700" />
              <span>Pilih Baki / Laci RFID (10 Laci Modular):</span>
            </span>
            <span className="text-slate-400 text-[11px]">
              Klik salah satu laci untuk membuka visual matrix grid 6x55
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {cabinet.drawers?.map((drw, idx) => {
              const isSelected = drw.id === activeDrawer?.id;
              const itemCount = drw.usedCapacity || drw.items?.length || 0;
              return (
                <button
                  type="button"
                  key={drw.id}
                  onClick={() => setSelectedDrawerId(drw.id)}
                  className={`px-3.5 py-2.5 rounded-xl border text-left whitespace-nowrap transition-all flex flex-col gap-0.5 min-w-32.5 ${isSelected
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm font-semibold'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                    }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs">Laci {String(idx + 1).padStart(2, '0')}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono ${isSelected ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-200 text-slate-700'
                        }`}
                    >
                      {itemCount} pcs
                    </span>
                  </div>
                  <div className={`text-[10px] ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                    {drw.rows}x{drw.cols} ({drw.capacity} max)
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Drawer Header & Configuration Panel */}
        {activeDrawer && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">{activeDrawer.name}</h2>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    {activeDrawer.code}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <Wifi size={10} />
                    <span>Antena: {activeDrawer.rfidAntenna}</span>
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                  <span>Kategori: <strong className="text-slate-700">{activeDrawer.category || 'Umum'}</strong></span>
                  <span>•</span>
                  <span>
                    Struktur Rak: <strong>{rowsCount} Baris (Row)</strong> x <strong>{colsCount} Item per Baris</strong> ={' '}
                    <strong>{drawerCapacity} Slot</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Terisi: <strong className="text-emerald-700">{drawerItems.length} Keping ({percentFilled}%)</strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handlePingAntenna(activeDrawer)}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Radio size={13} className="animate-pulse text-emerald-700" />
                  <span>Ping Antena RFID</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenEditDrawer(activeDrawer)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Edit2 size={12} />
                  <span>Ubah Konfigurasi Baki</span>
                </button>
              </div>
            </div>

            {/* Quick Search within Drawer */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 relative max-w-sm w-full">
                <Search size={14} className="text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari No. Seri / Brand pada grid..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-emerald-600" /> Emas Terdeteksi RFID
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-slate-100 border border-slate-200" /> Slot Kosong
                </span>
              </div>
            </div>

            {/* THE CORE: 6 Rows x 55 Items Grid Visualizer */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 overflow-x-auto space-y-3">
              <div className="text-[11px] text-slate-500 font-medium">
                Peta Fisik Grid ({rowsCount} Baris x {colsCount} Kolom = {drawerCapacity} Slot Baki):
              </div>

              <div className="inline-block min-w-full space-y-2">
                {Array.from({ length: rowsCount }, (_, rIdx) => {
                  const rowNum = rIdx + 1;
                  return (
                    <div key={rowNum} className="flex items-center gap-2">
                      {/* Row Label */}
                      <div className="w-16 shrink-0 text-[11px] font-bold text-slate-600 bg-white px-2 py-1.5 rounded-lg border border-slate-200 text-center font-mono">
                        Row {rowNum}
                      </div>

                      {/* 55 Slots in this Row */}
                      <div className="flex items-center gap-1">
                        {Array.from({ length: colsCount }, (_, cIdx) => {
                          const colNum = cIdx + 1;
                          const slotPosCode = `R${rowNum}-${String(colNum).padStart(2, '0')}`;

                          // Strict 1-to-1 lookup: slot only contains an item if uniquely assigned
                          const item = slotToItemMap[slotPosCode] || null;

                          const isHighlighted =
                            searchQuery &&
                            item &&
                            (item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              item.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              (item.rfidTag && item.rfidTag.toLowerCase().includes(searchQuery.toLowerCase())));

                          return (
                            <button
                              type="button"
                              key={colNum}
                              onClick={() => {
                                if (item) setSelectedItem(item);
                              }}
                              title={
                                item
                                  ? `[${slotPosCode}] ${item.id} (${item.brand} ${item.weight}g) - RFID: ${item.rfidTag || 'None'}`
                                  : `Slot ${slotPosCode} (Kosong)`
                              }
                              className={`w-7 h-7 rounded-md shrink-0 flex items-center justify-center text-[9px] font-mono transition-all relative ${item
                                  ? isHighlighted
                                    ? 'bg-amber-400 text-slate-900 font-bold ring-2 ring-amber-500 scale-110 shadow-sm z-10'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs hover:scale-110 cursor-pointer'
                                  : 'bg-white hover:bg-slate-200 border border-slate-200/80 text-slate-400 hover:text-slate-700 cursor-default'
                                }`}
                            >
                              {item ? (
                                <Box size={11} className="text-emerald-100" />
                              ) : (
                                <span className="text-[7px] text-slate-400">{colNum}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Grid Footer Legend */}
              <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-200/80">
                <span>Kolom 1 s/d {colsCount} per baris</span>
                <span>Klik keping emas (kotak hijau) untuk melihat rincian RFID & sertifikat</span>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Item Detail Pop-up */}
        {selectedItem && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 text-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                    <Box size={16} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{selectedItem.id}</h3>
                    <span className="text-[11px] text-emerald-700 font-semibold">{selectedItem.brand} {selectedItem.weight}g</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1"
                >
                  ×
                </button>
              </div>

              <div className="space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">Nomor Seri:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedItem.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Kadar Kemurnian:</span>
                  <span className="font-semibold text-slate-800">{selectedItem.purity || '999.9'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tag RFID (EPC):</span>
                  <span className="font-mono font-bold text-emerald-800">{selectedItem.rfidTag || 'Belum di-tag'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Posisi Slot:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedItem.slotPosition || 'SLOT-01'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status Sensor:</span>
                  <span className="font-bold text-emerald-700">● TERDETEKSI AKTIF</span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Edit Konfigurasi Laci */}
        {editDrawerModal.isOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 text-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm">
                  Ubah Konfigurasi Baki: {editDrawerModal.drawer?.code}
                </h3>
                <button
                  onClick={() => setEditDrawerModal({ ...editDrawerModal, isOpen: false })}
                  className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleEditDrawerSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Nama Laci / Baki</label>
                  <input
                    type="text"
                    required
                    value={editDrawerModal.formData.name}
                    onChange={(e) =>
                      setEditDrawerModal({
                        ...editDrawerModal,
                        formData: { ...editDrawerModal.formData, name: e.target.value },
                      })
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Kategori Emas / Kegunaan</label>
                  <input
                    type="text"
                    value={editDrawerModal.formData.category}
                    onChange={(e) =>
                      setEditDrawerModal({
                        ...editDrawerModal,
                        formData: { ...editDrawerModal.formData, category: e.target.value },
                      })
                    }
                    placeholder="Contoh: Emas 10g s/d 25g"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Baris (Rows)</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={editDrawerModal.formData.rows}
                      onChange={(e) =>
                        setEditDrawerModal({
                          ...editDrawerModal,
                          formData: { ...editDrawerModal.formData, rows: parseInt(e.target.value, 10) || 1 },
                        })
                      }
                      className="w-full p-2 border border-slate-300 rounded-lg text-center font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Item per Baris (Cols)</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={editDrawerModal.formData.cols}
                      onChange={(e) =>
                        setEditDrawerModal({
                          ...editDrawerModal,
                          formData: { ...editDrawerModal.formData, cols: parseInt(e.target.value, 10) || 1 },
                        })
                      }
                      className="w-full p-2 border border-slate-300 rounded-lg text-center font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Kode Antena RFID</label>
                  <input
                    type="text"
                    value={editDrawerModal.formData.rfidAntenna}
                    onChange={(e) =>
                      setEditDrawerModal({
                        ...editDrawerModal,
                        formData: { ...editDrawerModal.formData, rfidAntenna: e.target.value.toUpperCase() },
                      })
                    }
                    placeholder="Contoh: ANT-JKT-VAULT-L01"
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditDrawerModal({ ...editDrawerModal, isOpen: false })}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={editDrawerModal.submitting}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-semibold flex items-center gap-1.5"
                  >
                    {editDrawerModal.submitting && <Loader2 size={13} className="animate-spin" />}
                    <span>Simpan Perubahan</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: QR Code Lemari Print */}
        {qrModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center text-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="font-bold text-slate-800">Label QR Lemari RFID</span>
                <button onClick={() => setQrModal(false)} className="text-slate-400 font-bold text-lg">×</button>
              </div>

              <div className="p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
                {cabinet.qrDataUrl && (
                  <img src={cabinet.qrDataUrl} alt={cabinet.code} className="w-40 h-40 mx-auto mb-2 bg-white p-2 rounded-xl border border-slate-200" />
                )}
                <div className="font-mono font-bold text-sm text-slate-900">{cabinet.code}</div>
                <div className="text-slate-600 font-semibold mt-0.5">{cabinet.name}</div>
                <div className="text-[10px] text-slate-400 mt-1">{cabinet.location?.name} • 10 Laci Modular (6x55)</div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl"
                >
                  Cetak Stiker
                </button>
                <button
                  type="button"
                  onClick={() => setQrModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Ping Antena Sensor Result */}
        {pingModal.isOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center text-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="font-bold text-slate-800">Hasil Pemindaian Antena RFID</span>
                <button onClick={() => setPingModal({ isOpen: false, scanning: false, result: null })} className="text-slate-400 font-bold text-lg">×</button>
              </div>

              {pingModal.scanning ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2">
                  <Radio size={28} className="animate-pulse text-emerald-700" />
                  <span className="font-semibold text-slate-800">Memindai 330 slot baki...</span>
                </div>
              ) : pingModal.result ? (
                <div className="space-y-3 text-left">
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
                    <div className="font-bold text-emerald-950">{pingModal.result.drawerName}</div>
                    <div className="text-emerald-800 text-[11px]">
                      Antena: <strong>{pingModal.result.antenna}</strong> • Frekuensi: {pingModal.result.frequency}
                    </div>
                    <div className="text-emerald-800 text-[11px]">
                      Latensi: <strong>{pingModal.result.pingLatencyMs} ms</strong> • Tag Terdeteksi: <strong>{pingModal.result.totalDetected} pcs</strong>
                    </div>
                  </div>

                  <div className="text-slate-500 text-[11px]">
                    Status: Seluruh tag RFID keping emas di baki ini memantulkan sinyal radio aktif tanpa anomali.
                  </div>
                </div>
              ) : null}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setPingModal({ isOpen: false, scanning: false, result: null })}
                  className="px-4 py-2 bg-emerald-700 text-white font-semibold rounded-xl"
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
