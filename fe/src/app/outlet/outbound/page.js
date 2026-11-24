'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ArrowLeftRight,
  Package,
  Search,
  Filter,
  Radio,
  Layers,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  Eye,
  X,
  Coins,
  Scale,
  Building2,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Truck,
  UserCheck,
  FileText,
  Calendar,
  Send,
  Plus,
  ArrowRight,
  Printer,
  Check,
  QrCode,
  AlertTriangle,
} from 'lucide-react';

export default function OutletOutboundPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({
    totalTransactions: 0,
    customerSalesCount: 0,
    customerSalesWeight: 0,
    externalMutationsCount: 0,
    externalMutationsWeight: 0,
    internalMutationsCount: 0,
  });
  const [locationInfo, setLocationInfo] = useState(null);

  // Tab & Filters
  const [activeTab, setActiveTab] = useState('ALL'); // ALL, CUSTOMER_SALE, MUTATION_EXTERNAL, MUTATION_INTERNAL
  const [search, setSearch] = useState('');

  // Super Admin Location Switcher
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [outletLocations, setOutletLocations] = useState([]);
  const [selectedOutletId, setSelectedOutletId] = useState('');

  // Stock items available for selection in modals
  const [availableItems, setAvailableItems] = useState([]);
  const [destinationOutlets, setDestinationOutlets] = useState([]);
  const [cabinetsWithDrawers, setCabinetsWithDrawers] = useState([]);

  // Modal States
  const [saleModal, setSaleModal] = useState({
    isOpen: false,
    submitting: false,
    selectedItemIds: [],
    customerName: '',
    customerNik: '',
    customerPhone: '',
    salePrice: '',
    invoiceNumber: '',
    notes: '',
  });

  const [externalModal, setExternalModal] = useState({
    isOpen: false,
    submitting: false,
    selectedItemIds: [],
    destLocId: '',
    kurirName: 'Kurir Ekspedisi Internal Pegadaian',
    vehicleNumber: 'B 4129 PGD',
    trackingNumber: '',
    notes: '',
  });

  const [internalModal, setInternalModal] = useState({
    isOpen: false,
    submitting: false,
    selectedItemId: '',
    targetDrawerId: '',
    targetSlotPosition: '',
    reason: 'Penataan ulang kategori berat emas di baki RFID',
  });

  const [detailModal, setDetailModal] = useState({
    isOpen: false,
    transaction: null,
  });

  // Fetch Outlets for Super Admin
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
      console.error('Failed to fetch locations:', err);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchLocations();
    }
  }, [isSuperAdmin]);

  // Fetch Outbound Transactions
  const fetchOutboundData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (activeTab !== 'ALL') params.type = activeTab;
      if (search) params.search = search;
      if (isSuperAdmin && selectedOutletId) {
        params.outletLocationId = selectedOutletId;
      }

      const res = await apiRequest('/outlet/outbound', { params });
      if (res && res.data) {
        setTransactions(res.data.transactions || []);
        setStats(res.data.stats || {});
        setLocationInfo(res.data.location || null);
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat riwayat outbound cabang');
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, isSuperAdmin, selectedOutletId]);

  useEffect(() => {
    fetchOutboundData();
  }, [fetchOutboundData]);

  // Fetch available stock & destinations for modals
  const fetchModalPreReqs = async () => {
    try {
      const targetLoc = isSuperAdmin ? selectedOutletId : user?.locationId;
      const [itemsRes, destRes, cabRes] = await Promise.all([
        apiRequest('/outlet/outbound/available-items', {
          params: targetLoc ? { outletLocationId: targetLoc } : {},
        }),
        apiRequest('/outlet/outbound/destinations', {
          params: targetLoc ? { currentOutletId: targetLoc } : {},
        }),
        apiRequest('/outlet/cabinets', {
          params: targetLoc ? { outletLocationId: targetLoc } : {},
        }),
      ]);

      if (itemsRes?.data) setAvailableItems(itemsRes.data);
      if (destRes?.data) {
        setDestinationOutlets(destRes.data);
        if (destRes.data.length > 0 && !externalModal.destLocId) {
          setExternalModal((prev) => ({ ...prev, destLocId: destRes.data[0].id }));
        }
      }
      if (cabRes?.data?.cabinets) {
        // Fetch detailed cabinet slots to get all drawers
        const detailedCabs = [];
        for (const c of cabRes.data.cabinets) {
          try {
            const det = await apiRequest(`/outlet/cabinets/${c.code}`);
            if (det?.data?.cabinet) detailedCabs.push(det.data.cabinet);
          } catch (e) {
            console.error(e);
          }
        }
        setCabinetsWithDrawers(detailedCabs);
      }
    } catch (err) {
      console.error('Failed to fetch modal prerequisites:', err);
    }
  };

  // Open Sale Modal
  const handleOpenSaleModal = () => {
    fetchModalPreReqs();
    setSaleModal({
      isOpen: true,
      submitting: false,
      selectedItemIds: [],
      customerName: '',
      customerNik: '',
      customerPhone: '',
      salePrice: '',
      invoiceNumber: `INV-OUT-${Date.now().toString().slice(-6)}`,
      notes: 'Pembelian keping emas langsung di kasir cabang',
    });
  };

  // Submit Sale Modal
  const handleSubmitSale = async (e) => {
    e.preventDefault();
    if (saleModal.selectedItemIds.length === 0) {
      toast.error('Pilih minimal 1 keping emas');
      return;
    }
    if (!saleModal.customerName.trim() || !saleModal.customerNik.trim()) {
      toast.error('Nama dan NIK nasabah wajib diisi');
      return;
    }

    try {
      setSaleModal((prev) => ({ ...prev, submitting: true }));
      const payload = {
        outletLocationId: isSuperAdmin ? selectedOutletId : user?.locationId,
        itemIds: saleModal.selectedItemIds,
        customerName: saleModal.customerName,
        customerNik: saleModal.customerNik,
        customerPhone: saleModal.customerPhone,
        salePrice: saleModal.salePrice,
        invoiceNumber: saleModal.invoiceNumber,
        notes: saleModal.notes,
      };

      const res = await apiRequest('/outlet/outbound/customer-sale', {
        method: 'POST',
        data: payload,
      });

      toast.success(res.message || 'Penjualan ke nasabah berhasil diproses!');
      setSaleModal((prev) => ({ ...prev, isOpen: false }));
      fetchOutboundData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Gagal memproses penjualan ke nasabah');
    } finally {
      setSaleModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // Open External Mutation Modal
  const handleOpenExternalModal = () => {
    fetchModalPreReqs();
    setExternalModal({
      isOpen: true,
      submitting: false,
      selectedItemIds: [],
      destLocId: destinationOutlets[0]?.id || '',
      kurirName: 'Kurir Ekspedisi Internal Pegadaian',
      vehicleNumber: 'B 4129 PGD',
      trackingNumber: `RESI-MUT-${Date.now().toString().slice(-6)}`,
      notes: 'Mutasi antar cabang redistribusi stok emas',
    });
  };

  // Submit External Mutation Modal
  const handleSubmitExternal = async (e) => {
    e.preventDefault();
    if (externalModal.selectedItemIds.length === 0) {
      toast.error('Pilih minimal 1 keping emas untuk dimutasikan');
      return;
    }
    if (!externalModal.destLocId) {
      toast.error('Pilih cabang tujuan mutasi');
      return;
    }

    try {
      setExternalModal((prev) => ({ ...prev, submitting: true }));
      const payload = {
        sourceLocationId: isSuperAdmin ? selectedOutletId : user?.locationId,
        destLocId: externalModal.destLocId,
        itemIds: externalModal.selectedItemIds,
        kurirName: externalModal.kurirName,
        vehicleNumber: externalModal.vehicleNumber,
        trackingNumber: externalModal.trackingNumber,
        notes: externalModal.notes,
      };

      const res = await apiRequest('/outlet/outbound/external-mutation', {
        method: 'POST',
        data: payload,
      });

      toast.success(res.message || 'Mutasi antar cabang berhasil di-dispatch!');
      setExternalModal((prev) => ({ ...prev, isOpen: false }));
      fetchOutboundData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Gagal membuat mutasi antar cabang');
    } finally {
      setExternalModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // Open Internal Mutation Modal
  const handleOpenInternalModal = () => {
    fetchModalPreReqs();
    setInternalModal({
      isOpen: true,
      submitting: false,
      selectedItemId: '',
      targetDrawerId: '',
      targetSlotPosition: '',
      reason: 'Penataan ulang kategori berat emas di baki RFID',
    });
  };

  // Submit Internal Mutation Modal
  const handleSubmitInternal = async (e) => {
    e.preventDefault();
    if (!internalModal.selectedItemId) {
      toast.error('Pilih keping emas yang ingin dipindahkan');
      return;
    }
    if (!internalModal.targetDrawerId) {
      toast.error('Pilih laci / baki tujuan');
      return;
    }

    try {
      setInternalModal((prev) => ({ ...prev, submitting: true }));
      const payload = {
        itemId: internalModal.selectedItemId,
        targetDrawerId: internalModal.targetDrawerId,
        targetSlotPosition: internalModal.targetSlotPosition,
        reason: internalModal.reason,
      };

      const res = await apiRequest('/outlet/outbound/internal-mutation', {
        method: 'POST',
        data: payload,
      });

      toast.success(res.message || 'Pemindahan emas antar laci berhasil!');
      setInternalModal((prev) => ({ ...prev, isOpen: false }));
      fetchOutboundData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Gagal memindahkan emas antar laci');
    } finally {
      setInternalModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // Format Currency
  const formatRupiah = (val) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  // Selected item detail for internal modal
  const selectedInternalItem = availableItems.find((it) => it.id === internalModal.selectedItemId);

  // All drawers list for internal modal
  const allDrawersList = useMemo(() => {
    return cabinetsWithDrawers.flatMap((cab) =>
      (cab.drawers || []).map((drw) => ({
        ...drw,
        cabinetCode: cab.code,
        cabinetName: cab.name,
      }))
    );
  }, [cabinetsWithDrawers]);

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        {/* Header & Breadcrumb */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 tracking-wider uppercase mb-1">
                <span>OUTLET / CABANG</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span>OUTBOUND & MUTASI</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                <ArrowLeftRight className="w-7 h-7 text-emerald-600" />
                PO Outbound & Mutasi Emas Cabang
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Kelola pengeluaran keping emas fisik: pembelian oleh nasabah, mutasi eksternal antar cabang, dan mutasi internal antar laci baki RFID.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Location Switcher for Super Admin */}
              {isSuperAdmin && outletLocations.length > 0 && (
                <div className="flex items-center gap-2 bg-emerald-50/80 px-3 py-1.5 rounded-xl border border-emerald-200/80">
                  <Building2 className="w-4 h-4 text-emerald-700" />
                  <label htmlFor="outboundOutletSelect" className="text-xs font-bold text-emerald-900">
                    Lokasi:
                  </label>
                  <select
                    id="outboundOutletSelect"
                    value={selectedOutletId}
                    onChange={(e) => setSelectedOutletId(e.target.value)}
                    className="bg-white text-xs font-semibold text-emerald-900 border border-emerald-300 rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    {outletLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Action Buttons */}
              <button
                onClick={handleOpenSaleModal}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                Penjualan ke Nasabah
              </button>

              <button
                onClick={handleOpenExternalModal}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition active:scale-95"
              >
                <Truck className="w-3.5 h-3.5" />
                Mutasi Antar Cabang
              </button>

              <button
                onClick={handleOpenInternalModal}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition active:scale-95"
              >
                <Layers className="w-3.5 h-3.5" />
                Mutasi Antar Laci
              </button>
            </div>
          </div>
        </div>

        {/* 4 KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Outbound */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:border-emerald-200 transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Transaksi Outbound</p>
                <h3 className="text-3xl font-extrabold text-slate-900 mt-1">
                  {stats.totalTransactions || 0}
                  <span className="text-sm font-semibold text-slate-500 ml-1.5">Aktivitas</span>
                </h3>
              </div>
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                <ArrowLeftRight className="w-6 h-6" />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Pengeluaran & mutasi emas di <strong className="text-slate-700">{locationInfo?.name || 'Cabang'}</strong>
            </p>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-600" />
          </div>

          {/* Card 2: Penjualan Nasabah */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:border-emerald-200 transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Penjualan ke Nasabah</p>
                <h3 className="text-3xl font-extrabold text-slate-900 mt-1">
                  {stats.customerSalesCount || 0}
                  <span className="text-sm font-semibold text-slate-500 ml-1.5">Keping</span>
                </h3>
              </div>
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                <UserCheck className="w-6 h-6" />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Total Berat: <strong className="text-slate-800">{stats.customerSalesWeight || 0}g</strong> terjual
            </p>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500" />
          </div>

          {/* Card 3: Mutasi Eksternal Antar Cabang */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:border-emerald-200 transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mutasi Antar Cabang</p>
                <h3 className="text-3xl font-extrabold text-slate-900 mt-1">
                  {stats.externalMutationsCount || 0}
                  <span className="text-sm font-semibold text-slate-500 ml-1.5">Dokumen PO</span>
                </h3>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                <Truck className="w-6 h-6" />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Total Mutasi: <strong className="text-slate-800">{stats.externalMutationsWeight || 0}g</strong> dikirim
            </p>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500" />
          </div>

          {/* Card 4: Mutasi Internal Laci */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:border-emerald-200 transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mutasi Antar Laci</p>
                <h3 className="text-3xl font-extrabold text-slate-900 mt-1">
                  {stats.internalMutationsCount || 0}
                  <span className="text-sm font-semibold text-slate-500 ml-1.5">Relokasi</span>
                </h3>
              </div>
              <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600">
                <Layers className="w-6 h-6" />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Penataan slot baki RFID dalam brankas cabang
            </p>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500" />
          </div>
        </div>

        {/* Tab Filters & Search Bar */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'ALL'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Riwayat ({stats.totalTransactions || 0})
              </button>
              <button
                onClick={() => setActiveTab('CUSTOMER_SALE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'CUSTOMER_SALE'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Penjualan Nasabah ({stats.customerSalesCount || 0})
              </button>
              <button
                onClick={() => setActiveTab('MUTATION_EXTERNAL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'MUTATION_EXTERNAL'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mutasi Antar Cabang ({stats.externalMutationsCount || 0})
              </button>
              <button
                onClick={() => setActiveTab('MUTATION_INTERNAL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'MUTATION_INTERNAL'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mutasi Antar Laci ({stats.internalMutationsCount || 0})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari ID, Nasabah, Resi, atau Serial Emas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800 transition"
              />
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              Daftar Transaksi Outbound & Mutasi
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {transactions.length} record
              </span>
            </h2>
            <button
              onClick={fetchOutboundData}
              disabled={loading}
              className="text-xs text-slate-500 hover:text-emerald-700 flex items-center gap-1 font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Segarkan
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-12 text-center">No</th>
                  <th className="py-3.5 px-4">Tipe Outbound</th>
                  <th className="py-3.5 px-4">Dokumen / Ref</th>
                  <th className="py-3.5 px-4">Keterangan / Tujuan</th>
                  <th className="py-3.5 px-4">Keping Emas Terkait</th>
                  <th className="py-3.5 px-4">Waktu & Petugas</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                      Memuat daftar transaksi outbound cabang...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <div className="max-w-xs mx-auto space-y-2">
                        <ArrowLeftRight className="w-10 h-10 mx-auto text-slate-300" />
                        <p className="font-bold text-slate-700">Belum ada transaksi outbound</p>
                        <p className="text-xs text-slate-400">
                          Gunakan tombol di atas untuk mencatat penjualan nasabah, mutasi antar cabang, atau relokasi laci.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx, idx) => (
                    <tr key={tx.id || idx} className="hover:bg-slate-50/80 transition">
                      {/* No */}
                      <td className="py-3.5 px-4 text-center text-slate-400 font-medium">
                        {idx + 1}
                      </td>

                      {/* Tipe Outbound */}
                      <td className="py-3.5 px-4">
                        {tx.type === 'CUSTOMER_SALE' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                            Penjualan Nasabah
                          </span>
                        ) : tx.type === 'MUTATION_EXTERNAL' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-50 text-blue-800 border border-blue-200">
                            <Truck className="w-3.5 h-3.5 text-blue-600" />
                            Mutasi Cabang
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-purple-50 text-purple-800 border border-purple-200">
                            <Layers className="w-3.5 h-3.5 text-purple-600" />
                            Mutasi Antar Laci
                          </span>
                        )}
                      </td>

                      {/* Dokumen / Ref */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-slate-900">{tx.id}</span>
                        {tx.trackingNumber && (
                          <p className="text-[10px] text-slate-400 font-mono">
                            Resi: {tx.trackingNumber}
                          </p>
                        )}
                      </td>

                      {/* Keterangan / Tujuan */}
                      <td className="py-3.5 px-4">
                        {tx.type === 'CUSTOMER_SALE' ? (
                          <div>
                            <p className="font-bold text-slate-900">{tx.customerName}</p>
                            <p className="text-[11px] text-slate-400">NIK: {tx.customerNik}</p>
                          </div>
                        ) : tx.type === 'MUTATION_EXTERNAL' ? (
                          <div>
                            <p className="font-bold text-blue-900 flex items-center gap-1">
                              Tujuan: {tx.destLocationName} ({tx.destLocationCode})
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Kurir: {tx.kurirName || 'Internal'} • {tx.vehicleNumber || '-'}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-[11px] text-slate-700">{tx.details}</p>
                          </div>
                        )}
                      </td>

                      {/* Keping Emas Terkait */}
                      <td className="py-3.5 px-4">
                        {tx.item ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
                              {tx.item.id}
                            </span>
                            <span className="font-semibold text-slate-600">
                              {tx.item.brand} {tx.item.weight}g
                            </span>
                          </div>
                        ) : tx.items && tx.items.length > 0 ? (
                          <div>
                            <span className="font-bold text-slate-800">
                              {tx.items.length} keping ({tx.totalWeight}g)
                            </span>
                            <p className="text-[10px] text-slate-400 font-mono truncate max-w-xs">
                              {tx.items.map((it) => it.id).join(', ')}
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Waktu & Petugas */}
                      <td className="py-3.5 px-4">
                        <div className="text-[11px] text-slate-600">
                          {new Date(tx.timestamp).toLocaleString('id-ID', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Oleh: {tx.actor || tx.requestedBy || tx.dispatchedBy || 'Petugas'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          {tx.status || 'COMPLETED'}
                        </span>
                      </td>

                      {/* Aksi */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setDetailModal({ isOpen: true, transaction: tx })}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Detail
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL 1: PENJUALAN KE NASABAH (CUSTOMER SALE) */}
        {saleModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Penjualan Emas Fisik ke Nasabah
                    </h3>
                    <p className="text-xs text-slate-400">
                      Keluarkan keping emas dari brankas vault untuk diserahkan ke pembeli/nasabah.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSaleModal((prev) => ({ ...prev, isOpen: false }))}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitSale} className="space-y-4">
                {/* Step 1: Pilih Keping Emas */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Pilih Keping Emas dari Stok Vault ({availableItems.length} tersedia):
                  </label>
                  <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1.5 bg-slate-50">
                    {availableItems.length === 0 ? (
                      <p className="text-xs text-slate-400 p-2 text-center">
                        Tidak ada keping emas tersedia di cabang ini.
                      </p>
                    ) : (
                      availableItems.map((it) => {
                        const isSelected = saleModal.selectedItemIds.includes(it.id);
                        return (
                          <div
                            key={it.id}
                            onClick={() => {
                              setSaleModal((prev) => ({
                                ...prev,
                                selectedItemIds: isSelected
                                  ? prev.selectedItemIds.filter((id) => id !== it.id)
                                  : [...prev.selectedItemIds, it.id],
                              }));
                            }}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition text-xs border ${
                              isSelected
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                              />
                              <div>
                                <span className="font-mono font-bold">{it.id}</span> •{' '}
                                <span>{it.brand} {it.weight}g</span>
                                <span className="text-[10px] text-slate-400 ml-2">
                                  ({it.drawerName} - {it.slotPosition})
                                </span>
                              </div>
                            </div>
                            <span className="font-bold text-slate-800">
                              {formatRupiah(it.weight * 1450000)}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {saleModal.selectedItemIds.length > 0 && (
                    <div className="mt-1 text-xs text-emerald-700 font-bold flex items-center justify-between">
                      <span>{saleModal.selectedItemIds.length} keping emas dipilih</span>
                      <span>
                        Total Nilai Est: {formatRupiah(
                          availableItems
                            .filter((it) => saleModal.selectedItemIds.includes(it.id))
                            .reduce((acc, it) => acc + it.weight * 1450000, 0)
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* Step 2: Form Nasabah */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Lengkap Nasabah <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Budi Santoso"
                      value={saleModal.customerName}
                      onChange={(e) => setSaleModal((prev) => ({ ...prev, customerName: e.target.value }))}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      NIK Nasabah (KTP) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="16 digit NIK"
                      value={saleModal.customerNik}
                      onChange={(e) => setSaleModal((prev) => ({ ...prev, customerNik: e.target.value }))}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      No. Handphone / WA
                    </label>
                    <input
                      type="text"
                      placeholder="08123456789"
                      value={saleModal.customerPhone}
                      onChange={(e) => setSaleModal((prev) => ({ ...prev, customerPhone: e.target.value }))}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nomor Invoice / Struk
                    </label>
                    <input
                      type="text"
                      placeholder="INV-OUT-XXXX"
                      value={saleModal.invoiceNumber}
                      onChange={(e) => setSaleModal((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Catatan Transaksi
                  </label>
                  <input
                    type="text"
                    placeholder="Keterangan tambahan..."
                    value={saleModal.notes}
                    onChange={(e) => setSaleModal((prev) => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setSaleModal((prev) => ({ ...prev, isOpen: false }))}
                    className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saleModal.submitting || saleModal.selectedItemIds.length === 0}
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition disabled:opacity-50"
                  >
                    {saleModal.submitting ? 'Memproses...' : 'Konfirmasi & Checkout Emas'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: MUTASI ANTAR CABANG (EXTERNAL MUTATION) */}
        {externalModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Mutasi Emas Antar Cabang (Inter-Outlet Transfer)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Kirim keping emas ke cabang outlet lain dengan Surat Jalan & Tracking Kurir.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setExternalModal((prev) => ({ ...prev, isOpen: false }))}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitExternal} className="space-y-4">
                {/* Pilih Cabang Tujuan */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cabang Outlet Tujuan Mutasi <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={externalModal.destLocId}
                    onChange={(e) => setExternalModal((prev) => ({ ...prev, destLocId: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                  >
                    <option value="">Pilih Cabang Tujuan...</option>
                    {destinationOutlets.map((dest) => (
                      <option key={dest.id} value={dest.id}>
                        {dest.name} ({dest.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Pilih Keping Emas */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Pilih Keping Emas yang Dikirim ({availableItems.length} tersedia):
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1.5 bg-slate-50">
                    {availableItems.length === 0 ? (
                      <p className="text-xs text-slate-400 p-2 text-center">
                        Tidak ada keping emas tersedia di cabang ini.
                      </p>
                    ) : (
                      availableItems.map((it) => {
                        const isSelected = externalModal.selectedItemIds.includes(it.id);
                        return (
                          <div
                            key={it.id}
                            onClick={() => {
                              setExternalModal((prev) => ({
                                ...prev,
                                selectedItemIds: isSelected
                                  ? prev.selectedItemIds.filter((id) => id !== it.id)
                                  : [...prev.selectedItemIds, it.id],
                              }));
                            }}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition text-xs border ${
                              isSelected
                                ? 'bg-blue-50 border-blue-300 text-blue-950 font-semibold'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="rounded text-blue-600 focus:ring-blue-500"
                              />
                              <div>
                                <span className="font-mono font-bold">{it.id}</span> •{' '}
                                <span>{it.brand} {it.weight}g</span>
                              </div>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {it.drawerName} ({it.slotPosition})
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {externalModal.selectedItemIds.length > 0 && (
                    <div className="mt-1 text-xs text-blue-700 font-bold">
                      {externalModal.selectedItemIds.length} keping emas dipilih untuk dimutasikan
                    </div>
                  )}
                </div>

                {/* Data Kurir & Logistik */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Kurir / Pengirim
                    </label>
                    <input
                      type="text"
                      value={externalModal.kurirName}
                      onChange={(e) => setExternalModal((prev) => ({ ...prev, kurirName: e.target.value }))}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Plat Nomor Kendaraan
                    </label>
                    <input
                      type="text"
                      value={externalModal.vehicleNumber}
                      onChange={(e) => setExternalModal((prev) => ({ ...prev, vehicleNumber: e.target.value }))}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nomor Resi / Surat Jalan
                  </label>
                  <input
                    type="text"
                    value={externalModal.trackingNumber}
                    onChange={(e) => setExternalModal((prev) => ({ ...prev, trackingNumber: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Catatan Mutasi
                  </label>
                  <input
                    type="text"
                    value={externalModal.notes}
                    onChange={(e) => setExternalModal((prev) => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setExternalModal((prev) => ({ ...prev, isOpen: false }))}
                    className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={externalModal.submitting || externalModal.selectedItemIds.length === 0}
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition disabled:opacity-50"
                  >
                    {externalModal.submitting ? 'Memproses...' : 'Dispatch Mutasi Antar Cabang'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: MUTASI ANTAR LACI (INTERNAL MUTATION) */}
        {internalModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Mutasi Emas Antar Laci (Internal Vault)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Pindahkan keping emas dari satu laci/baki ke laci lain dalam brankas cabang.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setInternalModal((prev) => ({ ...prev, isOpen: false }))}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitInternal} className="space-y-4">
                {/* 1. Pilih Keping Emas */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pilih Keping Emas yang Ingin Dipindahkan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={internalModal.selectedItemId}
                    onChange={(e) => setInternalModal((prev) => ({ ...prev, selectedItemId: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none font-semibold text-slate-800"
                  >
                    <option value="">Pilih Keping Emas...</option>
                    {availableItems.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.id} - {it.brand} {it.weight}g ({it.drawerName} {it.slotPosition})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Info Posisi Saat Ini */}
                {selectedInternalItem && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Posisi Saat Ini:
                    </span>
                    <div className="flex items-center justify-between font-bold text-slate-800">
                      <span>{selectedInternalItem.cabinetCode} › {selectedInternalItem.drawerName}</span>
                      <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                        Slot: {selectedInternalItem.slotPosition}
                      </span>
                    </div>
                  </div>
                )}

                {/* 2. Pilih Laci Tujuan */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Laci / Baki Tujuan Pemindahan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={internalModal.targetDrawerId}
                    onChange={(e) => setInternalModal((prev) => ({ ...prev, targetDrawerId: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none font-semibold text-slate-800"
                  >
                    <option value="">Pilih Laci Tujuan...</option>
                    {allDrawersList.map((drw) => (
                      <option key={drw.id} value={drw.id}>
                        {drw.cabinetCode} - {drw.name} (Kapasitas: {drw.capacity})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Slot Posisi Tujuan */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Koordinat Slot Tujuan (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: R2-10 (Kosongkan untuk otomatis)"
                    value={internalModal.targetSlotPosition}
                    onChange={(e) => setInternalModal((prev) => ({ ...prev, targetSlotPosition: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                  />
                </div>

                {/* 4. Alasan Pemindahan */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Alasan Pemindahan
                  </label>
                  <input
                    type="text"
                    value={internalModal.reason}
                    onChange={(e) => setInternalModal((prev) => ({ ...prev, reason: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setInternalModal((prev) => ({ ...prev, isOpen: false }))}
                    className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={internalModal.submitting || !internalModal.selectedItemId || !internalModal.targetDrawerId}
                    className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-sm transition disabled:opacity-50"
                  >
                    {internalModal.submitting ? 'Memindahkan...' : 'Eksekusi Pemindahan Fisik'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 4: DETAIL TRANSAKSI */}
        {detailModal.isOpen && detailModal.transaction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    Bukti Transaksi Outbound
                  </h3>
                </div>
                <button
                  onClick={() => setDetailModal({ isOpen: false, transaction: null })}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Tipe Transaksi</span>
                  <span className="font-bold text-slate-900">{detailModal.transaction.typeName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">ID Dokumen / Ref</span>
                  <span className="font-mono font-bold text-slate-900">{detailModal.transaction.id}</span>
                </div>
                {detailModal.transaction.customerName && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Nama Nasabah</span>
                    <span className="font-bold text-slate-900">{detailModal.transaction.customerName}</span>
                  </div>
                )}
                {detailModal.transaction.customerNik && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">NIK Nasabah</span>
                    <span className="font-mono font-bold text-slate-900">{detailModal.transaction.customerNik}</span>
                  </div>
                )}
                {detailModal.transaction.destLocationName && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Cabang Tujuan</span>
                    <span className="font-bold text-blue-900">{detailModal.transaction.destLocationName}</span>
                  </div>
                )}
                {detailModal.transaction.trackingNumber && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">No Resi / Surat Jalan</span>
                    <span className="font-mono font-bold text-slate-900">{detailModal.transaction.trackingNumber}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Waktu Transaksi</span>
                  <span className="text-slate-700">
                    {new Date(detailModal.transaction.timestamp).toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Petugas</span>
                  <span className="text-slate-700">
                    {detailModal.transaction.actor || detailModal.transaction.requestedBy || 'Petugas Cabang'}
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-2">
                  <span className="text-slate-400 block mb-1">Catatan / Detail:</span>
                  <p className="text-slate-700 bg-white p-2 rounded border border-slate-100">
                    {detailModal.transaction.notes || detailModal.transaction.details || '-'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end border-t border-slate-100 pt-3">
                <button
                  onClick={() => setDetailModal({ isOpen: false, transaction: null })}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
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
