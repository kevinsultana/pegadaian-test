'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
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
  ChevronRight,
  Printer,
  Plus,
  Edit2,
  Trash2,
  Search,
  Building2,
  CheckCircle2,
  Box,
} from 'lucide-react';

function CabinetsListContent() {
  const { user } = useAuth();
  const router = useRouter();

  const [cabinets, setCabinets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cabinetSearch, setCabinetSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'OCCUPIED' | 'EMPTY'
  const [deletingCabId, setDeletingCabId] = useState(null);

  // Cabinet QR Print Modal State
  const [cabinetQrModal, setCabinetQrModal] = useState({
    isOpen: false,
    cabinet: null,
  });

  // Create Cabinet Modal State
  const [createCabinetModal, setCreateCabinetModal] = useState({
    isOpen: false,
    submitting: false,
    error: '',
    formData: {
      code: '',
      name: '',
      description: '',
      modularSetup: 'DEFAULT', // 'DEFAULT', 'ALL_BIG', 'ALL_SMALL'
    },
  });

  // Edit Cabinet Modal State
  const [editCabinetModal, setEditCabinetModal] = useState({
    isOpen: false,
    cabinet: null,
    submitting: false,
    error: '',
    formData: {
      name: '',
      description: '',
    },
  });

  const isSupervisorOrAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'HO_SUPERVISOR';

  const fetchCabinetsList = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/ho/cabinets');
      const list = res.data?.cabinets || (Array.isArray(res.data) ? res.data : []);
      setCabinets(list);
      return list;
    } catch (err) {
      console.error(err);
      showToast.error('Gagal mengambil daftar lemari HO');
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCabinetsList();
  }, []);

  // Open Create Cabinet Modal
  const openCreateCabinetModal = () => {
    let maxNum = 0;
    cabinets.forEach((c) => {
      const match = c.code.match(/HO-CAB-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    const nextNum = String(maxNum + 1).padStart(2, '0');
    setCreateCabinetModal({
      isOpen: true,
      submitting: false,
      error: '',
      formData: {
        code: `HO-CAB-${nextNum}`,
        name: `Lemari Besi Vault ${nextNum}`,
        description: 'Lemari Besi Vault Modular HO',
        modularSetup: 'DEFAULT',
      },
    });
  };

  // Submit Create Cabinet
  const handleCreateCabinetSubmit = async (e) => {
    e.preventDefault();
    const { formData } = createCabinetModal;
    setCreateCabinetModal((prev) => ({ ...prev, submitting: true, error: '' }));
    const toastId = showToast.loading(`Menambahkan lemari ${formData.code}...`);

    try {
      let slotModularTypes = null;
      if (formData.modularSetup === 'ALL_BIG') {
        slotModularTypes = Array(8).fill('BIG_DRAWER');
      } else if (formData.modularSetup === 'ALL_SMALL') {
        slotModularTypes = Array(8).fill('SMALL_CLUSTER');
      } else {
        slotModularTypes = [
          'BIG_DRAWER',
          'BIG_DRAWER',
          'BIG_DRAWER',
          'BIG_DRAWER',
          'SMALL_CLUSTER',
          'SMALL_CLUSTER',
          'SMALL_CLUSTER',
          'SMALL_CLUSTER',
        ];
      }

      const res = await apiRequest('/ho/cabinets', {
        method: 'POST',
        body: JSON.stringify({
          code: formData.code.trim().toUpperCase(),
          name: formData.name.trim(),
          description: formData.description.trim(),
          slotModularTypes,
        }),
      });

      showToast.dismiss(toastId);
      const newCab = res.data;
      showToast.success(`Lemari ${newCab.code} berhasil dibuat dengan 8 slot modular!`);
      alertSuccess('Berhasil!', `Lemari ${newCab.code} (${newCab.name}) berhasil ditambahkan dengan 8 slot modular.`);

      setCreateCabinetModal({
        isOpen: false,
        submitting: false,
        error: '',
        formData: { code: '', name: '', description: '', modularSetup: 'DEFAULT' },
      });

      await fetchCabinetsList();
    } catch (err) {
      showToast.dismiss(toastId);
      const errMsg = err.message || 'Gagal menambahkan lemari baru';
      setCreateCabinetModal((prev) => ({ ...prev, submitting: false, error: errMsg }));
      showToast.error(errMsg);
      alertError('Gagal Tambah Lemari', errMsg);
    }
  };

  // Open Edit Cabinet Modal
  const openEditCabinetModal = (cab) => {
    setEditCabinetModal({
      isOpen: true,
      cabinet: cab,
      submitting: false,
      error: '',
      formData: {
        name: cab.name,
        description: cab.description || '',
      },
    });
  };

  // Submit Edit Cabinet
  const handleEditCabinetSubmit = async (e) => {
    e.preventDefault();
    const { cabinet, formData } = editCabinetModal;
    setEditCabinetModal((prev) => ({ ...prev, submitting: true, error: '' }));
    const toastId = showToast.loading(`Memperbarui lemari ${cabinet.code}...`);

    try {
      await apiRequest(`/ho/cabinets/${cabinet.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
        }),
      });

      showToast.dismiss(toastId);
      showToast.success(`Lemari ${cabinet.code} berhasil diperbarui!`);
      alertSuccess('Berhasil!', `Informasi lemari ${cabinet.code} telah diperbarui.`);

      setEditCabinetModal({
        isOpen: false,
        cabinet: null,
        submitting: false,
        error: '',
        formData: { name: '', description: '' },
      });

      await fetchCabinetsList();
    } catch (err) {
      showToast.dismiss(toastId);
      const errMsg = err.message || 'Gagal memperbarui lemari';
      setEditCabinetModal((prev) => ({ ...prev, submitting: false, error: errMsg }));
      showToast.error(errMsg);
      alertError('Gagal Edit Lemari', errMsg);
    }
  };

  // Delete Cabinet
  const handleDeleteCabinet = async (cab) => {
    const occ = cab.metrics?.totalOccupied ?? cab.totalOccupied ?? 0;
    if (occ > 0) {
      alertError(
        'Tidak Dapat Menghapus Lemari',
        `Lemari ${cab.code} masih memuat ${occ} keping emas aktif. Kosongkan atau pindahkan seluruh keping emas terlebih dahulu.`
      );
      return;
    }

    const confirmed = await confirmAction(
      `Hapus Lemari ${cab.code}?`,
      `Seluruh 8 slot modular dan laci-lacinya akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan!`
    );

    if (!confirmed) return;

    setDeletingCabId(cab.id);
    const toastId = showToast.loading(`Menghapus lemari ${cab.code}...`);

    try {
      await apiRequest(`/ho/cabinets/${cab.id}`, {
        method: 'DELETE',
      });

      showToast.dismiss(toastId);
      showToast.success(`Lemari ${cab.code} berhasil dihapus.`);
      alertSuccess('Terhapus!', `Lemari ${cab.code} beserta 8 slot modularnya telah dihapus.`);
      await fetchCabinetsList();
    } catch (err) {
      showToast.dismiss(toastId);
      const errMsg = err.message || 'Gagal menghapus lemari';
      showToast.error(errMsg);
      alertError('Gagal Hapus Lemari', errMsg);
    } finally {
      setDeletingCabId(null);
    }
  };

  // Navigate to Cabinet Detail
  const handleSelectCabinet = (code) => {
    router.push(`/ho/cabinets/${code}`);
  };

  // Calculate Metrics
  const totalOccupiedAll = cabinets.reduce(
    (acc, c) => acc + (c.metrics?.totalOccupied ?? c.totalOccupied ?? 0),
    0
  );
  const occupiedCabinetsCount = cabinets.filter(
    (c) => (c.metrics?.totalOccupied ?? c.totalOccupied ?? 0) > 0
  ).length;
  const emptyCabinetsCount = cabinets.length - occupiedCabinetsCount;

  // Filtered Cabinets
  const filteredCabinets = cabinets.filter((cab) => {
    const q = cabinetSearch.toLowerCase();
    const matchesSearch = cab.name.toLowerCase().includes(q) || cab.code.toLowerCase().includes(q);
    const occ = cab.metrics?.totalOccupied ?? cab.totalOccupied ?? 0;

    if (!matchesSearch) return false;
    if (filterStatus === 'OCCUPIED') return occ > 0;
    if (filterStatus === 'EMPTY') return occ === 0;
    return true;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
              <Layers className="w-6 h-6 text-emerald-700" />
              <span>Manajemen Lemari Besi Vault HO</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Daftar seluruh lemari besi modular Head Office. Pilih lemari untuk melihat dan mengelola 8 slot modular serta keping emas di dalamnya.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isSupervisorOrAdmin && (
              <button
                onClick={openCreateCabinetModal}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Lemari Baru</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Lemari Vault</div>
            <div className="text-2xl font-bold text-slate-900 mt-1 flex items-baseline gap-1.5">
              <span>{cabinets.length}</span>
              <span className="text-xs font-normal text-slate-500">Unit</span>
            </div>
            <div className="text-[11px] text-emerald-700 font-medium mt-1">8 Slot Modular per Lemari</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Keping Emas</div>
            <div className="text-2xl font-bold text-amber-700 mt-1 flex items-baseline gap-1.5">
              <span>{totalOccupiedAll}</span>
              <span className="text-xs font-normal text-slate-500">Keping</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Tersimpan di Vault HO</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Lemari Terisi</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1 flex items-baseline gap-1.5">
              <span>{occupiedCabinetsCount}</span>
              <span className="text-xs font-normal text-slate-500">Lemari</span>
            </div>
            <div className="text-[11px] text-emerald-600 font-medium mt-1">Memuat keping emas</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Lemari Kosong</div>
            <div className="text-2xl font-bold text-slate-700 mt-1 flex items-baseline gap-1.5">
              <span>{emptyCabinetsCount}</span>
              <span className="text-xs font-normal text-slate-500">Lemari</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Siap dialokasikan</div>
          </div>
        </div>

        {/* Filter Tabs, Search & Lemari Grid */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs self-start">
              <button
                onClick={() => setFilterStatus('ALL')}
                className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all ${filterStatus === 'ALL'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Semua Lemari ({cabinets.length})
              </button>
              <button
                onClick={() => setFilterStatus('OCCUPIED')}
                className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all ${filterStatus === 'OCCUPIED'
                    ? 'bg-white text-amber-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Terisi ({occupiedCabinetsCount})
              </button>
              <button
                onClick={() => setFilterStatus('EMPTY')}
                className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all ${filterStatus === 'EMPTY'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Kosong ({emptyCabinetsCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="w-full md:w-80 bg-white border border-slate-300 rounded-xl px-3.5 py-2 flex items-center gap-2 focus-within:ring-2 focus-within:ring-emerald-500 transition-all">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nomor atau nama lemari..."
                value={cabinetSearch}
                onChange={(e) => setCabinetSearch(e.target.value)}
                className="w-full bg-transparent text-xs text-slate-900 focus:outline-none"
              />
              {cabinetSearch && (
                <button
                  onClick={() => setCabinetSearch('')}
                  className="text-slate-400 hover:text-slate-600 text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Cabinets Full Grid */}
          {loading ? (
            <div className="py-20 text-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-700 mb-2" />
              <span className="text-xs text-slate-500 font-medium">Memuat data lemari besi vault HO...</span>
            </div>
          ) : filteredCabinets.length === 0 ? (
            <div className="py-16 text-center text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
              <Layers className="w-10 h-10 mx-auto text-slate-400 mb-2" />
              <div className="text-sm font-semibold text-slate-800">Tidak ada lemari yang sesuai</div>
              <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau tab filter di atas.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredCabinets.map((cab) => {
                const occ = cab.metrics?.totalOccupied ?? cab.totalOccupied ?? 0;
                const bigCount = cab.bigDrawersCount || 0;
                const smallCount = cab.smallDrawersCount || 0;

                return (
                  <div
                    key={cab.id}
                    onClick={() => handleSelectCabinet(cab.code)}
                    className="group cursor-pointer rounded-2xl border border-slate-200 bg-white hover:border-emerald-600 hover:shadow-md transition-all p-4 flex flex-col justify-between"
                  >
                    <div>
                      {/* Card Top: Code, Status Pill, QR Thumbnail */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                              {cab.code}
                            </span>
                            {occ > 0 ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                {occ} Keping
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                                Kosong
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-slate-900 text-sm mt-2 group-hover:text-emerald-700 transition-colors line-clamp-1">
                            {cab.name}
                          </h3>
                        </div>

                        {/* QR Code thumbnail */}
                        {cab.qrDataUrl ? (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setCabinetQrModal({ isOpen: true, cabinet: cab });
                            }}
                            className="p-1 bg-white border border-slate-200 rounded-lg hover:border-emerald-500 transition-all shrink-0 cursor-pointer shadow-sm"
                            title="Klik untuk melihat dan mencetak QR Lemari"
                          >
                            <img src={cab.qrDataUrl} alt={cab.code} className="w-10 h-10" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center shrink-0">
                            <QrCode className="w-5 h-5 text-slate-400" />
                          </div>
                        )}
                      </div>

                      {/* Card Middle: Modular composition */}
                      <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <div className="flex items-center gap-1 font-medium">
                          <Grid className="w-3.5 h-3.5 text-emerald-700" />
                          <span>8 Slot Modular</span>
                        </div>
                        <div className="font-medium text-slate-700">
                          {bigCount} Besar &bull; {smallCount} Kecil
                        </div>
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectCabinet(cab.code);
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition-colors flex items-center gap-1 flex-1 justify-center shadow-sm"
                      >
                        <span>Kelola Slot</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCabinetQrModal({ isOpen: true, cabinet: cab });
                        }}
                        className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-colors shrink-0"
                        title="Cetak Stiker QR Lemari"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>

                      {isSupervisorOrAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditCabinetModal(cab);
                            }}
                            className="p-1.5 bg-slate-50 hover:bg-amber-50 text-slate-600 hover:text-amber-700 rounded-xl border border-slate-200 hover:border-amber-200 transition-colors shrink-0"
                            title="Edit Lemari"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            disabled={deletingCabId === cab.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCabinet(cab);
                            }}
                            className="p-1.5 bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 rounded-xl border border-slate-200 hover:border-rose-200 transition-colors shrink-0 disabled:opacity-50"
                            title="Hapus Lemari Besi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

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

        {/* Modal: Tambah Lemari Besi Baru */}
        {createCabinetModal.isOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-700" />
                  <span>Tambah Lemari Besi Vault Baru</span>
                </h3>
                <button
                  onClick={() => setCreateCabinetModal({ ...createCabinetModal, isOpen: false })}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {createCabinetModal.error && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{createCabinetModal.error}</span>
                </div>
              )}

              <form onSubmit={handleCreateCabinetSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Kode Lemari</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: HO-CAB-33"
                    value={createCabinetModal.formData.code}
                    onChange={(e) =>
                      setCreateCabinetModal({
                        ...createCabinetModal,
                        formData: { ...createCabinetModal.formData, code: e.target.value.toUpperCase() },
                      })
                    }
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Format standar: HO-CAB-XX</span>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Nama Lemari</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Lemari Besi Vault 33"
                    value={createCabinetModal.formData.name}
                    onChange={(e) =>
                      setCreateCabinetModal({
                        ...createCabinetModal,
                        formData: { ...createCabinetModal.formData, name: e.target.value },
                      })
                    }
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Deskripsi / Lokasi Fisik</label>
                  <input
                    type="text"
                    placeholder="Contoh: Lemari Vault Tambahan Zona B"
                    value={createCabinetModal.formData.description}
                    onChange={(e) =>
                      setCreateCabinetModal({
                        ...createCabinetModal,
                        formData: { ...createCabinetModal.formData, description: e.target.value },
                      })
                    }
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Konfigurasi Awal 8 Slot Modular</label>
                  <select
                    value={createCabinetModal.formData.modularSetup}
                    onChange={(e) =>
                      setCreateCabinetModal({
                        ...createCabinetModal,
                        formData: { ...createCabinetModal.formData, modularSetup: e.target.value },
                      })
                    }
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="DEFAULT">4 Laci Besar (Slot 1-4) & 4 Laci Kecil (Slot 5-8) - Rekomendasi</option>
                    <option value="ALL_BIG">Semua 8 Slot Laci Besar (8 Laci Besar)</option>
                    <option value="ALL_SMALL">Semua 8 Slot Laci Kecil (64 Laci Kecil)</option>
                  </select>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Pasti dibuat 8 slot modular. Tiap slot nantinya tetap bebas dikonversi kapan saja.
                  </span>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[11px] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
                  <span>QR Code lemari otomatis di-generate dan siap cetak segera setelah dibuat.</span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setCreateCabinetModal({ ...createCabinetModal, isOpen: false })}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={createCabinetModal.submitting}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    {createCabinetModal.submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Buat Lemari (8 Slot)</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit Data Lemari Besi */}
        {editCabinetModal.isOpen && editCabinetModal.cabinet && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-slate-700" />
                  <span>Edit Lemari {editCabinetModal.cabinet.code}</span>
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
                    value={editCabinetModal.cabinet.code}
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
      </div>
    </DashboardLayout>
  );
}

export default function CabinetsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-600 font-medium">Memuat daftar lemari vault...</div>}>
      <CabinetsListContent />
    </Suspense>
  );
}
