'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { showToast, confirmAction, alertSuccess, alertError } from '@/lib/alerts';
import {
  Box,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  Layers,
  QrCode,
  Printer,
  X,
  Loader2,
  AlertCircle,
  Eye,
  Check,
  RefreshCw,
  Building2,
  Trash2,
  Calendar,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';

export default function HOInboundPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [statusCounts, setStatusCounts] = useState({
    ALL: 0,
    DRAFT: 0,
    PENDING_APPROVAL: 0,
    APPROVED: 0,
    RECEIVING: 0,
    COMPLETED: 0,
    REJECTED: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Create Inbound Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    supplierName: 'PT ANTAM (Persero) Tbk',
    notes: 'Pengadaan stok emas batangan reguler HO Vault',
    expectedDate: '',
    submitImmediately: true,
    lines: [
      { goldBrand: 'ANTAM', weightGrams: 10, purity: '999.9', qtyRequested: 5, notes: '' },
    ],
  });

  // Put-away Modal (per keping)
  const [putAwayModalOpen, setPutAwayModalOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [selectedLineId, setSelectedLineId] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [bestRecommendation, setBestRecommendation] = useState(null);
  const [putAwayForm, setPutAwayForm] = useState({
    serialNumber: '',
    drawerCode: '',
    slotPosition: 1,
    notes: '',
  });
  const [puttingAway, setPuttingAway] = useState(false);

  // Stored Item QR Label Modal
  const [qrLabelModal, setQrLabelModal] = useState({ isOpen: false, item: null });

  // Detail Order Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [orderDetail, setOrderDetail] = useState(null);

  const isSupervisorOrAdmin =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'HO_SUPERVISOR' ||
    user?.permissions?.includes('HO_INBOUND_APPROVE');

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (statusFilter !== 'ALL') queryParams.append('status', statusFilter);
      if (search) queryParams.append('search', search);

      const res = await apiRequest(`/ho/inbound?${queryParams.toString()}`);
      if (res.data) {
        setOrders(res.data.orders || []);
        if (res.data.statusCounts) {
          setStatusCounts(res.data.statusCounts);
        }
      }
    } catch (err) {
      console.error(err);
      showToast.error('Gagal memuat daftar PO Inbound');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, search]);

  // Handle Add line in Create Form
  const handleAddLine = () => {
    setCreateForm((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        { goldBrand: 'ANTAM', weightGrams: 5, purity: '999.9', qtyRequested: 1, notes: '' },
      ],
    }));
  };

  const handleRemoveLine = (index) => {
    if (createForm.lines.length <= 1) return;
    setCreateForm((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }));
  };

  const handleLineChange = (index, field, value) => {
    setCreateForm((prev) => {
      const updated = [...prev.lines];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, lines: updated };
    });
  };

  // Submit Create Inbound Order
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      setCreating(true);
      const res = await apiRequest('/ho/inbound', {
        method: 'POST',
        body: JSON.stringify(createForm),
      });

      alertSuccess(
        'Pengajuan Inbound Berhasil',
        `PO Inbound ${res.data?.id || ''} berhasil diajukan untuk persetujuan Supervisor HO.`
      );
      setCreateModalOpen(false);
      // Reset form
      setCreateForm({
        supplierName: 'PT ANTAM (Persero) Tbk',
        notes: 'Pengadaan stok emas batangan reguler HO Vault',
        expectedDate: '',
        submitImmediately: true,
        lines: [
          { goldBrand: 'ANTAM', weightGrams: 10, purity: '999.9', qtyRequested: 5, notes: '' },
        ],
      });
      fetchOrders();
    } catch (err) {
      console.error(err);
      alertError('Gagal Membuat Inbound', err.message || 'Terjadi kesalahan sistem');
    } finally {
      setCreating(false);
    }
  };

  // SPV Approve Action
  const handleApprove = async (orderId) => {
    const confirmed = await confirmAction(
      'Setujui PO Inbound?',
      `Apakah Anda yakin menyetujui pengadaan emas PO ${orderId}? Setelah disetujui, fisik barang siap diterima di HO Vault.`,
      'Ya, Setujui'
    );
    if (!confirmed) return;

    try {
      await apiRequest(`/ho/inbound/${orderId}/approve`, { method: 'PATCH' });
      showToast.success(`PO Inbound ${orderId} berhasil disetujui`);
      fetchOrders();
    } catch (err) {
      console.error(err);
      alertError('Gagal Menyetujui', err.message || 'Terjadi kesalahan sistem');
    }
  };

  // SPV Reject Action
  const handleReject = async (orderId) => {
    const confirmed = await confirmAction(
      'Tolak PO Inbound?',
      `Apakah Anda yakin menolak pengajuan PO Inbound ${orderId}?`,
      'Ya, Tolak'
    );
    if (!confirmed) return;

    try {
      await apiRequest(`/ho/inbound/${orderId}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: 'Ditolak oleh Supervisor HO' }),
      });
      showToast.info(`PO Inbound ${orderId} ditolak`);
      fetchOrders();
    } catch (err) {
      console.error(err);
      alertError('Gagal Menolak', err.message || 'Terjadi kesalahan sistem');
    }
  };

  // Confirm Goods Receipt and Start Put-Away
  const handleStartReceiving = async (orderId) => {
    try {
      const res = await apiRequest(`/ho/inbound/${orderId}/receive`, { method: 'PATCH' });
      showToast.success('Konfirmasi kedatangan fisik berhasil. Memulai proses put-away...');
      openPutAwayModal(orderId);
      fetchOrders();
    } catch (err) {
      console.error(err);
      alertError('Gagal Konfirmasi Kedatangan', err.message);
    }
  };

  // Open Put-Away Modal
  const openPutAwayModal = async (orderId) => {
    try {
      const res = await apiRequest(`/ho/inbound/${orderId}`);
      const order = res.data;
      setActiveOrder(order);

      // Find first unfulfilled line
      const unfulfilledLine = order.lines.find((l) => l.qtyReceived < l.qtyRequested) || order.lines[0];
      const lineId = unfulfilledLine ? unfulfilledLine.id : '';
      setSelectedLineId(lineId);

      // Prepare serial number & fetch recommendations
      prepareNextKeping(unfulfilledLine);

      setPutAwayModalOpen(true);
    } catch (err) {
      console.error(err);
      showToast.error('Gagal membuka modul put-away');
    }
  };

  // Prepare next keping form & fetch intelligent drawer recommendations
  const prepareNextKeping = async (line) => {
    if (!line) return;
    const year = new Date().getFullYear();
    const randomSerial = `LM-${year}-${Math.floor(100000 + Math.random() * 900000)}`;

    setPutAwayForm((prev) => ({
      ...prev,
      serialNumber: randomSerial,
      slotPosition: (line.qtyReceived || 0) + 1,
      notes: `Put-away keping ke-${(line.qtyReceived || 0) + 1} (${line.goldBrand} ${line.weightGrams}g)`,
    }));

    // Fetch drawer recommendations
    try {
      setLoadingRecs(true);
      const recRes = await apiRequest(
        `/ho/inbound/recommendations?brand=${encodeURIComponent(line.goldBrand)}&weight=${line.weightGrams}`
      );
      if (recRes.data) {
        setRecommendations(recRes.data.recommendations || []);
        const best = recRes.data.bestMatch;
        setBestRecommendation(best);
        if (best) {
          setPutAwayForm((prev) => ({
            ...prev,
            drawerCode: best.drawerCode,
          }));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRecs(false);
    }
  };

  // When selected line changes in Put-away modal
  const handleSelectLineInPutAway = (lineId) => {
    setSelectedLineId(lineId);
    if (!activeOrder) return;
    const line = activeOrder.lines.find((l) => l.id === lineId);
    if (line) {
      prepareNextKeping(line);
    }
  };

  // Execute Put-Away for 1 Keping
  const handlePutAwaySubmit = async (e) => {
    e.preventDefault();
    if (!activeOrder || !selectedLineId) return;

    const line = activeOrder.lines.find((l) => l.id === selectedLineId);
    if (!line) return;

    try {
      setPuttingAway(true);
      const res = await apiRequest(`/ho/inbound/${activeOrder.id}/put-away`, {
        method: 'POST',
        body: JSON.stringify({
          lineId: selectedLineId,
          serialNumber: putAwayForm.serialNumber,
          brand: line.goldBrand,
          weight: line.weightGrams,
          purity: line.purity,
          drawerCode: putAwayForm.drawerCode,
          slotPosition: putAwayForm.slotPosition,
          notes: putAwayForm.notes,
        }),
      });

      const savedItem = res.data?.item;
      showToast.success(`Keping emas ${putAwayForm.serialNumber} berhasil disimpan ke vault!`);

      // Refresh current active order data
      const orderRes = await apiRequest(`/ho/inbound/${activeOrder.id}`);
      const updatedOrder = orderRes.data;
      setActiveOrder(updatedOrder);

      // Check if complete
      if (updatedOrder.isCompleted || res.data?.allFulfilled) {
        alertSuccess(
          '🎉 Seluruh Keping Selesai Di-Put-Away!',
          `Semua ${updatedOrder.totalRequested} keping emas untuk PO Inbound ${activeOrder.id} telah tersimpan sempurna di lemari vault HO.`
        );
        setPutAwayModalOpen(false);
        fetchOrders();
      } else {
        // Move to next keping
        const nextLine = updatedOrder.lines.find((l) => l.qtyReceived < l.qtyRequested) || updatedOrder.lines[0];
        setSelectedLineId(nextLine.id);
        prepareNextKeping(nextLine);
        fetchOrders();
      }

      // Offer to show QR sticker label
      if (savedItem) {
        setQrLabelModal({ isOpen: true, item: savedItem });
      }
    } catch (err) {
      console.error(err);
      alertError('Gagal Menyimpan Keping ke Vault', err.message || 'Terjadi kesalahan sistem');
    } finally {
      setPuttingAway(false);
    }
  };

  // Open Detail Modal
  const openDetailModal = async (orderId) => {
    try {
      const res = await apiRequest(`/ho/inbound/${orderId}`);
      setOrderDetail(res.data);
      setDetailModalOpen(true);
    } catch (err) {
      console.error(err);
      showToast.error('Gagal memuat detail PO Inbound');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1 w-fit">
            <Clock className="w-3 h-3" /> Draft Staff
          </span>
        );
      case 'PENDING_APPROVAL':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1 w-fit">
            <Clock className="w-3 h-3 animate-pulse" /> Menunggu SPV HO
          </span>
        );
      case 'APPROVED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1 w-fit">
            <CheckCircle2 className="w-3 h-3" /> Disetujui (Tunggu Tiba)
          </span>
        );
      case 'RECEIVING':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1 w-fit">
            <Layers className="w-3 h-3 animate-bounce" /> Sedang Put-Away Vault
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-fit">
            <Check className="w-3 h-3" /> Selesai Tersimpan
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1 w-fit">
            <X className="w-3 h-3" /> Ditolak
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
              <Box className="w-6 h-6 text-emerald-700" />
              <span>PO Inbound (Pengadaan Stok Emas HO)</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Alur pengadaan emas baru ke Vault HO: Pengajuan staf, persetujuan Supervisor HO, konfirmasi penerimaan fisik, dan put-away cerdas per keping ke lemari modular.
            </p>
          </div>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Pengajuan Inbound</span>
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Menunggu Approval</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{statusCounts.PENDING_APPROVAL}</div>
            <div className="text-[11px] text-amber-600 mt-0.5">Memerlukan review SPV HO</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Disetujui / Tiba</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{statusCounts.APPROVED}</div>
            <div className="text-[11px] text-blue-600 mt-0.5">Siap terima fisik barang</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Proses Put-Away</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{statusCounts.RECEIVING}</div>
            <div className="text-[11px] text-indigo-600 mt-0.5">Penempatan keping ke vault</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Selesai di Vault</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{statusCounts.COMPLETED}</div>
            <div className="text-[11px] text-emerald-600 mt-0.5">Stok aktif di HO</div>
          </div>
        </div>

        {/* Filter Tabs & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs font-medium">
            {[
              { key: 'ALL', label: 'Semua', count: statusCounts.ALL },
              { key: 'PENDING_APPROVAL', label: 'Approval SPV', count: statusCounts.PENDING_APPROVAL },
              { key: 'APPROVED', label: 'Disetujui', count: statusCounts.APPROVED },
              { key: 'RECEIVING', label: 'Put-Away', count: statusCounts.RECEIVING },
              { key: 'COMPLETED', label: 'Selesai', count: statusCounts.COMPLETED },
              { key: 'DRAFT', label: 'Draft', count: statusCounts.DRAFT },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  statusFilter === tab.key
                    ? 'bg-emerald-700 text-white font-semibold shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    statusFilter === tab.key ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari PO, supplier, atau staff..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Table List of PO Inbound */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">No. PO Inbound</th>
                  <th className="py-3 px-4">Pemasok / Supplier</th>
                  <th className="py-3 px-4">Rincian Emas Diminta</th>
                  <th className="py-3 px-4">Progress Put-Away</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
                        <span>Memuat data PO Inbound...</span>
                      </div>
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Box className="w-8 h-8 text-slate-300" />
                        <span className="font-medium text-slate-600">Belum ada PO Inbound</span>
                        <span className="text-xs text-slate-400">
                          Klik tombol &quot;Buat Pengajuan Inbound&quot; untuk mengajukan pengadaan emas baru ke vault.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => {
                    const progressPercent = o.totalRequested > 0 ? Math.round((o.totalReceived / o.totalRequested) * 100) : 0;
                    return (
                      <tr key={o.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 font-mono">{o.id}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {new Date(o.createdAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-800">{o.supplierName}</div>
                          <div className="text-[11px] text-slate-500">Oleh: {o.requestedBy}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            {o.lines.map((l) => (
                              <div key={l.id} className="text-[11px] text-slate-700 flex items-center gap-1.5">
                                <span className="font-semibold">{l.goldBrand}</span>
                                <span>{l.weightGrams}g</span>
                                <span className="text-slate-400">•</span>
                                <span className="text-emerald-700 font-medium">
                                  {l.qtyReceived}/{l.qtyRequested} keping
                                </span>
                              </div>
                            ))}
                            <div className="text-[10px] text-slate-400 font-medium pt-0.5">
                              Total Berat: {o.totalWeightGrams} gram ({o.totalRequested} keping)
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 min-w-[160px]">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="font-medium text-slate-700">{o.totalReceived} / {o.totalRequested} Keping</span>
                            <span className="font-bold text-emerald-700">{progressPercent}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                            <div
                              className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </td>

                        <td className="py-3.5 px-4">{getStatusBadge(o.status)}</td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {/* Action based on status */}
                            {o.status === 'PENDING_APPROVAL' && isSupervisorOrAdmin && (
                              <>
                                <button
                                  onClick={() => handleApprove(o.id)}
                                  className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold text-[11px] flex items-center gap-1 shadow-sm transition-colors"
                                  title="Setujui Pengadaan Inbound"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Setujui</span>
                                </button>
                                <button
                                  onClick={() => handleReject(o.id)}
                                  className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-semibold text-[11px] transition-colors"
                                  title="Tolak Pengadaan"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}

                            {o.status === 'APPROVED' && (
                              <button
                                onClick={() => handleStartReceiving(o.id)}
                                className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-semibold text-[11px] flex items-center gap-1.5 shadow-sm transition-colors"
                              >
                                <Box className="w-3.5 h-3.5" />
                                <span>Terima & Put-Away</span>
                              </button>
                            )}

                            {o.status === 'RECEIVING' && (
                              <button
                                onClick={() => openPutAwayModal(o.id)}
                                className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg font-semibold text-[11px] flex items-center gap-1.5 shadow-sm transition-colors"
                              >
                                <Layers className="w-3.5 h-3.5" />
                                <span>Lanjut Put-Away</span>
                              </button>
                            )}

                            <button
                              onClick={() => openDetailModal(o.id)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-[11px] flex items-center gap-1 transition-colors"
                              title="Detail PO Inbound"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Detail</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL 1: Form Buat Pengajuan Inbound */}
        {createModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl my-8">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-5">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Box className="w-5 h-5 text-emerald-700" />
                    <span>Buat Pengajuan PO Inbound Emas HO</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ajukan pengadaan stok emas baru ke Vault HO. Memerlukan persetujuan Supervisor HO.
                  </p>
                </div>
                <button
                  onClick={() => setCreateModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Nama Supplier / Pemasok <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={createForm.supplierName}
                      onChange={(e) => setCreateForm({ ...createForm, supplierName: e.target.value })}
                      placeholder="Contoh: PT ANTAM (Persero) Tbk, Galeri 24"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-700"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Perkiraan Tanggal Tiba</label>
                    <input
                      type="date"
                      value={createForm.expectedDate}
                      onChange={(e) => setCreateForm({ ...createForm, expectedDate: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Catatan Pengadaan</label>
                  <input
                    type="text"
                    value={createForm.notes}
                    onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                    placeholder="Contoh: Batch pengadaan stok q4 / restock kebutuhan cabang"
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-700"
                  />
                </div>

                {/* Line Items */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Daftar Keping Emas yang Diajukan</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleAddLine}
                      className="text-emerald-700 hover:text-emerald-800 font-semibold text-xs flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Baris</span>
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {createForm.lines.map((line, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap md:flex-nowrap items-center gap-3"
                      >
                        <div className="w-full md:w-36">
                          <label className="block text-[10px] text-slate-500 font-medium mb-0.5">Brand / Merk</label>
                          <select
                            value={line.goldBrand}
                            onChange={(e) => handleLineChange(idx, 'goldBrand', e.target.value)}
                            className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            <option value="ANTAM">ANTAM</option>
                            <option value="UBS">UBS</option>
                            <option value="GALERI24">Galeri 24</option>
                            <option value="LOTUS_ARCHI">Lotus Archi</option>
                          </select>
                        </div>

                        <div className="w-1/2 md:w-28">
                          <label className="block text-[10px] text-slate-500 font-medium mb-0.5">Berat (Gram)</label>
                          <select
                            value={line.weightGrams}
                            onChange={(e) => handleLineChange(idx, 'weightGrams', parseFloat(e.target.value))}
                            className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            <option value={1}>1 Gram</option>
                            <option value={2}>2 Gram</option>
                            <option value={5}>5 Gram</option>
                            <option value={10}>10 Gram</option>
                            <option value={25}>25 Gram</option>
                            <option value={50}>50 Gram</option>
                            <option value={100}>100 Gram</option>
                          </select>
                        </div>

                        <div className="w-1/2 md:w-28">
                          <label className="block text-[10px] text-slate-500 font-medium mb-0.5">Kadar Kemurnian</label>
                          <input
                            type="text"
                            value={line.purity}
                            onChange={(e) => handleLineChange(idx, 'purity', e.target.value)}
                            placeholder="999.9"
                            className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>

                        <div className="w-1/2 md:w-28">
                          <label className="block text-[10px] text-slate-500 font-medium mb-0.5">Jumlah Keping</label>
                          <input
                            type="number"
                            min={1}
                            max={1000}
                            required
                            value={line.qtyRequested}
                            onChange={(e) => handleLineChange(idx, 'qtyRequested', parseInt(e.target.value, 10) || 1)}
                            className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>

                        <div className="w-full md:w-auto flex items-end justify-between md:justify-start gap-2 pt-1 md:pt-4">
                          <div className="text-[11px] text-slate-500 whitespace-nowrap">
                            Total: <span className="font-bold text-slate-800">{line.weightGrams * line.qtyRequested}g</span>
                          </div>

                          {createForm.lines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(idx)}
                              className="text-rose-600 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50"
                              title="Hapus baris"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                  <div className="text-xs text-slate-500">
                    Grand Total:{' '}
                    <span className="font-bold text-slate-900">
                      {createForm.lines.reduce((acc, l) => acc + (l.qtyRequested || 0), 0)} keping
                    </span>{' '}
                    (
                    {createForm.lines.reduce((acc, l) => acc + (l.weightGrams * (l.qtyRequested || 0)), 0)} gram
                    )
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCreateModalOpen(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={creating}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl shadow-sm flex items-center gap-2 disabled:opacity-50 transition-colors"
                    >
                      {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>Ajukan ke Supervisor HO</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: Interactive Put-Away per Keping ke Vault */}
        {putAwayModalOpen && activeOrder && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl my-8">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-emerald-700" />
                    <span>Put-Away Emas ke Lemari Vault HO (Per Keping)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    PO: <span className="font-mono font-bold text-slate-800">{activeOrder.id}</span> • Pemasok:{' '}
                    <span className="font-medium text-slate-800">{activeOrder.supplierName}</span>
                  </p>
                </div>
                <button
                  onClick={() => setPutAwayModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Progress Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-slate-700">Pilih Baris Item yang Ingin Di-Put-Away:</span>
                  <span className="text-[11px] text-slate-500">
                    Total: {activeOrder.totalReceived} / {activeOrder.totalRequested} keping tersimpan
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeOrder.lines.map((l) => {
                    const isSelected = l.id === selectedLineId;
                    const isFulfilled = l.qtyReceived >= l.qtyRequested;
                    return (
                      <button
                        type="button"
                        key={l.id}
                        disabled={isFulfilled}
                        onClick={() => handleSelectLineInPutAway(l.id)}
                        className={`p-2.5 rounded-xl text-left border transition-all flex items-center justify-between ${
                          isFulfilled
                            ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                            : isSelected
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-xs flex items-center gap-1.5">
                            <span>{l.goldBrand}</span>
                            <span>{l.weightGrams}g</span>
                            {isFulfilled && <span className="text-[10px] text-emerald-700 font-medium">✓ Lengkap</span>}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Kadar: {l.purity} • Progress:{' '}
                            <span className="font-semibold text-emerald-700">
                              {l.qtyReceived}/{l.qtyRequested}
                            </span>
                          </div>
                        </div>

                        {isSelected && !isFulfilled && (
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Put-Away Form for Single Keping */}
              <form onSubmit={handlePutAwaySubmit} className="space-y-4 text-xs">
                {/* System Drawer Recommendation Box */}
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-700" />
                      <span>Rekomendasi Laci Cerdas Sistem (AI / Rule Based)</span>
                    </span>
                    {loadingRecs && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />}
                  </div>

                  {bestRecommendation ? (
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white/80 p-2.5 rounded-lg border border-emerald-200">
                        <div>
                          <div className="font-bold text-slate-900 text-xs">
                            {bestRecommendation.cabinetName} ({bestRecommendation.cabinetCode}) ➔ Slot{' '}
                            {bestRecommendation.slotNumber} ➔ Laci {bestRecommendation.drawerName}
                          </div>
                          <div className="text-[11px] text-emerald-700 mt-0.5">
                            ★ {bestRecommendation.reason} ({bestRecommendation.availableCapacity} slot kosong)
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setPutAwayForm((prev) => ({
                              ...prev,
                              drawerCode: bestRecommendation.drawerCode,
                            }))
                          }
                          className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold text-[11px] whitespace-nowrap self-start sm:self-auto transition-colors"
                        >
                          Gunakan Rekomendasi
                        </button>
                      </div>

                      <div className="text-[10px] text-slate-500">
                        Sistem memprioritaskan laci yang sesuai kategori merk & berat emas, serta memiliki kapasitas aman.
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">
                      Pilih item keping di atas untuk melihat rekomendasi laci terbaik.
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Nomor Seri Keping (Serial Number) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={putAwayForm.serialNumber}
                      onChange={(e) =>
                        setPutAwayForm({ ...putAwayForm, serialNumber: e.target.value.toUpperCase() })
                      }
                      placeholder="Contoh: LM-2026-100201"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-700"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Auto-generate nomor seri unik atau sesuaikan dengan fisik emas.
                    </span>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Pilih Laci Vault Tujuan <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={putAwayForm.drawerCode}
                      onChange={(e) => setPutAwayForm({ ...putAwayForm, drawerCode: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-700"
                    >
                      <option value="">-- Pilih Laci Vault --</option>
                      {recommendations.map((rec) => (
                        <option key={rec.drawerId} value={rec.drawerCode}>
                          {rec.cabinetCode} • Slot {rec.slotNumber} • Laci {rec.drawerName} ({rec.availableCapacity} slot sisa)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Posisi Slot Grid di Laci</label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={putAwayForm.slotPosition}
                      onChange={(e) => setPutAwayForm({ ...putAwayForm, slotPosition: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-700"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Catatan Keping</label>
                    <input
                      type="text"
                      value={putAwayForm.notes}
                      onChange={(e) => setPutAwayForm({ ...putAwayForm, notes: e.target.value })}
                      placeholder="Catatan penempatan fisik"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-700"
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setPutAwayModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
                  >
                    Tutup
                  </button>
                  <button
                    type="submit"
                    disabled={puttingAway || !putAwayForm.drawerCode}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl shadow-sm flex items-center gap-2 disabled:opacity-50 transition-colors"
                  >
                    {puttingAway && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Simpan Keping ke Vault & Generate QR</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: Label Stiker QR Code (Printable) */}
        {qrLabelModal.isOpen && qrLabelModal.item && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Label QR Code Keping Emas Vault
                </span>
                <button
                  onClick={() => setQrLabelModal({ isOpen: false, item: null })}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Printable Label View */}
              <div className="bg-slate-50 text-slate-950 p-5 rounded-2xl border-2 border-dashed border-slate-300 inline-block w-full">
                {qrLabelModal.item.qrDataUrl ? (
                  <img
                    src={qrLabelModal.item.qrDataUrl}
                    alt={qrLabelModal.item.id}
                    className="w-36 h-36 mx-auto mb-2 bg-white p-2 rounded-xl border border-slate-200"
                  />
                ) : (
                  <div className="w-36 h-36 mx-auto mb-2 bg-slate-200 rounded-xl flex items-center justify-center text-slate-400">
                    <QrCode className="w-12 h-12" />
                  </div>
                )}

                <div className="font-mono text-sm font-bold tracking-tight text-slate-900">
                  {qrLabelModal.item.id}
                </div>
                <div className="text-xs font-semibold text-emerald-800 mt-0.5">
                  {qrLabelModal.item.brand} • {qrLabelModal.item.weight}g
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  Kadar: {qrLabelModal.item.purity || '999.9'}
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-200/80 text-[10px] text-slate-500">
                  PT PEGADAIAN (PERSERO) • HO VAULT
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Label Stiker</span>
                </button>
                <button
                  onClick={() => setQrLabelModal({ isOpen: false, item: null })}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 4: Detail PO Inbound */}
        {detailModalOpen && orderDetail && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full p-6 shadow-2xl my-8">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Box className="w-5 h-5 text-emerald-700" />
                    <span>Detail PO Inbound: {orderDetail.id}</span>
                  </h3>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Supplier: <span className="font-semibold text-slate-800">{orderDetail.supplierName}</span>
                  </div>
                </div>
                <button
                  onClick={() => setDetailModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                {/* Meta Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Status</span>
                    <div className="mt-0.5">{getStatusBadge(orderDetail.status)}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Diajukan Oleh</span>
                    <span className="font-semibold text-slate-800">{orderDetail.requestedBy}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Disetujui Oleh</span>
                    <span className="font-semibold text-slate-800">{orderDetail.approvedBy || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Penerima Fisik</span>
                    <span className="font-semibold text-slate-800">{orderDetail.receivedBy || '-'}</span>
                  </div>
                </div>

                {/* Lines Table */}
                <div>
                  <h4 className="font-bold text-slate-800 mb-2">Item Rencana Pengadaan:</h4>
                  <table className="w-full border-collapse border border-slate-200 rounded-xl overflow-hidden">
                    <thead className="bg-slate-50 text-slate-500 font-semibold">
                      <tr>
                        <th className="py-2 px-3 text-left">Brand</th>
                        <th className="py-2 px-3 text-left">Berat</th>
                        <th className="py-2 px-3 text-left">Kadar</th>
                        <th className="py-2 px-3 text-right">Qty Diminta</th>
                        <th className="py-2 px-3 text-right">Qty Masuk Vault</th>
                        <th className="py-2 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orderDetail.lines.map((l) => (
                        <tr key={l.id}>
                          <td className="py-2 px-3 font-semibold text-slate-800">{l.goldBrand}</td>
                          <td className="py-2 px-3">{l.weightGrams}g</td>
                          <td className="py-2 px-3">{l.purity}</td>
                          <td className="py-2 px-3 text-right font-medium">{l.qtyRequested} keping</td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-700">{l.qtyReceived} keping</td>
                          <td className="py-2 px-3 text-center">
                            {l.qtyReceived >= l.qtyRequested ? (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                ✓ Lengkap
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                                Sisa {l.qtyRequested - l.qtyReceived}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Stored Items in Vault */}
                {orderDetail.items && orderDetail.items.length > 0 && (
                  <div>
                    <h4 className="font-bold text-slate-800 mb-2">Keping Fisik Emas yang Telah Disimpan di Vault:</h4>
                    <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                      {orderDetail.items.map((it) => (
                        <div key={it.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                          <div>
                            <div className="font-mono font-bold text-slate-900">{it.id}</div>
                            <div className="text-[11px] text-slate-500">
                              {it.brand} {it.weight}g • Lokasi:{' '}
                              <span className="text-emerald-700 font-medium">
                                {it.drawer?.slot?.cabinet?.code} ➔ Slot {it.drawer?.slot?.slotNumber} ➔{' '}
                                {it.drawer?.name} ({it.slotPosition || '-'})
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setDetailModalOpen(false);
                              setQrLabelModal({ isOpen: true, item: it });
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium flex items-center gap-1"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>Lihat Label</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-3 flex justify-end">
                  <button
                    onClick={() => setDetailModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
