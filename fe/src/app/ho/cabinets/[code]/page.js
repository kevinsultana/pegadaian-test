'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { showToast, confirmAction, alertSuccess, alertError } from '@/lib/alerts';
import {
  Layers,
  Grid,
  QrCode,
  Check,
  X,
  Loader2,
  AlertCircle,
  Sliders,
  ChevronRight,
  Box,
  Printer,
  Plus,
  Edit2,
  Trash2,
  ArrowLeft,
  Building2,
  CheckCircle2,
} from 'lucide-react';

function CabinetDetailContent() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const cabinetCode = params?.code || '';

  const [cabinet, setCabinet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deletingCabinet, setDeletingCabinet] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState(null);

  // Cabinet QR Print Modal State
  const [cabinetQrModal, setCabinetQrModal] = useState({
    isOpen: false,
    cabinet: null,
  });

  // Drawer QR Print Modal State
  const [drawerQrModal, setDrawerQrModal] = useState({
    isOpen: false,
    drawer: null,
    slot: null,
  });

  // Slot QR Print Modal State
  const [slotQrModal, setSlotQrModal] = useState({
    isOpen: false,
    slot: null,
  });

  // Item QR Print Modal State
  const [itemQrModal, setItemQrModal] = useState({
    isOpen: false,
    item: null,
  });

  // Modular Slot Switch Modal State
  const [slotModal, setSlotModal] = useState({
    isOpen: false,
    slotNumber: null,
    currentType: null,
    submitting: false,
    error: '',
  });

  // Edit Item Modal State (Update Item)
  const [editItemModal, setEditItemModal] = useState({
    isOpen: false,
    item: null,
    drawer: null,
    submitting: false,
    error: '',
    formData: {
      serialNumber: '',
      goldType: 'ANTAM',
      weightGrams: 10,
      purity: '999.9',
      slotPosition: '',
      currentStatus: 'IN_HO',
      notes: '',
    },
  });

  // Edit Cabinet Modal State
  const [editCabinetModal, setEditCabinetModal] = useState({
    isOpen: false,
    submitting: false,
    error: '',
    formData: {
      name: '',
      description: '',
    },
  });

  const isSupervisorOrAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'HO_SUPERVISOR';

  const loadCabinetDetail = async (codeToLoad) => {
    const code = codeToLoad || cabinetCode;
    if (!code) return;
    setLoading(true);
    try {
      const res = await apiRequest(`/ho/cabinets/${code}`);
      const cab = res.data?.cabinet || res.data || null;
      setCabinet(cab);
    } catch (err) {
      console.error(err);
      showToast.error(`Gagal memuat detail lemari ${code}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cabinetCode) {
      loadCabinetDetail(cabinetCode);
    }
  }, [cabinetCode]);

  // Open Edit Cabinet Modal
  const openEditCabinetModal = () => {
    if (!cabinet) return;
    setEditCabinetModal({
      isOpen: true,
      submitting: false,
      error: '',
      formData: {
        name: cabinet.name,
        description: cabinet.description || '',
      },
    });
  };

  // Submit Edit Cabinet
  const handleEditCabinetSubmit = async (e) => {
    e.preventDefault();
    if (!cabinet) return;
    setEditCabinetModal((prev) => ({ ...prev, submitting: true, error: '' }));
    const toastId = showToast.loading(`Memperbarui lemari ${cabinet.code}...`);

    try {
      await apiRequest(`/ho/cabinets/${cabinet.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editCabinetModal.formData.name.trim(),
          description: editCabinetModal.formData.description.trim(),
        }),
      });

      showToast.dismiss(toastId);
      showToast.success(`Lemari ${cabinet.code} berhasil diperbarui!`);
      alertSuccess('Berhasil!', `Informasi lemari ${cabinet.code} telah diperbarui.`);

      setEditCabinetModal({
        isOpen: false,
        submitting: false,
        error: '',
        formData: { name: '', description: '' },
      });

      await loadCabinetDetail(cabinet.code);
    } catch (err) {
      showToast.dismiss(toastId);
      const errMsg = err.message || 'Gagal memperbarui lemari';
      setEditCabinetModal((prev) => ({ ...prev, submitting: false, error: errMsg }));
      showToast.error(errMsg);
      alertError('Gagal Edit Lemari', errMsg);
    }
  };

  // Delete Cabinet
  const handleDeleteCabinet = async () => {
    if (!cabinet) return;

    const occ = cabinet.metrics?.totalOccupied ?? cabinet.totalOccupied ?? 0;
    if (occ > 0) {
      alertError(
        'Tidak Dapat Menghapus Lemari',
        `Lemari ${cabinet.code} masih memuat ${occ} keping emas aktif. Kosongkan atau pindahkan seluruh keping emas terlebih dahulu.`
      );
      return;
    }

    const confirmed = await confirmAction(
      `Hapus Lemari ${cabinet.code}?`,
      `Seluruh 8 slot modular dan laci-lacinya akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan!`
    );

    if (!confirmed) return;

    setDeletingCabinet(true);
    const toastId = showToast.loading(`Menghapus lemari ${cabinet.code}...`);

    try {
      await apiRequest(`/ho/cabinets/${cabinet.id}`, {
        method: 'DELETE',
      });

      showToast.dismiss(toastId);
      showToast.success(`Lemari ${cabinet.code} berhasil dihapus.`);
      alertSuccess('Terhapus!', `Lemari ${cabinet.code} beserta 8 slot modularnya telah dihapus.`);
      router.push('/ho/cabinets');
    } catch (err) {
      showToast.dismiss(toastId);
      const errMsg = err.message || 'Gagal menghapus lemari';
      showToast.error(errMsg);
      alertError('Gagal Hapus Lemari', errMsg);
    } finally {
      setDeletingCabinet(false);
    }
  };

  // Handle Modular Switch Modal
  const openSlotModularModal = (slotNumber, currentType) => {
    setSlotModal({
      isOpen: true,
      slotNumber,
      currentType,
      submitting: false,
      error: '',
    });
  };

  const handleModularSwitch = async (targetModularType) => {
    const { slotNumber } = slotModal;
    setSlotModal((prev) => ({ ...prev, submitting: true, error: '' }));
    const toastId = showToast.loading(`Mengonversi Slot #${slotNumber} ke ${targetModularType}...`);

    try {
      await apiRequest(`/ho/cabinets/${cabinet.code}/slots/${slotNumber}/modular-type`, {
        method: 'PATCH',
        body: JSON.stringify({ targetModularType }),
      });

      showToast.dismiss(toastId);
      showToast.success(`Slot #${slotNumber} berhasil diubah ke ${targetModularType}!`);
      alertSuccess('Konversi Berhasil!', `Slot #${slotNumber} kini berformat ${targetModularType}.`);
      setSlotModal({ isOpen: false, slotNumber: null, currentType: null, submitting: false, error: '' });

      await loadCabinetDetail(cabinet.code);
    } catch (err) {
      showToast.dismiss(toastId);
      const errMsg = err.message || 'Gagal mengubah tipe modular slot';
      setSlotModal((prev) => ({ ...prev, submitting: false, error: errMsg }));
      showToast.error(errMsg);
      alertError('Gagal Konversi Modular', errMsg);
    }
  };

  // Open Edit Item Modal
  const openEditItemModal = (item, drw) => {
    setEditItemModal({
      isOpen: true,
      item,
      drawer: drw,
      submitting: false,
      error: '',
      formData: {
        serialNumber: item.id,
        goldType: item.brand,
        weightGrams: item.weight,
        purity: item.purity || '999.9',
        slotPosition: item.slotPosition || 'SLOT-01',
        currentStatus: item.currentStatus || 'IN_HO',
        notes: item.notes || '',
      },
    });
  };

  // Submit Edit Item
  const handleEditItemSubmit = async (e) => {
    e.preventDefault();
    const { item, formData } = editItemModal;
    setEditItemModal((prev) => ({ ...prev, submitting: true, error: '' }));
    const toastId = showToast.loading(`Memperbarui data keping ${item.id}...`);

    try {
      await apiRequest(`/ho/inventory/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          brand: formData.goldType,
          weight: parseFloat(formData.weightGrams),
          purity: formData.purity,
          slotPosition: formData.slotPosition,
          currentStatus: formData.currentStatus,
          notes: formData.notes,
        }),
      });

      showToast.dismiss(toastId);
      showToast.success(`Keping emas ${item.id} berhasil diperbarui!`);
      alertSuccess('Berhasil!', `Informasi emas ${item.id} berhasil disimpan.`);

      setEditItemModal({
        isOpen: false,
        item: null,
        drawer: null,
        submitting: false,
        error: '',
        formData: { serialNumber: '', goldType: 'ANTAM', weightGrams: 10, purity: '999.9', slotPosition: '', currentStatus: 'IN_HO', notes: '' },
      });

      await loadCabinetDetail(cabinet.code);
    } catch (err) {
      showToast.dismiss(toastId);
      const errMsg = err.message || 'Gagal memperbarui emas';
      setEditItemModal((prev) => ({ ...prev, submitting: false, error: errMsg }));
      showToast.error(errMsg);
      alertError('Gagal Edit Emas', errMsg);
    }
  };

  // Delete Item
  const handleDeleteItem = async (it) => {
    const confirmed = await confirmAction(
      `Hapus Keping Emas ${it.id}?`,
      `Keping emas ${it.brand} (${it.weight}g) akan dihapus secara permanen dari sistem.`
    );

    if (!confirmed) return;

    setDeletingItemId(it.id);
    const toastId = showToast.loading(`Menghapus keping emas ${it.id}...`);

    try {
      await apiRequest(`/ho/inventory/${it.id}`, {
        method: 'DELETE',
      });

      showToast.dismiss(toastId);
      showToast.success(`Keping emas ${it.id} berhasil dihapus.`);
      alertSuccess('Terhapus!', `Emas ${it.id} telah dihapus.`);

      await loadCabinetDetail(cabinet.code);
    } catch (err) {
      showToast.dismiss(toastId);
      const errMsg = err.message || 'Gagal menghapus keping emas';
      showToast.error(errMsg);
      alertError('Gagal Hapus Emas', errMsg);
    } finally {
      setDeletingItemId(null);
    }
  };

  // Open Item QR Modal
  const openItemQr = async (it, drw) => {
    try {
      const res = await apiRequest(`/ho/inventory/${it.id}`);
      const itemDetail = res.data?.item || res.data || it;
      setItemQrModal({
        isOpen: true,
        item: {
          ...it,
          ...itemDetail,
          drawerCode: drw.code,
          drawerName: drw.name,
        },
      });
    } catch (e) {
      setItemQrModal({
        isOpen: true,
        item: {
          ...it,
          drawerCode: drw.code,
          drawerName: drw.name,
        },
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/ho/cabinets')}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl border border-slate-200 transition-colors flex items-center gap-2 text-xs shadow-sm shrink-0"
              title="Kembali ke Daftar Semua Lemari"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" />
              <span>Daftar Lemari</span>
            </button>

            <div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                <span>Vault HO Central</span>
                <ChevronRight className="w-3 h-3 text-slate-400" />
                <span className="text-emerald-700 font-mono font-bold">{cabinet?.code || cabinetCode}</span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2 mt-0.5">
                <Layers className="w-5 h-5 text-emerald-700" />
                <span>{cabinet ? cabinet.name : `Memuat ${cabinetCode}...`}</span>
              </h1>
            </div>
          </div>

          {cabinet && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setCabinetQrModal({ isOpen: true, cabinet })}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak QR Lemari</span>
              </button>

              {isSupervisorOrAdmin && (
                <>
                  <button
                    onClick={openEditCabinetModal}
                    className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Edit Lemari</span>
                  </button>

                  <button
                    onClick={handleDeleteCabinet}
                    disabled={deletingCabinet}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Hapus Lemari</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        {loading || !cabinet ? (
          <div className="py-24 text-center text-slate-500 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <Loader2 className="w-9 h-9 animate-spin mx-auto text-emerald-700 mb-3" />
            <span className="text-xs font-medium text-slate-600">Memuat konfigurasi 8 slot modular lemari {cabinetCode}...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Cabinet Info Overview Banner */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 font-bold text-xl shrink-0">
                  {cabinet.code.replace('HO-CAB-', '#')}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                      {cabinet.code}
                    </span>
                    <span className="text-base font-bold text-slate-900">{cabinet.name}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-3 flex-wrap">
                    <span>Tag QR: <strong className="text-slate-700 font-mono">{cabinet.qrCode}</strong></span>
                    <span>&bull;</span>
                    <span>Total Terisi: <strong className="text-emerald-700">{cabinet.metrics?.totalOccupied ?? cabinet.totalOccupied ?? 0}</strong> keping</span>
                    <span>&bull;</span>
                    <span className="text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 text-[11px]">
                      Kapasitas Fleksibel Tanpa Batas
                    </span>
                  </div>
                  {cabinet.description && (
                    <div className="text-[11px] text-slate-500 mt-1.5">
                      {cabinet.description}
                    </div>
                  )}
                </div>
              </div>

              {/* QR Preview & Quick Print */}
              <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200 shrink-0">
                {cabinet.qrDataUrl ? (
                  <img
                    src={cabinet.qrDataUrl}
                    alt={cabinet.qrCode}
                    className="w-12 h-12 bg-white p-1 rounded-lg shrink-0 cursor-pointer border border-slate-200"
                    onClick={() => setCabinetQrModal({ isOpen: true, cabinet })}
                    title="Klik untuk memperbesar / cetak"
                  />
                ) : (
                  <div className="w-12 h-12 bg-white border border-slate-200 rounded-lg flex items-center justify-center shrink-0">
                    <QrCode className="w-6 h-6 text-slate-400" />
                  </div>
                )}
                <div>
                  <div className="font-semibold text-slate-800 text-xs">Penanda Fisik Lemari</div>
                  <button
                    onClick={() => setCabinetQrModal({ isOpen: true, cabinet })}
                    className="mt-1 text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
                  >
                    <Printer className="w-3 h-3" />
                    <span>Cetak Stiker QR</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 8 Modular Slots Grid */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Grid className="w-4 h-4 text-emerald-700" />
                    <span>Konfigurasi 8 Slot Modular ({cabinet.code})</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    1 Slot modular menampung <strong>1 Laci Besar</strong> ATAU <strong>8 Laci Kecil Cluster</strong>. Bebas konversi dan bebas isi tanpa batasan item.
                  </p>
                </div>

                {isSupervisorOrAdmin && (
                  <span className="text-[11px] text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 self-start sm:self-auto font-medium">
                    Mode Supervisor: Konversi Modular & CRUD Emas Aktif
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cabinet.slots?.map((slot) => {
                  const isBigDrawer = slot.modularType === 'BIG_DRAWER';
                  const drawers = slot.drawers || [];
                  const slotItemsCount = drawers.reduce((acc, drw) => acc + (drw.items?.length || 0), 0);

                  return (
                    <div
                      key={slot.id}
                      className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 hover:border-slate-300 transition-all"
                    >
                      {/* Slot Header */}
                      <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-center">
                            #{slot.slotNumber}
                          </span>
                          <div>
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                              <span>Slot #{slot.slotNumber}</span>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${isBigDrawer
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}
                              >
                                {isBigDrawer ? '1 Laci Besar' : '8 Laci Kecil Cluster'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {slotItemsCount} Keping Emas &bull; Kapasitas Fleksibel
                            </div>
                          </div>
                        </div>

                        {/* Slot Header Actions: Cetak QR Slot & Modular Switch */}
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          <button
                            onClick={() => setSlotQrModal({ isOpen: true, slot })}
                            className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-medium rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5 shadow-sm"
                            title="Lihat & Cetak Stiker QR Slot Modular"
                          >
                            <QrCode className="w-3.5 h-3.5 text-emerald-700" />
                            <span>QR Slot</span>
                          </button>

                          {isSupervisorOrAdmin && (
                            <button
                              onClick={() => openSlotModularModal(slot.slotNumber, slot.modularType)}
                              className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-medium rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5"
                              title="Ganti format modular slot"
                            >
                              <Sliders className="w-3 h-3 text-slate-500" />
                              <span>Ubah ke {isBigDrawer ? '8 Kecil' : '1 Besar'}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Drawers Content */}
                      <div className="space-y-3">
                        {drawers.map((drw) => {
                          const items = drw.items || [];

                          return (
                            <div
                              key={drw.id}
                              className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 space-y-2.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  {/* Drawer QR thumbnail / preview button */}
                                  <button
                                    type="button"
                                    onClick={() => setDrawerQrModal({ isOpen: true, drawer: drw, slot })}
                                    className="p-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center transition-all shadow-sm shrink-0"
                                    title="Klik untuk melihat & mencetak QR Stiker Laci ini"
                                  >
                                    {drw.qrDataUrl ? (
                                      <img src={drw.qrDataUrl} alt={drw.code} className="w-7 h-7 object-contain" />
                                    ) : (
                                      <QrCode className="w-5 h-5 text-emerald-700" />
                                    )}
                                  </button>

                                  <div>
                                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                      <Box className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                      <span>{drw.name}</span>
                                    </div>
                                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                                      {drw.code}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setDrawerQrModal({ isOpen: true, drawer: drw, slot })}
                                    className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 text-[10px] font-semibold rounded-md border border-slate-200 flex items-center gap-1 shadow-sm transition-colors"
                                    title="Cetak Stiker QR Laci"
                                  >
                                    <Printer className="w-3 h-3 text-emerald-700" />
                                    <span>QR Laci</span>
                                  </button>

                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200 shadow-sm">
                                    {items.length} Keping
                                  </span>
                                </div>
                              </div>

                              {/* Items List in this Drawer */}
                              {items.length === 0 ? (
                                <div className="p-3 rounded-lg bg-white border border-dashed border-slate-200 text-center text-[11px] text-slate-400">
                                  Belum ada keping emas di laci ini. Penambahan emas wajib melalui menu PO Inbound.
                                </div>
                              ) : (
                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                                  {items.map((it) => (
                                    <div
                                      key={it.id}
                                      className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 text-xs hover:border-slate-300 transition-colors shadow-sm"
                                    >
                                      <div>
                                        <div className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                                          <span>{it.id}</span>
                                          <span className="text-[10px] font-sans px-1.5 py-0.2 rounded font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                            {it.brand} {it.weight}g
                                          </span>
                                        </div>
                                        <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                                          <span>Posisi: <strong className="text-slate-700 font-mono">{it.slotPosition || 'SLOT-01'}</strong></span>
                                          <span>&bull;</span>
                                          <span className="text-emerald-700 font-semibold">{it.currentStatus || 'IN_HO'}</span>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          onClick={() => openItemQr(it, drw)}
                                          className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-md border border-slate-200 transition-colors"
                                          title="Cetak Label Stiker QR Emas"
                                        >
                                          <QrCode className="w-3.5 h-3.5 text-slate-600" />
                                        </button>

                                        {isSupervisorOrAdmin && (
                                          <>
                                            <button
                                              onClick={() => openEditItemModal(it, drw)}
                                              className="p-1.5 bg-slate-50 hover:bg-amber-50 text-slate-600 hover:text-amber-700 rounded-md border border-slate-200 transition-colors"
                                              title="Edit Informasi Keping Emas"
                                            >
                                              <Edit2 className="w-3.5 h-3.5" />
                                            </button>

                                            <button
                                              onClick={() => handleDeleteItem(it)}
                                              disabled={deletingItemId === it.id}
                                              className="p-1.5 bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 rounded-md border border-slate-200 transition-colors disabled:opacity-50"
                                              title="Hapus Keping Emas dari Laci"
                                            >
                                              {deletingItemId === it.id ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                              ) : (
                                                <Trash2 className="w-3.5 h-3.5" />
                                              )}
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Modal: Cetak QR Code Lemari Besi */}
        {cabinetQrModal.isOpen && cabinetQrModal.cabinet && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <Printer className="w-4 h-4" />
                  <span>Stiker QR Penanda Lemari</span>
                </span>
                <button
                  onClick={() => setCabinetQrModal({ isOpen: false, cabinet: null })}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Printable label visual */}
              <div className="bg-slate-50 text-slate-950 p-6 rounded-2xl border-2 border-dashed border-slate-200 inline-block w-full text-center">
                <div className="text-[10px] font-black tracking-wider text-slate-500 uppercase border-b border-slate-200 pb-1.5 mb-3">
                  PEGADAIAN SMART VAULT &bull; HO CENTRAL
                </div>

                {cabinetQrModal.cabinet.qrDataUrl ? (
                  <img
                    src={cabinetQrModal.cabinet.qrDataUrl}
                    alt={cabinetQrModal.cabinet.qrCode}
                    className="w-44 h-44 mx-auto mb-3 bg-white p-2 rounded-xl border border-slate-200"
                  />
                ) : (
                  <div className="w-44 h-44 mx-auto bg-white border border-slate-200 rounded-xl flex items-center justify-center mb-3">
                    <QrCode className="w-20 h-20 text-slate-400" />
                  </div>
                )}

                <div className="text-xl font-bold font-mono tracking-tight text-slate-900">
                  {cabinetQrModal.cabinet.code}
                </div>
                <div className="text-xs font-semibold text-slate-700 mt-0.5">
                  {cabinetQrModal.cabinet.name}
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-2 bg-white py-1 px-2 rounded-md border border-slate-200 inline-block">
                  {cabinetQrModal.cabinet.qrCode}
                </div>
                <div className="text-[10px] text-slate-400 mt-2">
                  Unit: Head Office Sentral Pegadaian
                </div>
              </div>

              <div className="mt-4 text-xs text-slate-500">
                Tempelkan stiker label QR ini pada pintu fisik lemari besi untuk scan audit & picking.
              </div>

              <button
                onClick={() => window.print()}
                className="mt-5 w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Stiker QR Lemari</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal: Edit Keping Emas (Update Item) */}
        {editItemModal.isOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-slate-700" />
                  <span>Edit Data Keping Emas {editItemModal.formData.serialNumber}</span>
                </h3>
                <button
                  onClick={() => setEditItemModal({ ...editItemModal, isOpen: false })}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {editItemModal.error && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{editItemModal.error}</span>
                </div>
              )}

              <form onSubmit={handleEditItemSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Nomor Seri / Tag ID</label>
                  <input
                    type="text"
                    disabled
                    value={editItemModal.formData.serialNumber}
                    className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-mono cursor-not-allowed"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Tipe / Merk</label>
                    <input
                      type="text"
                      required
                      value={editItemModal.formData.goldType}
                      onChange={(e) =>
                        setEditItemModal({
                          ...editItemModal,
                          formData: { ...editItemModal.formData, goldType: e.target.value },
                        })
                      }
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Berat (Gram)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editItemModal.formData.weightGrams}
                      onChange={(e) =>
                        setEditItemModal({
                          ...editItemModal,
                          formData: { ...editItemModal.formData, weightGrams: e.target.value },
                        })
                      }
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Kadar Kemurnian</label>
                    <input
                      type="text"
                      value={editItemModal.formData.purity}
                      onChange={(e) =>
                        setEditItemModal({
                          ...editItemModal,
                          formData: { ...editItemModal.formData, purity: e.target.value },
                        })
                      }
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Posisi Slot Laci</label>
                    <input
                      type="text"
                      value={editItemModal.formData.slotPosition}
                      onChange={(e) =>
                        setEditItemModal({
                          ...editItemModal,
                          formData: { ...editItemModal.formData, slotPosition: e.target.value },
                        })
                      }
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Status Keping</label>
                  <select
                    value={editItemModal.formData.currentStatus}
                    onChange={(e) =>
                      setEditItemModal({
                        ...editItemModal,
                        formData: { ...editItemModal.formData, currentStatus: e.target.value },
                      })
                    }
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="IN_HO">IN_HO (Tersimpan di Vault HO)</option>
                    <option value="ALLOCATED_PO">ALLOCATED_PO (Terkunci PO Picking)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Catatan</label>
                  <input
                    type="text"
                    value={editItemModal.formData.notes}
                    onChange={(e) =>
                      setEditItemModal({
                        ...editItemModal,
                        formData: { ...editItemModal.formData, notes: e.target.value },
                      })
                    }
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditItemModal({ ...editItemModal, isOpen: false })}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={editItemModal.submitting}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    {editItemModal.submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Simpan Perubahan</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit Data Lemari Besi */}
        {editCabinetModal.isOpen && cabinet && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-slate-700" />
                  <span>Edit Lemari {cabinet.code}</span>
                </h3>
                <button
                  onClick={() => setEditCabinetModal({ ...editCabinetModal, isOpen: false })}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {editCabinetModal.error && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{editCabinetModal.error}</span>
                </div>
              )}

              <form onSubmit={handleEditCabinetSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Kode Lemari</label>
                  <input
                    type="text"
                    disabled
                    value={cabinet.code}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-500 font-mono cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Nama Lemari</label>
                  <input
                    type="text"
                    required
                    value={editCabinetModal.formData.name}
                    onChange={(e) =>
                      setEditCabinetModal({
                        ...editCabinetModal,
                        formData: { ...editCabinetModal.formData, name: e.target.value },
                      })
                    }
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Deskripsi</label>
                  <textarea
                    rows={2}
                    value={editCabinetModal.formData.description}
                    onChange={(e) =>
                      setEditCabinetModal({
                        ...editCabinetModal,
                        formData: { ...editCabinetModal.formData, description: e.target.value },
                      })
                    }
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditCabinetModal({ ...editCabinetModal, isOpen: false })}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={editCabinetModal.submitting}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    {editCabinetModal.submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Simpan Perubahan</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Cetak QR Code Keping Emas */}
        {itemQrModal.isOpen && itemQrModal.item && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-xs w-full p-6 shadow-2xl text-center">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <Printer className="w-4 h-4" />
                  <span>Stiker Label QR Emas</span>
                </span>
                <button
                  onClick={() => setItemQrModal({ isOpen: false, item: null })}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Printable label visual */}
              <div className="bg-slate-50 text-slate-950 p-5 rounded-2xl border-2 border-dashed border-slate-200 inline-block w-full text-center">
                <div className="text-[9px] font-black tracking-wider text-slate-500 uppercase border-b border-slate-200 pb-1 mb-2">
                  PEGADAIAN SMART VAULT &bull; HO CENTRAL
                </div>

                {itemQrModal.item.qrDataUrl ? (
                  <img
                    src={itemQrModal.item.qrDataUrl}
                    alt={itemQrModal.item.qrCode}
                    className="w-36 h-36 mx-auto mb-2 bg-white p-2 rounded-xl border border-slate-200"
                  />
                ) : (
                  <div className="w-36 h-36 mx-auto bg-white border border-slate-200 rounded-xl flex items-center justify-center mb-2">
                    <QrCode className="w-16 h-16 text-slate-400" />
                  </div>
                )}

                <div className="text-sm font-bold font-mono tracking-tight text-slate-900">
                  {itemQrModal.item.id || itemQrModal.item.serialNumber}
                </div>
                <div className="text-[11px] font-bold text-slate-700 mt-0.5">
                  {itemQrModal.item.brand || itemQrModal.item.goldType} &bull; {itemQrModal.item.weight}g
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-1 break-all bg-white p-1 rounded border border-slate-200">
                  {itemQrModal.item.qrCode}
                </div>
              </div>

              <div className="mt-4 text-xs text-slate-500">
                Lokasi: <strong className="text-slate-700">{itemQrModal.item.drawerCode || itemQrModal.item.drawer?.code}</strong> ({itemQrModal.item.slotPosition || 'SLOT-01'})
              </div>

              <button
                onClick={() => window.print()}
                className="mt-5 w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Label Stiker QR Emas</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal: Cetak QR Code Laci (Drawer) */}
        {drawerQrModal.isOpen && drawerQrModal.drawer && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <Printer className="w-4 h-4" />
                  <span>Stiker Label QR Laci</span>
                </span>
                <button
                  onClick={() => setDrawerQrModal({ isOpen: false, drawer: null, slot: null })}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Printable label visual */}
              <div className="bg-slate-50 text-slate-950 p-5 rounded-2xl border-2 border-dashed border-slate-200 inline-block w-full text-center">
                <div className="text-[9px] font-black tracking-wider text-slate-500 uppercase border-b border-slate-200 pb-1.5 mb-3">
                  PEGADAIAN SMART VAULT &bull; HO CENTRAL
                </div>

                {drawerQrModal.drawer.qrDataUrl ? (
                  <img
                    src={drawerQrModal.drawer.qrDataUrl}
                    alt={drawerQrModal.drawer.code}
                    className="w-40 h-40 mx-auto mb-3 bg-white p-2 rounded-xl border border-slate-200"
                  />
                ) : (
                  <div className="w-40 h-40 mx-auto bg-white border border-slate-200 rounded-xl flex items-center justify-center mb-3">
                    <QrCode className="w-16 h-16 text-slate-400" />
                  </div>
                )}

                <div className="text-base font-bold font-mono tracking-tight text-slate-900">
                  {drawerQrModal.drawer.code}
                </div>
                <div className="text-xs font-semibold text-slate-700 mt-0.5">
                  {drawerQrModal.drawer.name}
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-2 bg-white py-1 px-2 rounded-md border border-slate-200 inline-block">
                  {drawerQrModal.drawer.qrCode || `QR-${drawerQrModal.drawer.code}`}
                </div>
                <div className="text-[10px] text-slate-500 mt-2">
                  Lemari: <strong>{cabinet?.code}</strong> &bull; Slot #{drawerQrModal.slot?.slotNumber || 'Modular'}
                </div>
                <div className="text-[10px] text-slate-600 font-medium mt-1">
                  Format: {drawerQrModal.slot?.modularType === 'BIG_DRAWER' ? 'Laci Besar' : 'Laci Kecil Cluster'} &bull; Terisi {drawerQrModal.drawer.items?.length || 0} Emas
                </div>
              </div>

              <div className="mt-4 text-xs text-slate-500">
                Tempelkan stiker label QR ini pada fisik laci untuk identifikasi posisi, scan audit harian, dan picking barang.
              </div>

              <button
                onClick={() => window.print()}
                className="mt-5 w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Stiker QR Laci</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal: Cetak QR Code Slot Modular */}
        {slotQrModal.isOpen && slotQrModal.slot && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <Printer className="w-4 h-4" />
                  <span>Stiker Label QR Slot #{slotQrModal.slot.slotNumber}</span>
                </span>
                <button
                  onClick={() => setSlotQrModal({ isOpen: false, slot: null })}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Printable label visual */}
              <div className="bg-slate-50 text-slate-950 p-5 rounded-2xl border-2 border-dashed border-slate-200 inline-block w-full text-center">
                <div className="text-[9px] font-black tracking-wider text-slate-500 uppercase border-b border-slate-200 pb-1.5 mb-3">
                  PEGADAIAN SMART VAULT &bull; HO CENTRAL
                </div>

                {slotQrModal.slot.qrDataUrl ? (
                  <img
                    src={slotQrModal.slot.qrDataUrl}
                    alt={slotQrModal.slot.qrCode}
                    className="w-40 h-40 mx-auto mb-3 bg-white p-2 rounded-xl border border-slate-200"
                  />
                ) : (
                  <div className="w-40 h-40 mx-auto bg-white border border-slate-200 rounded-xl flex items-center justify-center mb-3">
                    <QrCode className="w-16 h-16 text-slate-400" />
                  </div>
                )}

                <div className="text-base font-bold font-mono tracking-tight text-slate-900">
                  {cabinet?.code}-SLOT-{String(slotQrModal.slot.slotNumber).padStart(2, '0')}
                </div>
                <div className="text-xs font-semibold text-slate-700 mt-0.5">
                  Slot Modular #{slotQrModal.slot.slotNumber} ({cabinet?.name})
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-2 bg-white py-1 px-2 rounded-md border border-slate-200 inline-block">
                  {slotQrModal.slot.qrCode}
                </div>
                <div className="text-[10px] text-slate-500 mt-2">
                  Tipe Modular: <strong>{slotQrModal.slot.modularType === 'BIG_DRAWER' ? '1 Laci Besar' : '8 Laci Kecil Cluster'}</strong>
                </div>
                <div className="text-[10px] text-slate-600 font-medium mt-1">
                  Total Tersimpan: {(slotQrModal.slot.drawers || []).reduce((acc, d) => acc + (d.items?.length || 0), 0)} keping emas
                </div>
              </div>

              <div className="mt-4 text-xs text-slate-500">
                Tempelkan stiker label QR ini pada rangka slot modular lemari untuk penanda unit slot.
              </div>

              <button
                onClick={() => window.print()}
                className="mt-5 w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Stiker QR Slot</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal: Ubah Tipe Modular Slot (BIG_DRAWER <-> SMALL_CLUSTER) */}
        {slotModal.isOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-700" />
                  <span>Konversi Slot #{slotModal.slotNumber} ({cabinet?.code})</span>
                </h3>
                <button
                  onClick={() => setSlotModal({ ...slotModal, isOpen: false })}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {slotModal.error && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{slotModal.error}</span>
                </div>
              )}

              <p className="text-xs text-slate-600 mb-4">
                Pilih format layout modular untuk Slot #{slotModal.slotNumber}. Anda dapat mengatur slot menjadi 1 laci besar atau 8 laci kecil cluster.
              </p>

              <div className="space-y-3 mb-6">
                <button
                  type="button"
                  onClick={() => handleModularSwitch('BIG_DRAWER')}
                  disabled={slotModal.submitting || slotModal.currentType === 'BIG_DRAWER'}
                  className={`w-full p-4 rounded-xl border text-left transition-all flex items-center justify-between ${slotModal.currentType === 'BIG_DRAWER'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900 opacity-80 cursor-not-allowed'
                      : 'bg-white border-slate-200 hover:border-emerald-600 text-slate-800'
                    }`}
                >
                  <div>
                    <div className="font-bold text-sm text-slate-900">1 Laci Besar (BIG_DRAWER)</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">1 laci besar per slot (Kapasitas fleksibel tanpa batas)</div>
                  </div>
                  {slotModal.currentType === 'BIG_DRAWER' && (
                    <span className="text-[10px] bg-emerald-700 text-white px-2 py-0.5 rounded-full font-bold">Saat Ini</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleModularSwitch('SMALL_CLUSTER')}
                  disabled={slotModal.submitting || slotModal.currentType === 'SMALL_CLUSTER'}
                  className={`w-full p-4 rounded-xl border text-left transition-all flex items-center justify-between ${slotModal.currentType === 'SMALL_CLUSTER'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900 opacity-80 cursor-not-allowed'
                      : 'bg-white border-slate-200 hover:border-emerald-600 text-slate-800'
                    }`}
                >
                  <div>
                    <div className="font-bold text-sm text-slate-900">8 Laci Kecil (SMALL_CLUSTER)</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">8 laci kecil cluster per slot (Kapasitas fleksibel tanpa batas)</div>
                  </div>
                  {slotModal.currentType === 'SMALL_CLUSTER' && (
                    <span className="text-[10px] bg-emerald-700 text-white px-2 py-0.5 rounded-full font-bold">Saat Ini</span>
                  )}
                </button>
              </div>

              <div className="flex justify-end border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setSlotModal({ ...slotModal, isOpen: false })}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors"
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

export default function CabinetDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-600 font-medium">Memuat detail lemari...</div>}>
      <CabinetDetailContent />
    </Suspense>
  );
}
