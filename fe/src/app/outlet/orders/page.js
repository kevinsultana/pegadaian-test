'use client';
import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import {
  ShoppingCart, Plus, ChevronRight, FileText, Clock, CheckCircle,
  XCircle, Truck, Package, AlertCircle, Trash2, Send, Eye,
  RefreshCw, ChevronDown, Loader2
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
  RECEIVED: { label: 'Diterima', color: 'bg-green-100 text-green-700', icon: CheckCircle },
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

function CreatePoModal({ onClose, onCreated }) {
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([{ goldBrand: 'ANTAM', weightGrams: 10, qtyRequested: 1, notes: '' }]);
  const [loading, setLoading] = useState(false);

  const addLine = () => setLines([...lines, { goldBrand: 'ANTAM', weightGrams: 10, qtyRequested: 1, notes: '' }]);
  const removeLine = (i) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i, field, val) => {
    const updated = [...lines];
    updated[i] = { ...updated[i], [field]: val };
    setLines(updated);
  };

  const submit = async () => {
    if (lines.length === 0) return toast.error('Tambahkan minimal 1 item');
    setLoading(true);
    try {
      const res = await apiRequest('/outlet/orders', {
        method: 'POST',
        body: JSON.stringify({ notes, requestLines: lines }),
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Buat Request Emas ke HO</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-slate-700">Daftar Permintaan Emas</label>
              <button onClick={addLine} className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 font-medium">
                <Plus size={14} /> Tambah Baris
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center bg-slate-50 rounded-lg p-3">
                  <div className="col-span-4">
                    <select
                      value={line.goldBrand}
                      onChange={(e) => updateLine(i, 'goldBrand', e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {GOLD_BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <select
                      value={line.weightGrams}
                      onChange={(e) => updateLine(i, 'weightGrams', Number(e.target.value))}
                      className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {WEIGHTS.map((w) => <option key={w} value={w}>{w}g</option>)}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500">Qty:</span>
                      <input
                        type="number"
                        min={1}
                        value={line.qtyRequested}
                        onChange={(e) => updateLine(i, 'qtyRequested', Number(e.target.value))}
                        className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Catatan (opsional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Tambahkan catatan untuk HO..."
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
            Batal
          </button>
          <button onClick={submit} disabled={loading} className="flex-1 px-4 py-2.5 bg-emerald-700 text-white rounded-xl text-sm font-medium hover:bg-emerald-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {loading && <Loader2 size={14} className="animate-spin" />}
            Simpan Draft
          </button>
        </div>
      </div>
    </div>
  );
}

function PoDetailModal({ po, onClose, onRefresh, userRole }) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(po);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await apiRequest(`/outlet/orders/${po.id}`);
      if (res && res.data) setDetail(res.data);
    } catch (err) {
      console.error(err);
    }
  }, [po.id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const action = async (endpoint, method = 'PATCH', body = {}, successMsg) => {
    setLoading(true);
    try {
      const res = await apiRequest(`/outlet/orders/${po.id}/${endpoint}`, {
        method,
        body: JSON.stringify(body),
      });
      toast.success(successMsg || res.message || 'Berhasil');
      onRefresh();
      fetchDetail();
    } catch (err) {
      toast.error(err.message || 'Gagal memproses aksi');
    } finally {
      setLoading(false);
    }
  };

  const confirmAction = async (endpoint, msg, successMsg, body = {}) => {
    const result = await Swal.fire({
      title: 'Konfirmasi',
      text: msg,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Ya, Lanjutkan',
      cancelButtonText: 'Batal',
    });
    if (result.isConfirmed) await action(endpoint, 'PATCH', body, successMsg);
  };

  const totalQty = detail.requestLines?.reduce((s, l) => s + l.qtyRequested, 0) || 0;
  const totalFulfilled = detail.requestLines?.reduce((s, l) => s + l.qtyFulfilled, 0) || 0;
  const isOutletSupervisor = userRole === 'OUTLET_SUPERVISOR' || userRole === 'SUPER_ADMIN';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{detail.id}</h2>
            <StatusBadge status={detail.status} />
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-slate-500">Dibuat oleh:</span><span className="ml-2 font-medium text-slate-700">{detail.requestedBy}</span></div>
            <div><span className="text-slate-500">Tanggal:</span><span className="ml-2 font-medium text-slate-700">{new Date(detail.createdAt).toLocaleDateString('id-ID')}</span></div>
            {detail.outletApprovedBy && <div><span className="text-slate-500">Disetujui SPV:</span><span className="ml-2 font-medium text-slate-700">{detail.outletApprovedBy}</span></div>}
            {detail.hoApprovedBy && <div><span className="text-slate-500">Disetujui HO:</span><span className="ml-2 font-medium text-slate-700">{detail.hoApprovedBy}</span></div>}
            {detail.kurirName && <div><span className="text-slate-500">Kurir:</span><span className="ml-2 font-medium text-slate-700">{detail.kurirName}</span></div>}
            {detail.vehicleNumber && <div><span className="text-slate-500">Kendaraan:</span><span className="ml-2 font-medium text-slate-700">{detail.vehicleNumber}</span></div>}
            {detail.trackingNumber && <div className="col-span-2"><span className="text-slate-500">No. Surat Jalan:</span><span className="ml-2 font-medium text-emerald-700">{detail.trackingNumber}</span></div>}
          </div>

          {/* Warning Banner if WAITING_RESTOCK */}
          {detail.status === 'WAITING_RESTOCK' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900 space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-amber-600 shrink-0" />
                <p className="font-semibold text-sm text-amber-800">PO Sedang Ditahan — Menunggu Restock di Head Office</p>
              </div>
              <p className="text-xs text-amber-700">
                Stok fisik emas di Vault HO saat ini belum mencukupi atau sedang menunggu pengadaan inbound. HO akan memproses pengiriman setelah fisik emas tersedia.
              </p>
              {detail.hoNote && (
                <div className="mt-2 pt-2 border-t border-amber-200/60 text-xs">
                  <span className="font-semibold text-amber-800">Catatan / Estimasi dari HO:</span>
                  <p className="text-amber-900 mt-0.5 font-medium">{detail.hoNote}</p>
                </div>
              )}
            </div>
          )}

          {/* Notice if partial dispatch or special HO Note */}
          {detail.status !== 'WAITING_RESTOCK' && detail.hoNote && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 space-y-1">
              <p className="font-semibold text-blue-800">Keterangan / Catatan dari HO:</p>
              <p className="text-blue-700">{detail.hoNote}</p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Permintaan Emas ({totalFulfilled}/{totalQty} terpenuhi)</h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs">
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
                      <td className="px-4 py-2.5 font-medium text-slate-700">{line.goldBrand}</td>
                      <td className="px-4 py-2.5 text-slate-600">{line.weightGrams}g</td>
                      <td className="px-4 py-2.5 text-center text-slate-700 font-semibold">{line.qtyRequested}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-mono font-medium ${
                          line.availableStock >= line.qtyRequested
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
                        <span className={line.qtyFulfilled >= (line.qtyApproved ?? line.qtyRequested) ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>
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
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Item Dikirim ({detail.items.length} keping)</h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs">
                    <tr>
                      <th className="px-4 py-2 text-left">Serial</th>
                      <th className="px-4 py-2 text-left">Merk</th>
                      <th className="px-4 py-2 text-left">Berat</th>
                      <th className="px-4 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.items.map((poi) => (
                      <tr key={poi.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{poi.item?.id || poi.itemId}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-700">{poi.item?.brand || '-'}</td>
                        <td className="px-4 py-2.5 text-slate-600">{poi.item?.weight}g</td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">{poi.item?.currentStatus || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {detail.notes && (
            <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-600">
              <span className="font-medium text-slate-700">Catatan:</span> {detail.notes}
            </div>
          )}
        </div>

        <div className="flex gap-2 p-6 border-t border-slate-100 flex-wrap">
          {detail.status === 'DRAFT' && (
            <button
              onClick={() => confirmAction('submit-to-spv', 'Submit PO ini ke Supervisor Outlet?', 'PO berhasil disubmit')}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              <Send size={14} /> Submit ke SPV
            </button>
          )}
          {detail.status === 'PENDING_OUTLET_SPV' && isOutletSupervisor && (
            <>
              <button
                onClick={() => confirmAction('approve-outlet', 'Setujui dan kirim PO ini ke HO?', 'PO disetujui dan dikirim ke HO')}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-xl text-sm font-medium hover:bg-emerald-800 disabled:opacity-60"
              >
                <CheckCircle size={14} /> Setujui & Kirim ke HO
              </button>
              <button
                onClick={() => confirmAction('reject-outlet', 'Tolak PO ini?', 'PO ditolak')}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-medium hover:bg-red-100 disabled:opacity-60"
              >
                <XCircle size={14} /> Tolak
              </button>
            </>
          )}
          {['DISPATCHED', 'PARTIAL_HOLD'].includes(detail.status) && (
            <button
              onClick={() => confirmAction('receive', 'Konfirmasi penerimaan emas ini?', 'Emas berhasil diterima')}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-xl text-sm font-medium hover:bg-emerald-800 disabled:opacity-60"
            >
              <CheckCircle size={14} /> Konfirmasi Diterima
            </button>
          )}
          <button onClick={onClose} className="ml-auto px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OutletOrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPo, setSelectedPo] = useState(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterStatus) params.status = filterStatus;
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
  }, [filterStatus]);

  useEffect(() => {
    if (!authLoading) {
      fetchOrders();
    }
  }, [fetchOrders, authLoading]);

  const statuses = ['', 'DRAFT', 'PENDING_OUTLET_SPV', 'SUBMITTED_TO_HO', 'WAITING_RESTOCK', 'APPROVED_HO', 'PICKING', 'DISPATCHED', 'PARTIAL_HOLD', 'RECEIVED', 'REJECTED'];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Request Emas ke HO</h1>
            <p className="text-sm text-slate-500 mt-0.5">Kelola permintaan pengiriman emas dari Head Office</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchOrders} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
              <RefreshCw size={16} />
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-xl text-sm font-medium hover:bg-emerald-800 transition-colors"
            >
              <Plus size={16} /> Buat Request Baru
            </button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {statuses.map((s) => {
            const cfg = s ? STATUS_CONFIG[s] : null;
            return (
              <button
                key={s || 'all'}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterStatus === s
                    ? 'bg-emerald-700 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {s ? (cfg?.label || s) : 'Semua'}
              </button>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 size={24} className="animate-spin mr-2" /> Memuat...
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <ShoppingCart size={40} className="mb-3 opacity-30" />
              <p className="font-medium">Belum ada request PO</p>
              <p className="text-xs mt-1">Klik &ldquo;Buat Request Baru&rdquo; untuk memulai</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">No. PO</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">Tanggal</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">Dibuat oleh</th>
                  <th className="px-5 py-3 text-center font-medium text-slate-500">Total Item</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((po) => {
                  const totalQty = po.requestLines?.reduce((s, l) => s + l.qtyRequested, 0) || 0;
                  const totalFulfilled = po.requestLines?.reduce((s, l) => s + l.qtyFulfilled, 0) || 0;
                  return (
                    <tr key={po.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-700">{po.id}</td>
                      <td className="px-5 py-3.5 text-slate-600">{new Date(po.createdAt).toLocaleDateString('id-ID')}</td>
                      <td className="px-5 py-3.5 text-slate-600">{po.requestedBy}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="text-slate-700 font-medium">{totalFulfilled}</span>
                        <span className="text-slate-400">/{totalQty}</span>
                        <span className="text-slate-400 text-xs ml-1">pcs</span>
                      </td>
                      <td className="px-5 py-3.5"><StatusBadge status={po.status} /></td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => setSelectedPo(po)}
                          className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 font-medium"
                        >
                          <Eye size={13} /> Detail
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

      {showCreate && (
        <CreatePoModal
          onClose={() => setShowCreate(false)}
          onCreated={(po) => { setShowCreate(false); fetchOrders(); setSelectedPo(po); }}
        />
      )}
      {selectedPo && (
        <PoDetailModal
          po={selectedPo}
          userRole={user?.role || ''}
          onClose={() => setSelectedPo(null)}
          onRefresh={fetchOrders}
        />
      )}
    </DashboardLayout>
  );
}
