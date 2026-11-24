'use client';
import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import {
  ShoppingCart, Plus, ChevronRight, FileText, Clock, CheckCircle,
  XCircle, Truck, Package, AlertCircle, Trash2, Send, Eye,
  RefreshCw, ChevronDown, Loader2, MapPin, Radio, Sparkles,
  QrCode, Layers, Building2, Check, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';

const STATUS_CONFIG = {
  DRAFT: { label: 'Draft', color: 'bg-slate-100 text-slate-600', icon: FileText },
  PENDING_OUTLET_SPV: { label: 'Menunggu SPV', color: 'bg-amber-100 text-amber-700', icon: Clock },
  SUBMITTED_TO_HO: { label: 'Dikirim ke HO', color: 'bg-blue-100 text-blue-700', icon: Send },
  WAITING_RESTOCK: { label: 'Menunggu Restock HO', color: 'bg-amber-100 text-amber-800', icon: AlertCircle },
  APPROVED_HO: { label: 'Disetujui HO', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  PICKING: { label: 'Proses Picking', color: 'bg-violet-100 text-violet-700', icon: Package },
  PARTIAL_HOLD: { label: 'Dikirim Sebagian', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
  DISPATCHED: { label: 'Dalam Pengiriman', color: 'bg-cyan-100 text-cyan-700', icon: Truck },
  RECEIVED: { label: 'Diterima di Cabang', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  REJECTED: { label: 'Ditolak', color: 'bg-red-100 text-red-700', icon: XCircle },
  REQUESTED: { label: 'Diajukan', color: 'bg-blue-100 text-blue-700', icon: Send },
  APPROVED: { label: 'Disetujui', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
};

const GOLD_BRANDS = ['ANTAM', 'UBS', 'GALERI24', 'LOTUS ARCHI'];
const WEIGHTS = [1, 2, 3, 5, 10, 25, 50, 100];

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'bg-slate-100 text-slate-600', icon: FileText };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

// ----------------------------------------------------------------------
// MODAL: Buat Request PO Baru
// ----------------------------------------------------------------------
function CreatePoModal({ onClose, onCreated, outletLocations = [], isSuperAdmin, selectedOutletId }) {
  const [destLocId, setDestLocId] = useState(selectedOutletId || (outletLocations[0]?.id || ''));
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([{ goldBrand: 'ANTAM', weightGrams: 10, qtyRequested: 1, notes: '' }]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedOutletId) {
      setDestLocId(selectedOutletId);
    } else if (outletLocations.length > 0 && !destLocId) {
      setDestLocId(outletLocations[0].id);
    }
  }, [selectedOutletId, outletLocations]);

  const addLine = () => setLines([...lines, { goldBrand: 'ANTAM', weightGrams: 10, qtyRequested: 1, notes: '' }]);
  const removeLine = (i) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i, field, val) => {
    const updated = [...lines];
    updated[i] = { ...updated[i], [field]: val };
    setLines(updated);
  };

  const submit = async () => {
    if (lines.length === 0) return toast.error('Tambahkan minimal 1 item');
    if (isSuperAdmin && !destLocId) return toast.error('Pilih cabang pemesan');
    setLoading(true);
    try {
      const res = await apiRequest('/outlet/orders', {
        method: 'POST',
        body: JSON.stringify({
          destLocId,
          notes,
          requestLines: lines,
        }),
      });
      toast.success(res.message || 'Draft PO berhasil dibuat');
      onCreated(res.data);
    } catch (err) {
      toast.error(err.message || 'Gagal membuat PO');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ShoppingCart size={18} className="text-emerald-700" />
              <span>Buat Request Emas ke HO</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Pengajuan kebutuhan emas cabang ke Head Office</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {/* Cabang Pemesan (Khusus Super Admin) */}
          {isSuperAdmin && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
              <label className="block text-xs font-bold text-amber-900 items-center gap-1.5">
                <MapPin size={14} className="text-amber-700" />
                <span>Pilih Cabang Pemesan (Super Admin Mode)</span>
              </label>
              <select
                value={destLocId}
                onChange={(e) => setDestLocId(e.target.value)}
                className="w-full text-xs border border-amber-300 rounded-lg p-2 bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {outletLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700">Daftar Permintaan Emas</label>
              <button onClick={addLine} className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 font-medium">
                <Plus size={14} /> Tambah Baris
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <div className="col-span-4">
                    <label className="block text-[10px] text-slate-400 mb-0.5">Brand</label>
                    <select
                      value={line.goldBrand}
                      onChange={(e) => updateLine(i, 'goldBrand', e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      {GOLD_BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[10px] text-slate-400 mb-0.5">Berat</label>
                    <select
                      value={line.weightGrams}
                      onChange={(e) => updateLine(i, 'weightGrams', Number(e.target.value))}
                      className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      {WEIGHTS.map((w) => <option key={w} value={w}>{w}g</option>)}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[10px] text-slate-400 mb-0.5">Qty Keping</label>
                    <input
                      type="number"
                      min={1}
                      value={line.qtyRequested}
                      onChange={(e) => updateLine(i, 'qtyRequested', Number(e.target.value))}
                      className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="col-span-2 flex items-end justify-center pt-3">
                    {lines.length > 1 && (
                      <button onClick={() => removeLine(i)} className="text-rose-500 hover:text-rose-700 p-1 rounded">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan Tambahan (Opsional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Permintaan stok reguler untuk kebutuhan penebusan nasabah"
              className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <div className="text-xs text-slate-500">
            Total:{' '}
            <span className="font-bold text-slate-800">
              {lines.reduce((s, l) => s + (l.qtyRequested || 0), 0)} keping
            </span>{' '}
            (
            {lines.reduce((s, l) => s + (l.weightGrams * (l.qtyRequested || 0)), 0)} gram
            )
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-medium hover:bg-slate-100">
              Batal
            </button>
            <button
              onClick={submit}
              disabled={loading}
              className="px-4 py-2 bg-emerald-700 text-white rounded-xl text-xs font-semibold hover:bg-emerald-800 disabled:opacity-60 flex items-center gap-1.5"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              <span>Simpan Draft PO</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// MODAL: Penerimaan & Pairing RFID Tag (Per Keping Emas)
// ----------------------------------------------------------------------
function RfidPairingModal({ po, onClose, onSuccess }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drawers, setDrawers] = useState([]);
  const [pairingStates, setPairingStates] = useState({}); // { [itemId]: { rfidTag, drawerCode, submitting } }

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      const [orderRes, drawerRes] = await Promise.all([
        apiRequest(`/outlet/orders/${po.id}`),
        apiRequest(`/outlet/orders/drawers?locationId=${po.destLocId}`),
      ]);

      const poData = orderRes.data;
      setDetail(poData);
      setDrawers(drawerRes.data || []);

      // Inisialisasi pairing inputs untuk item yang belum dipairing
      const initialStates = {};
      (poData.items || []).forEach((poi, index) => {
        const item = poi.item;
        const defaultDrawer = (drawerRes.data && drawerRes.data[0]?.code) || '';
        const autoEpc = `EPC-PGD-2026-${Math.floor(100000 + Math.random() * 900000)}`;

        initialStates[item.id] = {
          rfidTag: item.rfidTag || autoEpc,
          drawerCode: item.drawer?.code || defaultDrawer,
          submitting: false,
        };
      });
      setPairingStates(initialStates);
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat rincian item PO untuk pairing RFID');
    } finally {
      setLoading(false);
    }
  }, [po.id, po.destLocId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleInputChange = (itemId, field, value) => {
    setPairingStates((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  };

  const handleAutoGenerateTag = (itemId) => {
    const randomEpc = `EPC-PGD-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    handleInputChange(itemId, 'rfidTag', randomEpc);
    toast.success('Tag RFID EPC baru di-generate');
  };

  const handlePairItem = async (itemId) => {
    const state = pairingStates[itemId];
    if (!state?.rfidTag) return toast.error('Nomor RFID Tag wajib diisi');
    if (!state?.drawerCode) return toast.error('Pilih baki/laci brankas tujuan');

    setPairingStates((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], submitting: true },
    }));

    try {
      const res = await apiRequest(`/outlet/orders/${po.id}/pair-item-rfid`, {
        method: 'POST',
        body: JSON.stringify({
          itemId,
          rfidTag: state.rfidTag,
          drawerCode: state.drawerCode,
        }),
      });

      toast.success(`Keping ${itemId} berhasil dipairing dengan RFID!`);

      // Refresh detail
      const updatedRes = await apiRequest(`/outlet/orders/${po.id}`);
      const updatedPo = updatedRes.data;
      setDetail(updatedPo);

      // Cek apakah seluruh keping sudah beres
      if (res.data?.allPaired || updatedPo.status === 'RECEIVED') {
        Swal.fire({
          icon: 'success',
          title: '🎉 Penerimaan & Pairing RFID Selesai!',
          text: `Semua keping emas pada PO ${po.id} telah berhasil dipasangkan RFID Tag dan tersimpan di Brankas Cabang (${updatedPo.destLocation?.name}).`,
          confirmButtonColor: '#047857',
        });
        onSuccess();
        onClose();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Gagal pairing RFID');
    } finally {
      setPairingStates((prev) => ({
        ...prev,
        [itemId]: { ...prev[itemId], submitting: false },
      }));
    }
  };

  const items = detail?.items || [];
  const totalItems = items.length;
  const pairedItems = items.filter((poi) => poi.item?.rfidTag !== null).length;
  const progressPercent = totalItems > 0 ? Math.round((pairedItems / totalItems) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-semibold border border-emerald-200 mb-1">
              <Radio size={12} className="animate-pulse" />
              <span>Penerimaan Barang & Pairing RFID Tag (Cabang)</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>PO: {po.id}</span>
              <span className="text-slate-400 font-normal">•</span>
              <span className="text-slate-600 font-medium text-xs">{po.destLocation?.name}</span>
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1">×</button>
        </div>

        {/* Info & Progress Bar */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="text-slate-500">Asal:</span> <span className="font-semibold text-slate-800">HO Vault</span> •{' '}
            <span className="text-slate-500">No. Surat Jalan / Resi:</span>{' '}
            <span className="font-mono font-bold text-slate-800">{po.trackingNumber || 'PGD-EXP-HO-001'}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-medium text-slate-700">Progress Pairing:</span>
            <span className="font-bold text-emerald-700">{pairedItems} / {totalItems} Keping ({progressPercent}%)</span>
            <div className="w-24 bg-slate-200 rounded-full h-2 overflow-hidden">
              <div className="bg-emerald-600 h-full rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </div>

        {/* Content List of Items */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Loader2 size={24} className="animate-spin text-emerald-700 mb-2" />
              <span className="text-xs">Memuat keping fisik emas dari HO...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              Tidak ada item keping fisik yang terlampir pada PO ini.
            </div>
          ) : (
            items.map((poi, idx) => {
              const item = poi.item;
              const isPaired = !!item?.rfidTag;
              const state = pairingStates[item?.id] || {};

              return (
                <div
                  key={poi.id}
                  className={`p-4 rounded-xl border transition-all ${isPaired
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-white border-slate-200 shadow-sm'
                    }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-xl ${isPaired ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                        {isPaired ? <Check size={18} /> : <QrCode size={18} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-slate-900">{item?.id}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            QR HO Terverifikasi
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {item?.brand} • {item?.weight} Gram • Kadar {item?.purity || '999.9'}
                        </div>
                      </div>
                    </div>

                    <div>
                      {isPaired ? (
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                            <Radio size={12} /> Ter-pairing RFID
                          </span>
                          <div className="text-[11px] font-mono text-emerald-900 mt-1">
                            EPC: <span className="font-bold">{item.rfidTag}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock size={11} /> Belum Pairing RFID
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pairing Controls */}
                  {isPaired ? (
                    <div className="pt-3 flex items-center justify-between text-xs text-slate-600">
                      <div>
                        Lokasi Brankas Cabang:{' '}
                        <span className="font-bold text-slate-800">
                          {item?.drawer?.name || item?.drawerId} (Antena: {item?.drawer?.rfidAntenna || 'ANT-01'})
                        </span>
                      </div>
                      <span className="text-emerald-700 font-semibold text-[11px]">✓ Aktif di Vault Outlet</span>
                    </div>
                  ) : (
                    <div className="pt-3.5 grid grid-cols-1 md:grid-cols-12 gap-3 items-end text-xs">
                      <div className="md:col-span-5">
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-semibold text-slate-700">Tag RFID (EPC Number)</label>
                          <button
                            type="button"
                            onClick={() => handleAutoGenerateTag(item.id)}
                            className="text-[10px] text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-0.5"
                          >
                            <Sparkles size={11} /> Auto-Generate
                          </button>
                        </div>
                        <input
                          type="text"
                          value={state.rfidTag || ''}
                          onChange={(e) => handleInputChange(item.id, 'rfidTag', e.target.value.toUpperCase())}
                          placeholder="Contoh: EPC-PGD-2026-XXXXX"
                          className="w-full p-2 border border-slate-300 rounded-lg font-mono text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div className="md:col-span-4">
                        <label className="block font-semibold text-slate-700 mb-1">Baki / Laci Brankas Cabang</label>
                        <select
                          value={state.drawerCode || ''}
                          onChange={(e) => handleInputChange(item.id, 'drawerCode', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          {drawers.map((d) => (
                            <option key={d.id} value={d.code}>
                              {d.name} ({d.rfidAntenna})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-3">
                        <button
                          type="button"
                          disabled={state.submitting || !state.rfidTag}
                          onClick={() => handlePairItem(item.id)}
                          className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 transition-colors"
                        >
                          {state.submitting ? <Loader2 size={13} className="animate-spin" /> : <Radio size={13} />}
                          <span>Pairing & Simpan</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 rounded-b-2xl">
          <div className="text-xs text-slate-500">
            Keping emas yang telah dipasangkan RFID akan otomatis terpantau sinyal sensornya di Dashboard Outlet.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// MODAL: Detail PO Emas
// ----------------------------------------------------------------------
function PoDetailModal({ po, userRole, onClose, onRefresh, onOpenRfidPairing }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  const isOutletSupervisor = userRole === 'OUTLET_SUPERVISOR' || userRole === 'SUPER_ADMIN';

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiRequest(`/outlet/orders/${po.id}`);
      setDetail(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat detail PO');
    } finally {
      setLoading(false);
    }
  }, [po.id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const confirmAction = async (endpoint, question, successMsg) => {
    const res = await Swal.fire({
      title: 'Konfirmasi',
      text: question,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Lanjutkan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#047857',
    });
    if (!res.isConfirmed) return;

    setLoading(true);
    try {
      await apiRequest(`/outlet/orders/${po.id}/${endpoint}`, { method: 'PATCH' });
      toast.success(successMsg);
      onRefresh();
      fetchDetail();
    } catch (err) {
      toast.error(err.message || 'Aksi gagal');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !detail) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 flex items-center gap-3 shadow-xl">
          <Loader2 size={20} className="animate-spin text-emerald-700" />
          <span className="text-sm text-slate-600">Memuat detail...</span>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const totalQty = detail.requestLines?.reduce((s, l) => s + l.qtyRequested, 0) || 0;
  const totalFulfilled = detail.requestLines?.reduce((s, l) => s + l.qtyFulfilled, 0) || 0;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl my-8 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800">{detail.id}</h2>
              <StatusBadge status={detail.status} />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Dibuat: {new Date(detail.createdAt).toLocaleString('id-ID')} oleh {detail.requestedBy} • Tujuan: {detail.destLocation?.name}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* Metadata Destinasi */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">Asal Pengiriman</span>
              <span className="font-semibold text-slate-800">{detail.sourceLocation?.name || 'Head Office'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">Cabang Tujuan</span>
              <span className="font-semibold text-slate-800">{detail.destLocation?.name || '-'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">No. Resi / Surat Jalan</span>
              <span className="font-mono font-semibold text-slate-800">{detail.trackingNumber || '-'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">Diterima Oleh</span>
              <span className="font-semibold text-slate-800">{detail.receivedBy || '-'}</span>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-700 mb-2">Permintaan Emas ({totalFulfilled}/{totalQty} terpenuhi)</h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Merk</th>
                    <th className="px-4 py-2 text-left">Berat</th>
                    <th className="px-4 py-2 text-center">Diminta</th>
                    <th className="px-4 py-2 text-center">Stok HO</th>
                    <th className="px-4 py-2 text-center">Disetujui</th>
                    <th className="px-4 py-2 text-center">Terpenuhi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(detail.requestLines || []).map((line) => (
                    <tr key={line.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-semibold text-slate-700">{line.goldBrand}</td>
                      <td className="px-4 py-2.5 text-slate-600">{line.weightGrams}g</td>
                      <td className="px-4 py-2.5 text-center text-slate-700 font-bold">{line.qtyRequested}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium ${line.availableStock >= line.qtyRequested
                            ? 'bg-emerald-100 text-emerald-800'
                            : line.availableStock > 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                          {line.availableStock ?? '-'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-slate-700 font-medium">
                        {line.qtyApproved !== null && line.qtyApproved !== undefined ? line.qtyApproved : line.qtyRequested}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={line.qtyFulfilled >= (line.qtyApproved ?? line.qtyRequested) ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                          {line.qtyFulfilled} / {line.qtyApproved ?? line.qtyRequested}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {detail.items && detail.items.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-700 mb-2">Item Fisik Dikirim ({detail.items.length} keping)</h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-2 text-left">No. Seri (QR HO)</th>
                      <th className="px-4 py-2 text-left">Merk & Berat</th>
                      <th className="px-4 py-2 text-left">RFID Tag Cabang</th>
                      <th className="px-4 py-2 text-left">Lokasi Vault</th>
                      <th className="px-4 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.items.map((poi) => (
                      <tr key={poi.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold text-slate-800">{poi.item?.id || poi.itemId}</td>
                        <td className="px-4 py-2.5 text-slate-700">{poi.item?.brand} {poi.item?.weight}g</td>
                        <td className="px-4 py-2.5 font-mono">
                          {poi.item?.rfidTag ? (
                            <span className="text-emerald-700 font-bold">{poi.item.rfidTag}</span>
                          ) : (
                            <span className="text-slate-400 italic">Belum di-tag</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {poi.item?.drawer?.name || '-'}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">{poi.item?.currentStatus || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {detail.notes && (
            <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 border border-slate-200">
              <span className="font-semibold text-slate-700">Catatan:</span> {detail.notes}
            </div>
          )}
        </div>

        <div className="flex gap-2 p-6 border-t border-slate-100 flex-wrap items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {detail.status === 'DRAFT' && (
              <button
                onClick={() => confirmAction('submit-to-spv', 'Submit PO ini ke Supervisor Outlet?', 'PO berhasil disubmit')}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 disabled:opacity-60"
              >
                <Send size={13} /> Submit ke SPV
              </button>
            )}

            {detail.status === 'PENDING_OUTLET_SPV' && isOutletSupervisor && (
              <>
                <button
                  onClick={() => confirmAction('approve-outlet', 'Setujui dan kirim PO ini ke HO?', 'PO disetujui dan dikirim ke HO')}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 text-white rounded-xl text-xs font-semibold hover:bg-emerald-800 disabled:opacity-60"
                >
                  <CheckCircle size={13} /> Setujui & Kirim ke HO
                </button>
                <button
                  onClick={() => confirmAction('reject-outlet', 'Tolak PO ini?', 'PO ditolak')}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-semibold hover:bg-red-100 disabled:opacity-60"
                >
                  <XCircle size={13} /> Tolak
                </button>
              </>
            )}

            {['DISPATCHED', 'PARTIAL_HOLD'].includes(detail.status) && (
              <button
                onClick={() => {
                  onClose();
                  onOpenRfidPairing(detail);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 text-white rounded-xl text-xs font-bold hover:bg-emerald-800 shadow-sm"
              >
                <Radio size={14} className="animate-pulse" />
                <span>Terima Barang & Pairing Tag RFID</span>
              </button>
            )}
          </div>

          <button onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------
export default function OutletOrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [outletLocations, setOutletLocations] = useState([]);
  const [selectedOutletId, setSelectedOutletId] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPo, setSelectedPo] = useState(null);
  const [rfidPairingPo, setRfidPairingPo] = useState(null);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // Fetch Outlet Locations for Super Admin context selector
  const fetchLocations = async () => {
    try {
      const res = await apiRequest('/master/locations');
      const allLocs = res.data?.locations || (Array.isArray(res.data) ? res.data : []);
      const outletsOnly = allLocs.filter((l) => l.type === 'OUTLET_HUB');
      setOutletLocations(outletsOnly);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (isSuperAdmin && selectedOutletId) {
        params.outletLocationId = selectedOutletId;
      }
      const res = await apiRequest('/outlet/orders', { params });
      if (res && res.data) {
        setOrders(res.data.orders || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat data PO');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, isSuperAdmin, selectedOutletId]);

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    if (!authLoading) {
      fetchOrders();
    }
  }, [fetchOrders, authLoading]);

  const statuses = ['', 'DRAFT', 'PENDING_OUTLET_SPV', 'SUBMITTED_TO_HO', 'WAITING_RESTOCK', 'APPROVED_HO', 'PICKING', 'DISPATCHED', 'PARTIAL_HOLD', 'RECEIVED', 'REJECTED'];

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header & Location Context */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-emerald-700" />
              <span>Request Emas ke HO & Penerimaan RFID</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Kelola pengajuan stok emas ke Head Office, pemantauan pengiriman, dan penerimaan fisik dengan pairing tag RFID brankas cabang.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button onClick={fetchOrders} className="p-2.5 text-slate-500 hover:text-slate-700 hover:bg-white border border-slate-200 rounded-xl shadow-sm transition-all">
              <RefreshCw size={15} />
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700 text-white rounded-xl text-xs font-semibold hover:bg-emerald-800 shadow-sm transition-colors"
            >
              <Plus size={15} /> Buat Request Baru
            </button>
          </div>
        </div>

        {/* Super Admin Location Context Selector Bar */}
        {isSuperAdmin && (
          <div className="bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                <MapPin size={18} />
              </div>
              <div>
                <span className="text-xs font-bold text-blue-950 block">Pilih Cabang Operasional (Super Admin Mode):</span>
                <span className="text-[11px] text-blue-700">
                  Operasikan sistem atas nama outlet tertentu untuk membuat atau menerima PO.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedOutletId}
                onChange={(e) => setSelectedOutletId(e.target.value)}
                className="bg-white border border-blue-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm min-w-50"
              >
                <option value="">-- Semua Cabang Outlet --</option>
                {outletLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Filter Status Buttons */}
        <div className="flex gap-1.5 flex-wrap bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm">
          {statuses.map((s) => {
            const cfg = s ? STATUS_CONFIG[s] : null;
            return (
              <button
                key={s || 'all'}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${filterStatus === s
                    ? 'bg-emerald-700 text-white font-semibold shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                  }`}
              >
                {s ? (cfg?.label || s) : 'Semua Status'}
              </button>
            );
          })}
        </div>

        {/* PO Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 size={24} className="animate-spin mr-2 text-emerald-700" /> Memuat data PO...
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <ShoppingCart size={40} className="mb-3 opacity-30 text-slate-400" />
              <p className="font-semibold text-slate-700 text-sm">Belum ada request PO</p>
              <p className="text-xs text-slate-400 mt-1">Klik tombol &quot;Buat Request Baru&quot; untuk mengajukan permintaan ke HO.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold">No. PO</th>
                    <th className="px-5 py-3 text-left font-semibold">Cabang Pemesan</th>
                    <th className="px-5 py-3 text-left font-semibold">Tanggal</th>
                    <th className="px-5 py-3 text-left font-semibold">Dibuat oleh</th>
                    <th className="px-5 py-3 text-center font-semibold">Total Item</th>
                    <th className="px-5 py-3 text-left font-semibold">Status</th>
                    <th className="px-5 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((po) => {
                    const totalQty = po.requestLines?.reduce((s, l) => s + l.qtyRequested, 0) || 0;
                    const totalFulfilled = po.requestLines?.reduce((s, l) => s + l.qtyFulfilled, 0) || 0;
                    const isDispatched = ['DISPATCHED', 'PARTIAL_HOLD'].includes(po.status);

                    return (
                      <tr key={po.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-xs font-bold text-slate-800">{po.id}</td>
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-slate-800">{po.destLocation?.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{po.destLocation?.code}</div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">
                          {new Date(po.createdAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">{po.requestedBy}</td>
                        <td className="px-5 py-3.5 text-center">
                          <span className="text-slate-800 font-bold">{totalFulfilled}</span>
                          <span className="text-slate-400">/{totalQty}</span>
                          <span className="text-slate-400 text-[10px] ml-1">keping</span>
                        </td>
                        <td className="px-5 py-3.5"><StatusBadge status={po.status} /></td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isDispatched && (
                              <button
                                onClick={() => setRfidPairingPo(po)}
                                className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-sm transition-colors"
                                title="Terima & Pairing Tag RFID"
                              >
                                <Radio size={12} className="animate-pulse" />
                                <span>Terima RFID</span>
                              </button>
                            )}

                            <button
                              onClick={() => setSelectedPo(po)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-[11px] flex items-center gap-1 transition-colors"
                            >
                              <Eye size={13} />
                              <span>Detail</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreatePoModal
          outletLocations={outletLocations}
          isSuperAdmin={isSuperAdmin}
          selectedOutletId={selectedOutletId}
          onClose={() => setShowCreate(false)}
          onCreated={(po) => {
            setShowCreate(false);
            fetchOrders();
            setSelectedPo(po);
          }}
        />
      )}

      {selectedPo && (
        <PoDetailModal
          po={selectedPo}
          userRole={user?.role || ''}
          onClose={() => setSelectedPo(null)}
          onRefresh={fetchOrders}
          onOpenRfidPairing={(poToPair) => setRfidPairingPo(poToPair)}
        />
      )}

      {rfidPairingPo && (
        <RfidPairingModal
          po={rfidPairingPo}
          onClose={() => setRfidPairingPo(null)}
          onSuccess={fetchOrders}
        />
      )}
    </DashboardLayout>
  );
}
