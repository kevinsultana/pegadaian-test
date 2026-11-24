'use client';
import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  ShoppingCart, Plus, ChevronRight, FileText, Clock, CheckCircle,
  XCircle, Truck, Package, AlertCircle, Trash2, Send, Eye,
  RefreshCw, ChevronDown, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const STATUS_CONFIG = {
  DRAFT: { label: 'Draft', color: 'bg-slate-100 text-slate-600', icon: FileText },
  PENDING_OUTLET_SPV: { label: 'Menunggu SPV', color: 'bg-amber-100 text-amber-700', icon: Clock },
  SUBMITTED_TO_HO: { label: 'Dikirim ke HO', color: 'bg-blue-100 text-blue-700', icon: Send },
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

function CreatePoModal({ onClose, onCreated, token }) {
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
      const res = await fetch(`${API}/outlet/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notes, requestLines: lines }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal membuat PO');
      toast.success('Draft PO berhasil dibuat');
      onCreated(data.data);
    } catch (err) {
      toast.error(err.message);
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
          {/* Request Lines */}
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
          {/* Notes */}
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

function PoDetailModal({ po, onClose, onRefresh, token, userRole }) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(po);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`${API}/outlet/orders/${po.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setDetail(data.data);
    } catch {}
  }, [po.id, token]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const action = async (endpoint, method = 'PATCH', body = {}, successMsg) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/outlet/orders/${po.id}/${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal');
      toast.success(successMsg || data.message);
      onRefresh();
      fetchDetail();
    } catch (err) {
      toast.error(err.message);
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
          {/* Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-slate-500">Dibuat oleh:</span><span className="ml-2 font-medium text-slate-700">{detail.requestedBy}</span></div>
            <div><span className="text-slate-500">Tanggal:</span><span className="ml-2 font-medium text-slate-700">{new Date(detail.createdAt).toLocaleDateString('id-ID')}</span></div>
            {detail.outletApprovedBy && <div><span className="text-slate-500">Disetujui SPV:</span><span className="ml-2 font-medium text-slate-700">{detail.outletApprovedBy}</span></div>}
            {detail.hoApprovedBy && <div><span className="text-slate-500">Disetujui HO:</span><span className="ml-2 font-medium text-slate-700">{detail.hoApprovedBy}</span></div>}
            {detail.kurirName && <div><span className="text-slate-500">Kurir:</span><span className="ml-2 font-medium text-slate-700">{detail.kurirName}</span></div>}
            {detail.vehicleNumber && <div><span className="text-slate-500">Kendaraan:</span><span className="ml-2 font-medium text-slate-700">{detail.vehicleNumber}</span></div>}
            {detail.trackingNumber && <div className="col-span-2"><span className="text-slate-500">No. Surat Jalan:</span><span className="ml-2 font-medium text-emerald-700">{detail.trackingNumber}</span></div>}
          </div>

          {/* Request Lines */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Permintaan Emas ({totalFulfilled}/{totalQty} terpenuhi)</h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs">
                  <tr>
                    <th className="px-4 py-2 text-left">Merk</th>
                    <th className="px-4 py-2 text-left">Berat</th>
                    <th className="px-4 py-2 text-center">Diminta</th>
                    <th className="px-4 py-2 text-center">Terpenuhi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(detail.requestLines || []).map((line) => (
                    <tr key={line.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-700">{line.goldBrand}</td>
                      <td className="px-4 py-2.5 text-slate-600">{line.weightGrams}g</td>
                      <td className="px-4 py-2.5 text-center text-slate-700">{line.qtyRequested}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={line.qtyFulfilled >= line.qtyRequested ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>
                          {line.qtyFulfilled}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Items picked */}
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

        {/* Actions */}
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
          {detail.status === 'PENDING_OUTLET_SPV' && userRole === 'OUTLET_SUPERVISOR' && (
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
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPo, setSelectedPo] = useState(null);
  const [token, setToken] = useState('');
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('token') || '';
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    setToken(t);
    setUserRole(u.role || '');
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const qs = filterStatus ? `?status=${filterStatus}` : '';
      const res = await fetch(`${API}/outlet/orders${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setOrders(data.data?.orders || []);
    } catch (err) {
      toast.error('Gagal memuat data PO');
    } finally {
      setLoading(false);
    }
  }, [token, filterStatus]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const statuses = ['', 'DRAFT', 'PENDING_OUTLET_SPV', 'SUBMITTED_TO_HO', 'APPROVED_HO', 'PICKING', 'DISPATCHED', 'PARTIAL_HOLD', 'RECEIVED', 'REJECTED'];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
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

        {/* Filter */}
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

        {/* Table */}
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
          token={token}
          onClose={() => setShowCreate(false)}
          onCreated={(po) => { setShowCreate(false); fetchOrders(); setSelectedPo(po); }}
        />
      )}
      {selectedPo && (
        <PoDetailModal
          po={selectedPo}
          token={token}
          userRole={userRole}
          onClose={() => setSelectedPo(null)}
          onRefresh={fetchOrders}
        />
      )}
    </DashboardLayout>
  );
}
