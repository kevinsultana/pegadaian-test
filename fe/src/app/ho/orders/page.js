'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import {
  ShoppingCart, CheckCircle, XCircle, Truck, Package, Clock,
  Search, RefreshCw, Loader2, QrCode, Trash2, Printer, AlertTriangle,
  ChevronRight, FileText, Send, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';

const STATUS_CONFIG = {
  DRAFT: { label: 'Draft', color: 'bg-slate-100 text-slate-600' },
  PENDING_OUTLET_SPV: { label: 'Menunggu SPV Outlet', color: 'bg-amber-100 text-amber-700' },
  SUBMITTED_TO_HO: { label: 'Masuk ke HO', color: 'bg-blue-100 text-blue-700' },
  APPROVED_HO: { label: 'Disetujui HO', color: 'bg-emerald-100 text-emerald-700' },
  PICKING: { label: 'Proses Picking', color: 'bg-violet-100 text-violet-700' },
  PARTIAL_HOLD: { label: 'Dikirim Sebagian', color: 'bg-orange-100 text-orange-700' },
  DISPATCHED: { label: 'Dikirim', color: 'bg-cyan-100 text-cyan-700' },
  RECEIVED: { label: 'Diterima', color: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Ditolak', color: 'bg-red-100 text-red-700' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'bg-slate-100 text-slate-600' };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>;
}

// ─── SURAT JALAN PRINT MODAL ──────────────────────────────────────────────────
function SuratJalanModal({ suratJalan, onClose }) {
  const printRef = useRef();
  const handlePrint = () => {
    const content = printRef.current.innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Surat Jalan - ${suratJalan.documentNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; padding: 24px; color: #1e293b; }
        h1 { font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 4px; }
        .subtitle { text-align: center; color: #64748b; margin-bottom: 20px; font-size: 11px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
        .info-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; }
        .info-box label { font-size: 10px; color: #64748b; display: block; margin-bottom: 2px; }
        .info-box span { font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11px; }
        th { background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; font-weight: 600; }
        td { border: 1px solid #e2e8f0; padding: 6px 10px; }
        .footer { margin-top: 32px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
        .sign-box { text-align: center; border-top: 1px solid #94a3b8; padding-top: 4px; margin-top: 60px; font-size: 10px; }
        @media print { body { margin: 0; } }
      </style></head><body>${content}</body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Surat Jalan - {suratJalan.documentNumber}</h2>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800">
              <Printer size={14} /> Print
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold px-2">×</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6" ref={printRef}>
          <h1>SURAT JALAN PENGIRIMAN EMAS</h1>
          <p className="subtitle">PT Pegadaian (Persero) — Smart Vault Management System</p>
          
          <div className="grid grid-cols-2 gap-4 mb-5 text-sm">
            <div className="bg-slate-50 rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Informasi Dokumen</h3>
              <div className="flex justify-between"><span className="text-slate-500">No. Dokumen</span><span className="font-semibold text-slate-700">{suratJalan.documentNumber}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">No. PO</span><span className="font-semibold text-slate-700">{suratJalan.poId}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Tanggal</span><span className="font-semibold text-slate-700">{new Date(suratJalan.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</span></div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Pengiriman</h3>
              <div className="flex justify-between"><span className="text-slate-500">Kurir</span><span className="font-semibold text-slate-700">{suratJalan.kurirName || '-'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Kendaraan</span><span className="font-semibold text-slate-700">{suratJalan.vehicleNumber || '-'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Petugas HO</span><span className="font-semibold text-slate-700">{suratJalan.pickerName || '-'}</span></div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 space-y-1">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Dari</h3>
              <p className="font-semibold text-slate-700">{suratJalan.from?.name}</p>
              <p className="text-xs text-slate-500">{suratJalan.from?.code}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 space-y-1">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Kepada</h3>
              <p className="font-semibold text-slate-700">{suratJalan.to?.name}</p>
              <p className="text-xs text-slate-500">{suratJalan.to?.code}</p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden mb-5">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs">
                <tr>
                  <th className="px-4 py-2 text-left">No</th>
                  <th className="px-4 py-2 text-left">Serial</th>
                  <th className="px-4 py-2 text-left">Merk</th>
                  <th className="px-4 py-2 text-left">Berat</th>
                  <th className="px-4 py-2 text-left">Kemurnian</th>
                  <th className="px-4 py-2 text-left">Lokasi Asal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suratJalan.items?.map((item, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2.5 text-slate-500">{i + 1}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{item.serialNumber}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-700">{item.brand}</td>
                    <td className="px-4 py-2.5 text-slate-600">{item.weight}g</td>
                    <td className="px-4 py-2.5 text-slate-600">{item.purity}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{item.location}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 text-sm font-semibold">
                <tr>
                  <td colSpan={3} className="px-4 py-2.5 text-slate-700">Total</td>
                  <td className="px-4 py-2.5 text-slate-700">{suratJalan.totalWeight}g</td>
                  <td colSpan={2} className="px-4 py-2.5 text-slate-500">{suratJalan.totalItems} keping emas</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="grid grid-cols-3 gap-6 mt-10">
            {[{ label: 'Petugas HO', name: suratJalan.dispatchedBy }, { label: 'Kurir / Pengantar', name: suratJalan.kurirName }, { label: 'Petugas Outlet Penerima', name: '' }].map((s, i) => (
              <div key={i} className="text-center text-sm">
                <div className="h-14 border-b border-slate-300 mb-2" />
                <p className="text-xs font-medium text-slate-600">{s.label}</p>
                {s.name && <p className="text-xs text-slate-500">({s.name})</p>}
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">Digenerate pada {new Date(suratJalan.generatedAt).toLocaleString('id-ID')} oleh {suratJalan.generatedBy}</p>
        </div>
      </div>
    </div>
  );
}

// ─── SCAN ITEM MODAL ─────────────────────────────────────────────────────────
function ScanItemModal({ po, onClose, onItemAdded }) {
  const [step, setStep] = useState('cabinet'); // cabinet | slot | drawer | item
  const [cabinetQr, setCabinetQr] = useState('');
  const [slotNumber, setSlotNumber] = useState('');
  const [drawerQr, setDrawerQr] = useState('');
  const [itemQr, setItemQr] = useState('');
  const [loading, setLoading] = useState(false);

  const steps = [
    { key: 'cabinet', label: 'Scan QR Lemari', hint: 'Scan QR Code pada lemari' },
    { key: 'slot', label: 'Nomor Slot', hint: 'Masukkan nomor slot (1-8)' },
    { key: 'drawer', label: 'Scan QR Laci', hint: 'Scan QR Code pada laci' },
    { key: 'item', label: 'Scan QR Emas', hint: 'Scan QR Code pada keping emas' },
  ];
  const stepIdx = steps.findIndex((s) => s.key === step);

  const handleScan = async () => {
    if (step !== 'item') {
      const nextSteps = { cabinet: 'slot', slot: 'drawer', drawer: 'item' };
      setStep(nextSteps[step]);
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest(`/ho/orders/${po.id}/scan-item`, {
        method: 'PATCH',
        body: JSON.stringify({ cabinetQr, slotNumber: Number(slotNumber), drawerQr, itemQr }),
      });
      toast.success(res.message || 'Item berhasil ditambahkan ke picking list');
      onItemAdded(res.data);
      // Reset for next scan
      setStep('cabinet'); setCabinetQr(''); setSlotNumber(''); setDrawerQr(''); setItemQr('');
    } catch (err) {
      toast.error(err.message || 'Gagal scan item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Scan Item Emas</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
        </div>
        <div className="p-5 space-y-5">
          {/* Step indicator */}
          <div className="flex items-center gap-1">
            {steps.map((s, i) => (
              <div key={s.key} className="flex items-center gap-1 flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  i < stepIdx ? 'bg-emerald-600 text-white' : i === stepIdx ? 'bg-emerald-700 text-white ring-2 ring-emerald-200' : 'bg-slate-100 text-slate-400'
                }`}>{i + 1}</div>
                {i < steps.length - 1 && <div className={`flex-1 h-0.5 ${i < stepIdx ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
              </div>
            ))}
          </div>

          {/* Current step */}
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">{steps[stepIdx]?.hint}</p>
            <p className="text-sm font-semibold text-slate-700 mb-3">{steps[stepIdx]?.label}</p>
            {step === 'cabinet' && (
              <input
                value={cabinetQr}
                onChange={(e) => setCabinetQr(e.target.value)}
                placeholder="QR Code Lemari (e.g. QR-CAB-HO-01)"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus
              />
            )}
            {step === 'slot' && (
              <input
                type="number"
                min={1}
                max={8}
                value={slotNumber}
                onChange={(e) => setSlotNumber(e.target.value)}
                placeholder="Nomor slot (1-8)"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus
              />
            )}
            {step === 'drawer' && (
              <input
                value={drawerQr}
                onChange={(e) => setDrawerQr(e.target.value)}
                placeholder="QR Code Laci"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus
              />
            )}
            {step === 'item' && (
              <input
                value={itemQr}
                onChange={(e) => setItemQr(e.target.value)}
                placeholder="QR Code Emas"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus
              />
            )}
          </div>

          {/* Scan summary */}
          {(cabinetQr || slotNumber || drawerQr) && (
            <div className="text-xs text-slate-500 space-y-1 bg-slate-50 rounded-lg p-3">
              {cabinetQr && <div>🗄 Lemari: <span className="font-medium text-slate-700">{cabinetQr}</span></div>}
              {slotNumber && <div>🔢 Slot: <span className="font-medium text-slate-700">{slotNumber}</span></div>}
              {drawerQr && <div>📦 Laci: <span className="font-medium text-slate-700">{drawerQr}</span></div>}
            </div>
          )}

          <div className="flex gap-2">
            {stepIdx > 0 && (
              <button onClick={() => setStep(steps[stepIdx - 1].key)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">
                Kembali
              </button>
            )}
            <button
              onClick={handleScan}
              disabled={loading || (step === 'cabinet' && !cabinetQr) || (step === 'slot' && !slotNumber) || (step === 'drawer' && !drawerQr) || (step === 'item' && !itemQr)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-xl text-sm font-medium hover:bg-emerald-800 disabled:opacity-60"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {step === 'item' ? 'Tambahkan Item' : 'Lanjut →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DISPATCH MODAL ───────────────────────────────────────────────────────────
function DispatchModal({ po, onClose, onDispatched }) {
  const [kurirName, setKurirName] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [dispatchNote, setDispatchNote] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!kurirName || !vehicleNumber) return toast.error('Nama kurir dan nomor kendaraan wajib diisi');
    setLoading(true);
    try {
      const res = await apiRequest(`/ho/orders/${po.id}/dispatch`, {
        method: 'PATCH',
        body: JSON.stringify({ kurirName, vehicleNumber, dispatchNote }),
      });
      toast.success(res.message || 'PO berhasil di-dispatch');
      onDispatched(res.data);
    } catch (err) {
      toast.error(err.message || 'Gagal dispatch');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Dispatch Pengiriman</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Nama Kurir *</label>
            <input value={kurirName} onChange={(e) => setKurirName(e.target.value)}
              placeholder="Nama kurir pengiriman"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Nomor Kendaraan *</label>
            <input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)}
              placeholder="B 1234 ABC"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Catatan (opsional)</label>
            <textarea value={dispatchNote} onChange={(e) => setDispatchNote(e.target.value)}
              rows={2} placeholder="Catatan pengiriman..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">
              Batal
            </button>
            <button onClick={submit} disabled={loading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 text-white rounded-xl text-sm font-medium hover:bg-emerald-800 disabled:opacity-60">
              {loading && <Loader2 size={14} className="animate-spin" />}
              <Truck size={14} /> Kirim Sekarang
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PO DETAIL MODAL ──────────────────────────────────────────────────────────
function HoPoDetailModal({ po: initialPo, userRole, onClose, onRefresh }) {
  const [po, setPo] = useState(initialPo);
  const [loading, setLoading] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [showDispatch, setShowDispatch] = useState(false);
  const [suratJalan, setSuratJalan] = useState(null);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await apiRequest(`/ho/orders/${initialPo.id}`);
      if (res.success && res.data) setPo(res.data);
    } catch (err) {
      console.error(err);
    }
  }, [initialPo.id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const apiAction = async (endpoint, body = {}, successMsg) => {
    setLoading(true);
    try {
      const res = await apiRequest(`/ho/orders/${po.id}/${endpoint}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      toast.success(successMsg || res.message || 'Berhasil');
      fetchDetail();
      onRefresh();
    } catch (err) {
      toast.error(err.message || 'Gagal memproses aksi');
    } finally {
      setLoading(false);
    }
  };

  const confirmAction = async (endpoint, confirmMsg, successMsg, body = {}) => {
    const result = await Swal.fire({
      title: 'Konfirmasi',
      text: confirmMsg,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Ya, Lanjutkan',
      cancelButtonText: 'Batal',
    });
    if (result.isConfirmed) await apiAction(endpoint, body, successMsg);
  };

  const removeItem = async (itemId) => {
    const result = await Swal.fire({
      title: 'Hapus item dari picking?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    await apiAction('remove-item', { itemId }, 'Item dihapus dari picking list');
  };

  const loadSuratJalan = async () => {
    try {
      const res = await apiRequest(`/ho/orders/${po.id}/surat-jalan`);
      if (res.success && res.data) {
        setSuratJalan(res.data);
      }
    } catch (err) {
      toast.error(err.message || 'Gagal memuat surat jalan');
    }
  };

  const isSupervisor = ['HO_SUPERVISOR', 'SUPER_ADMIN'].includes(userRole);
  const isStaff = ['HO_STAFF', 'HO_LOGISTICS', 'HO_SUPERVISOR', 'SUPER_ADMIN'].includes(userRole);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-800">{po.id}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <StatusBadge status={po.status} />
                  <span className="text-xs text-slate-400">{po.destLocation?.name}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Outlet</p>
                <p className="font-medium text-slate-700">{po.destLocation?.name}</p>
                <p className="text-xs text-slate-500">Requested by: {po.requestedBy}</p>
                {po.outletApprovedBy && <p className="text-xs text-slate-500">SPV Outlet: {po.outletApprovedBy}</p>}
              </div>
              <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">HO Progress</p>
                {po.hoApprovedBy && <p className="text-xs text-slate-700">✓ Disetujui: {po.hoApprovedBy}</p>}
                {po.pickerName && <p className="text-xs text-slate-700">📦 Picker: {po.pickerName}</p>}
                {po.kurirName && <p className="text-xs text-slate-700">🚚 Kurir: {po.kurirName} ({po.vehicleNumber})</p>}
                {po.trackingNumber && <p className="text-xs text-emerald-700 font-medium">📋 {po.trackingNumber}</p>}
              </div>
            </div>

            {/* Request Lines */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Permintaan Emas</h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs">
                    <tr>
                      <th className="px-4 py-2 text-left">Merk</th>
                      <th className="px-4 py-2 text-left">Berat</th>
                      <th className="px-4 py-2 text-center">Diminta</th>
                      <th className="px-4 py-2 text-center">Terpenuhi</th>
                      <th className="px-4 py-2 text-center">Sisa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(po.requestLines || []).map((line) => (
                      <tr key={line.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-slate-700">{line.goldBrand}</td>
                        <td className="px-4 py-2.5 text-slate-600">{line.weightGrams}g</td>
                        <td className="px-4 py-2.5 text-center text-slate-700">{line.qtyRequested}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`font-medium ${line.qtyFulfilled >= line.qtyRequested ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {line.qtyFulfilled}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center text-slate-500">{line.qtyRequested - line.qtyFulfilled}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Picked Items */}
            {po.items && po.items.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Item Dipicking ({po.items.length} keping)</h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs">
                      <tr>
                        <th className="px-4 py-2 text-left">Serial</th>
                        <th className="px-4 py-2 text-left">Merk</th>
                        <th className="px-4 py-2 text-left">Berat</th>
                        <th className="px-4 py-2 text-left">Lokasi</th>
                        {po.status === 'PICKING' && <th className="px-4 py-2"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {po.items.map((poi) => (
                        <tr key={poi.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{poi.item?.id || poi.itemId}</td>
                          <td className="px-4 py-2.5 font-medium text-slate-700">{poi.item?.brand || '-'}</td>
                          <td className="px-4 py-2.5 text-slate-600">{poi.item?.weight}g</td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">
                            {poi.item?.drawer ? `${poi.item.drawer.slot?.cabinet?.code} / Slot ${poi.item.drawer.slot?.slotNumber} / ${poi.item.drawer.code}` : '-'}
                          </td>
                          {po.status === 'PICKING' && (
                            <td className="px-4 py-2.5">
                              <button onClick={() => removeItem(poi.item?.id || poi.itemId)} className="text-red-400 hover:text-red-600">
                                <Trash2 size={13} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Action bar */}
          <div className="flex gap-2 p-5 border-t border-slate-100 flex-wrap">
            {/* Approve (HO SPV) */}
            {po.status === 'SUBMITTED_TO_HO' && isSupervisor && (
              <>
                <button onClick={() => confirmAction('approve', 'Setujui PO ini dan mulai proses picking?', 'PO disetujui oleh HO')}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-xl text-sm font-medium hover:bg-emerald-800 disabled:opacity-60">
                  <CheckCircle size={14} /> Setujui PO
                </button>
                <button onClick={() => confirmAction('reject', 'Tolak PO ini?', 'PO ditolak')}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-medium hover:bg-red-100 disabled:opacity-60">
                  <XCircle size={14} /> Tolak
                </button>
              </>
            )}
            {/* Start Picking */}
            {po.status === 'APPROVED_HO' && isStaff && (
              <button onClick={() => confirmAction('start-picking', 'Mulai proses picking untuk PO ini?', 'Proses picking dimulai')}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 disabled:opacity-60">
                <Package size={14} /> Mulai Picking
              </button>
            )}
            {/* Scan item */}
            {po.status === 'PICKING' && isStaff && (
              <>
                <button onClick={() => setShowScan(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700">
                  <QrCode size={14} /> Scan Item
                </button>
                <button onClick={() => setShowDispatch(true)}
                  disabled={!po.items || po.items.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-xl text-sm font-medium hover:bg-cyan-700 disabled:opacity-60">
                  <Truck size={14} /> Dispatch
                </button>
              </>
            )}
            {/* Print Surat Jalan */}
            {['DISPATCHED', 'PARTIAL_HOLD', 'RECEIVED'].includes(po.status) && (
              <button onClick={loadSuratJalan}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-xl text-sm font-medium hover:bg-slate-800">
                <Printer size={14} /> Surat Jalan
              </button>
            )}
            <button onClick={onClose} className="ml-auto px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">
              Tutup
            </button>
          </div>
        </div>
      </div>

      {showScan && (
        <ScanItemModal po={po} onClose={() => setShowScan(false)} onItemAdded={() => { fetchDetail(); onRefresh(); }} />
      )}
      {showDispatch && (
        <DispatchModal po={po} onClose={() => setShowDispatch(false)} onDispatched={() => { setShowDispatch(false); fetchDetail(); onRefresh(); }} />
      )}
      {suratJalan && (
        <SuratJalanModal suratJalan={suratJalan} onClose={() => setSuratJalan(null)} />
      )}
    </>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function HoOrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('SUBMITTED_TO_HO,APPROVED_HO,PICKING');
  const [search, setSearch] = useState('');
  const [selectedPo, setSelectedPo] = useState(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (search) params.search = search;
      const res = await apiRequest('/ho/orders', { params });
      if (res && res.data) {
        setOrders(res.data.orders || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat data PO');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, search]);

  useEffect(() => {
    if (!authLoading) {
      fetchOrders();
    }
  }, [fetchOrders, authLoading]);

  const filters = [
    { label: 'Aktif', value: 'SUBMITTED_TO_HO,APPROVED_HO,PICKING' },
    { label: 'Masuk ke HO', value: 'SUBMITTED_TO_HO' },
    { label: 'Disetujui', value: 'APPROVED_HO' },
    { label: 'Picking', value: 'PICKING' },
    { label: 'Dikirim', value: 'DISPATCHED,PARTIAL_HOLD' },
    { label: 'Selesai', value: 'RECEIVED' },
    { label: 'Semua', value: '' },
  ];

  // Stats
  const stats = [
    { label: 'Menunggu Approval', value: orders.filter((o) => o.status === 'SUBMITTED_TO_HO').length, color: 'text-blue-600' },
    { label: 'Siap Picking', value: orders.filter((o) => o.status === 'APPROVED_HO').length, color: 'text-violet-600' },
    { label: 'Sedang Picking', value: orders.filter((o) => o.status === 'PICKING').length, color: 'text-amber-600' },
    { label: 'Total PO', value: orders.length, color: 'text-slate-700' },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Manajemen PO Emas</h1>
            <p className="text-sm text-slate-500 mt-0.5">Review, approve, dan kelola proses picking & dispatch ke outlet</p>
          </div>
          <button onClick={fetchOrders} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filter + Search */}
        <div className="flex gap-3 items-center flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilterStatus(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterStatus === f.value ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari No. PO..."
              className="pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 size={24} className="animate-spin mr-2" /> Memuat...
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <ShoppingCart size={40} className="mb-3 opacity-30" />
              <p className="font-medium">Tidak ada PO ditemukan</p>
              <p className="text-xs mt-1">Coba ubah filter atau tunggu order dari outlet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">No. PO</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">Outlet</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">Tanggal</th>
                  <th className="px-5 py-3 text-center font-medium text-slate-500">Diminta</th>
                  <th className="px-5 py-3 text-center font-medium text-slate-500">Dipicked</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((po) => {
                  const totalQty = po.requestLines?.reduce((s, l) => s + l.qtyRequested, 0) || 0;
                  const pickedCount = po.items?.length || 0;
                  return (
                    <tr key={po.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-700">{po.id}</td>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-700">{po.destLocation?.name}</p>
                        <p className="text-xs text-slate-400">{po.requestedBy}</p>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 text-xs">{new Date(po.createdAt).toLocaleDateString('id-ID')}</td>
                      <td className="px-5 py-3.5 text-center text-slate-700 font-medium">{totalQty} pcs</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={pickedCount >= totalQty ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-medium'}>
                          {pickedCount}
                        </span>
                        <span className="text-slate-400">/{totalQty}</span>
                      </td>
                      <td className="px-5 py-3.5"><StatusBadge status={po.status} /></td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => setSelectedPo(po)}
                          className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 font-medium"
                        >
                          <Eye size={13} /> Kelola
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedPo && (
        <HoPoDetailModal
          po={selectedPo}
          userRole={user?.role || ''}
          onClose={() => setSelectedPo(null)}
          onRefresh={fetchOrders}
        />
      )}
    </DashboardLayout>
  );
}
