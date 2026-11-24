'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import {
  ArrowLeftRight,
  Package,
  Search,
  Filter,
  Radio,
  Layers,
  ShieldCheck,
  CheckCircle2,
  CheckCircle,
  Clock,
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
  Loader2,
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
    targetCabinetCode: '',
    targetCabinetName: '',
    targetDrawerId: '',
    targetDrawerCode: '',
    targetDrawerName: '',
    targetRowNumber: null,
    targetSlotPosition: '',
    reason: 'Penataan ulang kategori berat emas di baki RFID',
  });

  const [vaultPicker, setVaultPicker] = useState({
    isOpen: false,
    step: 'CABINETS', // 'CABINETS' | 'DRAWERS' | 'ROWS'
    cabinetsList: [],
    loadingCabinets: false,
    cabinetSearch: '',
    selectedCabinet: null,
    cabinetDetail: null,
    loadingDetail: false,
    selectedDrawer: null,
  });

  const [detailModal, setDetailModal] = useState({
    isOpen: false,
    transaction: null,
  });

  const [rfidModal, setRfidModal] = useState({
    isOpen: false,
    transaction: null,
    scannedItems: {},
    antennaPinging: false,
    submitting: false,
  });

  // Local storage helpers for pending outbound requests
  const getStorageKey = useCallback(() => {
    const locId = isSuperAdmin ? selectedOutletId : user?.locationId;
    return `pegadaian_pending_outbound_${locId || 'default'}`;
  }, [isSuperAdmin, selectedOutletId, user?.locationId]);

  const loadPendingRequests = useCallback(() => {
    if (typeof window === 'undefined') return [];
    try {
      const key = getStorageKey();
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }, [getStorageKey]);

  const savePendingRequests = useCallback((list) => {
    if (typeof window === 'undefined') return;
    try {
      const key = getStorageKey();
      localStorage.setItem(key, JSON.stringify(list));
    } catch (e) {
      console.error(e);
    }
  }, [getStorageKey]);

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
      const backendTx = (res && res.data && res.data.transactions) ? res.data.transactions : [];
      const statsData = (res && res.data && res.data.stats) ? res.data.stats : {};
      const loc = (res && res.data && res.data.location) ? res.data.location : null;

      // Load pending requests from local storage
      const pendingList = loadPendingRequests();

      // Filter pending requests by tab & search
      const filteredPending = pendingList.filter((t) => {
        if (activeTab !== 'ALL' && t.type !== activeTab) return false;
        if (search && search.trim()) {
          const q = search.trim().toLowerCase();
          const matchId = t.id?.toLowerCase().includes(q);
          const matchCustomer = t.customerName?.toLowerCase().includes(q);
          const matchDest = t.destLocationName?.toLowerCase().includes(q);
          const matchItems = t.items?.some((it) => it.id?.toLowerCase().includes(q) || it.brand?.toLowerCase().includes(q));
          if (!matchId && !matchCustomer && !matchDest && !matchItems) return false;
        }
        return true;
      });

      setTransactions([...filteredPending, ...backendTx]);
      setStats({
        ...statsData,
        totalTransactions: (statsData.totalTransactions || 0) + pendingList.length,
      });
      setLocationInfo(loc);
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat riwayat outbound cabang');
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, isSuperAdmin, selectedOutletId, loadPendingRequests]);

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

  // Submit Sale Modal -> Creates Outbound Request (PENDING_APPROVAL)
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
      const selectedItemsList = availableItems.filter((it) => saleModal.selectedItemIds.includes(it.id));
      const totalWeight = selectedItemsList.reduce((acc, it) => acc + (it.weight || 0), 0);

      const newTx = {
        id: `OUT-SALE-${Date.now().toString().slice(-6)}`,
        type: 'CUSTOMER_SALE',
        typeName: 'Penjualan ke Nasabah',
        status: 'PENDING_APPROVAL',
        customerName: saleModal.customerName,
        customerNik: saleModal.customerNik,
        customerPhone: saleModal.customerPhone,
        salePrice: saleModal.salePrice,
        invoiceNumber: saleModal.invoiceNumber,
        notes: saleModal.notes,
        items: selectedItemsList,
        totalItems: selectedItemsList.length,
        totalWeight,
        requestedBy: user?.username || 'Petugas Outlet',
        timestamp: new Date().toISOString(),
        payload: {
          endpoint: '/outlet/outbound/customer-sale',
          data: {
            outletLocationId: isSuperAdmin ? selectedOutletId : user?.locationId,
            itemIds: saleModal.selectedItemIds,
            customerName: saleModal.customerName,
            customerNik: saleModal.customerNik,
            customerPhone: saleModal.customerPhone,
            salePrice: saleModal.salePrice,
            invoiceNumber: saleModal.invoiceNumber,
            notes: saleModal.notes,
          },
        },
      };

      const existingPending = loadPendingRequests();
      savePendingRequests([newTx, ...existingPending]);

      toast.success('Pengajuan Penjualan berhasil dibuat! Menunggu Approval SPV Cabang.');
      setSaleModal((prev) => ({ ...prev, isOpen: false }));
      fetchOutboundData();
    } catch (err) {
      console.error(err);
      toast.error('Gagal membuat pengajuan penjualan');
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

  // Submit External Mutation Modal -> Creates Outbound Request (PENDING_APPROVAL)
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
      const selectedItemsList = availableItems.filter((it) => externalModal.selectedItemIds.includes(it.id));
      const totalWeight = selectedItemsList.reduce((acc, it) => acc + (it.weight || 0), 0);
      const targetDest = destinationOutlets.find((d) => d.id === externalModal.destLocId);

      const newTx = {
        id: `MUT-OUT-${Date.now().toString().slice(-6)}`,
        type: 'MUTATION_EXTERNAL',
        typeName: 'Mutasi Antar Cabang',
        status: 'PENDING_APPROVAL',
        destLocationName: targetDest?.name || 'Cabang Tujuan',
        destLocationCode: targetDest?.code || 'DEST',
        kurirName: externalModal.kurirName,
        vehicleNumber: externalModal.vehicleNumber,
        trackingNumber: externalModal.trackingNumber,
        notes: externalModal.notes,
        items: selectedItemsList,
        totalItems: selectedItemsList.length,
        totalWeight,
        requestedBy: user?.username || 'Petugas Outlet',
        timestamp: new Date().toISOString(),
        payload: {
          endpoint: '/outlet/outbound/external-mutation',
          data: {
            sourceLocationId: isSuperAdmin ? selectedOutletId : user?.locationId,
            destLocId: externalModal.destLocId,
            itemIds: externalModal.selectedItemIds,
            kurirName: externalModal.kurirName,
            vehicleNumber: externalModal.vehicleNumber,
            trackingNumber: externalModal.trackingNumber,
            notes: externalModal.notes,
          },
        },
      };

      const existingPending = loadPendingRequests();
      savePendingRequests([newTx, ...existingPending]);

      toast.success('Pengajuan Mutasi Antar Cabang dibuat! Menunggu Approval SPV Cabang.');
      setExternalModal((prev) => ({ ...prev, isOpen: false }));
      fetchOutboundData();
    } catch (err) {
      console.error(err);
      toast.error('Gagal membuat pengajuan mutasi');
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
      targetCabinetCode: '',
      targetCabinetName: '',
      targetDrawerId: '',
      targetDrawerCode: '',
      targetDrawerName: '',
      targetRowNumber: null,
      targetSlotPosition: '',
      reason: 'Penataan ulang kategori berat emas di baki RFID',
    });
  };

  // Open Hierarchical Vault Location Picker (Lemari -> Laci -> Row) for Internal Mutation
  const handleOpenVaultPicker = async () => {
    let cabs = cabinetsWithDrawers;
    const targetLoc = isSuperAdmin ? selectedOutletId : user?.locationId;
    if (cabs.length === 0) {
      try {
        const cabRes = await apiRequest('/outlet/cabinets', {
          params: targetLoc ? { outletLocationId: targetLoc } : {},
        });
        const list = cabRes?.data?.cabinets || [];
        const detailedCabs = [];
        for (const c of list) {
          try {
            const det = await apiRequest(`/outlet/cabinets/${c.code}`);
            if (det?.data?.cabinet) detailedCabs.push(det.data.cabinet);
          } catch (e) {
            console.error(e);
          }
        }
        cabs = detailedCabs;
        setCabinetsWithDrawers(detailedCabs);
      } catch (err) {
        console.error(err);
      }
    }

    if (cabs.length === 1) {
      const singleCab = cabs[0];
      setVaultPicker({
        isOpen: true,
        step: 'DRAWERS',
        cabinetsList: cabs,
        loadingCabinets: false,
        cabinetSearch: '',
        selectedCabinet: singleCab,
        cabinetDetail: singleCab,
        loadingDetail: false,
        selectedDrawer: null,
      });

      try {
        const res = await apiRequest(`/outlet/cabinets/${singleCab.code}`);
        const detail = res.data?.cabinet || res.data;
        setVaultPicker((prev) => ({
          ...prev,
          cabinetDetail: detail,
        }));
      } catch (err) {
        console.error(err);
      }
    } else {
      setVaultPicker({
        isOpen: true,
        step: 'CABINETS',
        cabinetsList: cabs,
        loadingCabinets: false,
        cabinetSearch: '',
        selectedCabinet: null,
        cabinetDetail: null,
        loadingDetail: false,
        selectedDrawer: null,
      });
    }
  };

  const handleSelectCabinet = async (cab) => {
    setVaultPicker((prev) => ({
      ...prev,
      selectedCabinet: cab,
      step: 'DRAWERS',
      loadingDetail: true,
      selectedDrawer: null,
    }));
    try {
      const res = await apiRequest(`/outlet/cabinets/${cab.code}`);
      const detail = res.data?.cabinet || res.data;
      setVaultPicker((prev) => ({
        ...prev,
        cabinetDetail: detail,
        loadingDetail: false,
      }));
    } catch (err) {
      console.error(err);
      setVaultPicker((prev) => ({
        ...prev,
        cabinetDetail: cab,
        loadingDetail: false,
      }));
    }
  };

  const handleSelectDrawer = (drw) => {
    setVaultPicker((prev) => ({
      ...prev,
      selectedDrawer: drw,
      step: 'ROWS',
    }));
  };

  const handleSelectRow = (rowNum, nextSlotPos) => {
    const cab = vaultPicker.selectedCabinet;
    const drw = vaultPicker.selectedDrawer;

    setInternalModal((prev) => ({
      ...prev,
      targetCabinetCode: cab?.code || drw?.cabinetCode || '',
      targetCabinetName: cab?.name || drw?.cabinetName || '',
      targetDrawerId: drw?.id || '',
      targetDrawerCode: drw?.code || '',
      targetDrawerName: drw?.name || 'Laci',
      targetRowNumber: rowNum,
      targetSlotPosition: nextSlotPos,
    }));

    toast.success(`Tujuan dipilih: ${drw?.name || drw?.code} • Row ${rowNum} (${nextSlotPos})`);

    setVaultPicker((prev) => ({
      ...prev,
      isOpen: false,
    }));
  };

  // Submit Internal Mutation Modal -> Creates Outbound Request (PENDING_APPROVAL)
  const handleSubmitInternal = async (e) => {
    e.preventDefault();
    if (!internalModal.selectedItemId) {
      toast.error('Pilih keping emas yang ingin dipindahkan');
      return;
    }
    if (!internalModal.targetDrawerId) {
      toast.error('Pilih lemari, laci dan baris (Row) tujuan');
      return;
    }

    try {
      setInternalModal((prev) => ({ ...prev, submitting: true }));
      const selectedItem = availableItems.find((it) => it.id === internalModal.selectedItemId);

      const newTx = {
        id: `INT-${Date.now().toString().slice(-6)}`,
        type: 'MUTATION_INTERNAL',
        typeName: 'Mutasi Antar Laci',
        status: 'PENDING_APPROVAL',
        details: `Pemindahan fisik keping ${selectedItem?.id} (${selectedItem?.brand} ${selectedItem?.weight}g) dari ${selectedItem?.cabinetCode} > ${selectedItem?.drawerName} (${selectedItem?.slotPosition}) ke ${internalModal.targetCabinetCode} > ${internalModal.targetDrawerName} (${internalModal.targetSlotPosition || 'R1-01'}). ${internalModal.reason || ''}`,
        item: {
          id: selectedItem?.id,
          brand: selectedItem?.brand,
          weight: selectedItem?.weight,
          purity: selectedItem?.purity,
          rfidTag: selectedItem?.rfidTag,
          fromCabinet: selectedItem?.cabinetCode,
          fromDrawer: selectedItem?.drawerName,
          fromSlot: selectedItem?.slotPosition,
          toCabinet: internalModal.targetCabinetCode,
          toDrawer: internalModal.targetDrawerName,
          toRow: internalModal.targetRowNumber,
          toSlot: internalModal.targetSlotPosition,
        },
        items: selectedItem
          ? [
              {
                ...selectedItem,
                toCabinet: internalModal.targetCabinetCode,
                toDrawer: internalModal.targetDrawerName,
                toRow: internalModal.targetRowNumber,
                toSlot: internalModal.targetSlotPosition,
              },
            ]
          : [],
        totalItems: 1,
        totalWeight: selectedItem?.weight || 0,
        targetDrawerId: internalModal.targetDrawerId,
        targetSlotPosition: internalModal.targetSlotPosition,
        reason: internalModal.reason,
        requestedBy: user?.username || 'Petugas Outlet',
        timestamp: new Date().toISOString(),
        payload: {
          endpoint: '/outlet/outbound/internal-mutation',
          data: {
            itemId: internalModal.selectedItemId,
            targetDrawerId: internalModal.targetDrawerId,
            targetSlotPosition: internalModal.targetSlotPosition,
            reason: internalModal.reason,
          },
        },
      };

      const existingPending = loadPendingRequests();
      savePendingRequests([newTx, ...existingPending]);

      toast.success('Pengajuan Mutasi Antar Laci dibuat! Menunggu Approval SPV Cabang.');
      setInternalModal((prev) => ({ ...prev, isOpen: false }));
      fetchOutboundData();
    } catch (err) {
      console.error(err);
      toast.error('Gagal membuat pengajuan mutasi laci');
    } finally {
      setInternalModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // Handle SPV Approval
  const handleApproveTx = (tx) => {
    Swal.fire({
      title: 'Setujui Pengajuan Outbound?',
      html: `
        <div class="text-xs text-slate-600 text-left space-y-2.5">
          <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <div class="flex justify-between">
              <span class="text-slate-400">Dokumen Ref:</span>
              <span class="font-mono font-bold text-slate-800">${tx.id}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Tipe Transaksi:</span>
              <span class="font-bold text-slate-800">${tx.typeName || tx.type}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Diajukan Oleh:</span>
              <span class="font-semibold text-slate-700">${tx.requestedBy || 'Petugas'}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Total Keping:</span>
              <span class="font-bold text-emerald-700">${tx.totalItems || 1} keping (${tx.totalWeight || 0}g)</span>
            </div>
          </div>
          <div class="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 space-y-1">
            <p class="font-bold flex items-center gap-1.5 text-xs text-amber-900">
              <span>⚠️ Kewajiban Verifikasi RFID Scan:</span>
            </p>
            <p class="text-[11px] leading-relaxed text-amber-800">
              Setelah disetujui, petugas wajib melakukan <strong>pembuktian fisik pemindaian RFID Tag / sensor baki</strong> untuk memastikan keping emas benar-benar telah dikeluarkan/dipindahkan dari brankas sebelum transaksi dapat diselesaikan.
            </p>
          </div>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#64748b',
      confirmButtonText: '✓ Ya, Setujui Pengajuan',
      cancelButtonText: 'Batal',
    }).then((res) => {
      if (res.isConfirmed) {
        const pending = loadPendingRequests();
        const updated = pending.map((item) => {
          if (item.id === tx.id) {
            return {
              ...item,
              status: 'APPROVED',
              approvedBy: user?.username || 'SPV Outlet',
              approvedAt: new Date().toISOString(),
            };
          }
          return item;
        });
        savePendingRequests(updated);
        fetchOutboundData();
        if (detailModal.isOpen) {
          setDetailModal((prev) => ({
            ...prev,
            transaction: {
              ...prev.transaction,
              status: 'APPROVED',
              approvedBy: user?.username || 'SPV Outlet',
              approvedAt: new Date().toISOString(),
            },
          }));
        }
        toast.success(`Pengajuan ${tx.id} disetujui SPV! Silakan lakukan pembuktian RFID Scan.`);
      }
    });
  };

  // Open RFID Verification Modal
  const handleOpenRfidModal = (tx) => {
    const initialScanned = {};
    (tx.items || []).forEach((it) => {
      initialScanned[it.id] = {
        scanned: false,
        scannedAt: null,
      };
    });

    setRfidModal({
      isOpen: true,
      transaction: tx,
      scannedItems: initialScanned,
      antennaPinging: false,
      submitting: false,
    });
  };

  // Scan single item in RFID modal
  const handleScanSingleItem = async (itemId) => {
    setRfidModal((prev) => ({
      ...prev,
      scannedItems: {
        ...prev.scannedItems,
        [itemId]: { ...prev.scannedItems[itemId], scanning: true },
      },
    }));

    await new Promise((r) => setTimeout(r, 450));

    setRfidModal((prev) => ({
      ...prev,
      scannedItems: {
        ...prev.scannedItems,
        [itemId]: {
          scanned: true,
          scanning: false,
          scannedAt: new Date().toLocaleTimeString('id-ID'),
          signalStrength: '-38 dBm',
        },
      },
    }));

    toast.success(`Tag RFID keping ${itemId} terdeteksi! Keping emas terverifikasi.`);
  };

  // Bulk scan all items
  const handleBulkScanAll = async () => {
    setRfidModal((prev) => ({ ...prev, antennaPinging: true }));
    await new Promise((r) => setTimeout(r, 600));

    const updated = {};
    (rfidModal.transaction?.items || []).forEach((it) => {
      updated[it.id] = {
        scanned: true,
        scanning: false,
        scannedAt: new Date().toLocaleTimeString('id-ID'),
        signalStrength: `-${Math.floor(35 + Math.random() * 12)} dBm`,
      };
    });

    setRfidModal((prev) => ({
      ...prev,
      antennaPinging: false,
      scannedItems: updated,
    }));

    toast.success('Semua keping emas berhasil terverifikasi RFID!');
  };

  // Complete outbound after RFID verification
  const handleExecuteFinalOutbound = async () => {
    const tx = rfidModal.transaction;
    if (!tx) return;

    const items = tx.items || [];
    const allScanned = items.every((it) => rfidModal.scannedItems[it.id]?.scanned);
    if (!allScanned) {
      toast.error('Harap lakukan scan RFID pada semua keping sebelum menyelesaikan transaksi!');
      return;
    }

    try {
      setRfidModal((prev) => ({ ...prev, submitting: true }));

      // Call backend endpoint to persist database changes
      if (tx.payload?.endpoint) {
        await apiRequest(tx.payload.endpoint, {
          method: 'POST',
          data: tx.payload.data,
        });
      }

      // Remove from pending storage
      const pending = loadPendingRequests();
      const updated = pending.filter((item) => item.id !== tx.id);
      savePendingRequests(updated);

      setRfidModal({
        isOpen: false,
        transaction: null,
        scannedItems: {},
        antennaPinging: false,
        submitting: false,
      });

      if (detailModal.isOpen) {
        setDetailModal({ isOpen: false, transaction: null });
      }

      await fetchOutboundData();
      await fetchModalPreReqs();

      Swal.fire({
        icon: 'success',
        title: '🎉 Transaksi Outbound Selesai & Terverifikasi!',
        html: `
          <div class="text-xs text-slate-600 text-left space-y-2">
            <p><strong>Dokumen Ref:</strong> ${tx.id}</p>
            <p><strong>Tipe Outbound:</strong> ${tx.typeName || tx.type}</p>
            <p class="text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
              ✓ Seluruh keping emas telah <strong>terbukti secara fisik melalui scan sensor RFID</strong>. Status di sistem Smart Vault telah ter-update otomatis!
            </p>
          </div>
        `,
        confirmButtonColor: '#059669',
        confirmButtonText: 'Tutup & Cetak Bukti',
      });
    } catch (err) {
      console.error(err);
      toast.error(err.message || err.response?.data?.message || 'Gagal menyelesaikan transaksi outbound');
    } finally {
      setRfidModal((prev) => ({ ...prev, submitting: false }));
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === 'ALL'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Semua Riwayat ({stats.totalTransactions || 0})
              </button>
              <button
                onClick={() => setActiveTab('CUSTOMER_SALE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === 'CUSTOMER_SALE'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Penjualan Nasabah ({stats.customerSalesCount || 0})
              </button>
              <button
                onClick={() => setActiveTab('MUTATION_EXTERNAL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === 'MUTATION_EXTERNAL'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Mutasi Antar Cabang ({stats.externalMutationsCount || 0})
              </button>
              <button
                onClick={() => setActiveTab('MUTATION_INTERNAL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === 'MUTATION_INTERNAL'
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
                className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800 transition"
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
                        {tx.status === 'PENDING_APPROVAL' ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-300">
                            <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                            Menunggu SPV
                          </span>
                        ) : tx.status === 'APPROVED' ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-violet-800 bg-violet-50 px-2.5 py-1 rounded-full border border-violet-300">
                            <Radio className="w-3.5 h-3.5 text-violet-600 animate-pulse" />
                            Siap Scan RFID
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            {tx.status || 'COMPLETED'}
                          </span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {tx.status === 'PENDING_APPROVAL' && (
                            <button
                              onClick={() => handleApproveTx(tx)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-2xs transition"
                              title="Setujui Pengajuan Outbound (SPV)"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Approve
                            </button>
                          )}

                          {tx.status === 'APPROVED' && (
                            <button
                              onClick={() => handleOpenRfidModal(tx)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-violet-700 hover:bg-violet-800 rounded-lg shadow-2xs transition animate-pulse"
                              title="Verifikasi Pembuktian RFID Scan"
                            >
                              <Radio className="w-3.5 h-3.5" />
                              Scan RFID
                            </button>
                          )}

                          <button
                            onClick={() => setDetailModal({ isOpen: true, transaction: tx })}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Detail
                          </button>
                        </div>
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
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition text-xs border ${isSelected
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                              }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => { }}
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
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
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
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
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
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
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
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
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
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
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
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
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
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition text-xs border ${isSelected
                                ? 'bg-blue-50 border-blue-300 text-blue-950 font-semibold'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                              }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => { }}
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
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
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
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono"
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
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono"
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
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
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
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-semibold text-slate-800"
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

                {/* 2. Pilih Lokasi Tujuan: Lemari, Laci & Baris/Row */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Lokasi Lemari, Laci & Baris (Row) Tujuan <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleOpenVaultPicker}
                    className="w-full p-3 bg-slate-50 hover:bg-purple-50/60 border border-slate-300 hover:border-purple-500 rounded-xl text-left transition-all flex items-center justify-between group shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded-xl bg-purple-100 text-purple-700 shrink-0">
                        <Layers size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-slate-800 truncate">
                          {internalModal.targetDrawerName || internalModal.targetDrawerCode ? (
                            <span>
                              {internalModal.targetCabinetCode ? `${internalModal.targetCabinetCode} • ` : ''}
                              {internalModal.targetDrawerName || internalModal.targetDrawerCode} •{' '}
                              <span className="text-purple-700 font-bold">
                                Row {internalModal.targetRowNumber || 1}
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">Klik untuk Pilih Lemari, Laci & Row Tujuan...</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {internalModal.targetCabinetCode ? `${internalModal.targetCabinetCode} • ` : ''}
                          {internalModal.targetSlotPosition
                            ? `Posisi Target: ${internalModal.targetSlotPosition}`
                            : 'Pilih laci dan baris (Row 1 s/d 6)'}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-purple-700 group-hover:text-purple-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shrink-0 ml-2 shadow-2xs">
                      {internalModal.targetDrawerId ? 'Ubah Row ➔' : 'Pilih Row ➔'}
                    </span>
                  </button>
                </div>

                {/* 3. Slot Posisi Tujuan */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Koordinat Slot Spesifik di Row (Opsional)
                    </label>
                    {internalModal.targetSlotPosition && (
                      <span className="text-[10px] text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded">
                        Auto: {internalModal.targetSlotPosition}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Contoh: R3-01 (Otomatis terisi saat memilih baris/row)"
                    value={internalModal.targetSlotPosition}
                    onChange={(e) => setInternalModal((prev) => ({ ...prev, targetSlotPosition: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Bisa dibiarkan sesuai pilihan Row atau ketik nomor slot spesifik jika diinginkan.
                  </p>
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
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
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

        {/* POPUP MODAL: Hierarchical Vault Location Picker (Lemari -> Laci -> Row) */}
        {vaultPicker.isOpen && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full my-6 flex flex-col max-h-[88vh] border border-slate-200">
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 rounded-t-2xl">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                    <Layers size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Pilih Tujuan Mutasi (Lemari, Laci & Baris)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Tentukan letak lemari, laci modular, dan baris (Row) penyimpanan keping emas
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setVaultPicker((prev) => ({ ...prev, isOpen: false }))}
                  className="text-slate-400 hover:text-slate-600 font-bold text-xl p-1"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Breadcrumb Steps */}
              <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200/80 flex items-center gap-2 text-xs overflow-x-auto">
                <button
                  type="button"
                  onClick={() => {
                    if (vaultPicker.cabinetsList.length > 1) {
                      setVaultPicker((prev) => ({ ...prev, step: 'CABINETS', selectedDrawer: null }));
                    }
                  }}
                  className={`font-semibold transition flex items-center gap-1 ${vaultPicker.step === 'CABINETS'
                      ? 'text-purple-700 font-bold'
                      : vaultPicker.cabinetsList.length > 1
                        ? 'text-slate-600 hover:text-slate-900'
                        : 'text-slate-500 cursor-default'
                    }`}
                >
                  <span>1. Lemari ({vaultPicker.selectedCabinet ? vaultPicker.selectedCabinet.code : 'Pilih'})</span>
                </button>

                <ChevronRight size={13} className="text-slate-400 shrink-0" />

                <button
                  type="button"
                  disabled={!vaultPicker.selectedCabinet}
                  onClick={() => setVaultPicker((prev) => ({ ...prev, step: 'DRAWERS' }))}
                  className={`font-semibold transition flex items-center gap-1 ${vaultPicker.step === 'DRAWERS'
                      ? 'text-purple-700 font-bold'
                      : vaultPicker.selectedCabinet
                        ? 'text-slate-600 hover:text-slate-900'
                        : 'text-slate-400 cursor-not-allowed'
                    }`}
                >
                  <span>2. Laci ({vaultPicker.selectedDrawer ? vaultPicker.selectedDrawer.name : 'Pilih'})</span>
                </button>

                <ChevronRight size={13} className="text-slate-400 shrink-0" />

                <span
                  className={`font-semibold flex items-center gap-1 ${vaultPicker.step === 'ROWS' ? 'text-purple-700 font-bold' : 'text-slate-400'
                    }`}
                >
                  <span>3. Baris (Row 1 s/d {vaultPicker.selectedDrawer?.rows || 6})</span>
                </span>
              </div>

              {/* Modal Body */}
              <div className="p-5 flex-1 overflow-y-auto space-y-4">
                {/* STEP 1: Pilih Lemari (Bila > 1 Lemari) */}
                {vaultPicker.step === 'CABINETS' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="relative flex-1">
                        <Search size={14} className="text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          placeholder="Cari kode atau nama lemari brankas..."
                          value={vaultPicker.cabinetSearch}
                          onChange={(e) =>
                            setVaultPicker((prev) => ({ ...prev, cabinetSearch: e.target.value }))
                          }
                          className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium shrink-0">
                        {vaultPicker.cabinetsList.length} Lemari Tersedia
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {vaultPicker.cabinetsList
                        .filter((c) =>
                          vaultPicker.cabinetSearch
                            ? c.code.toLowerCase().includes(vaultPicker.cabinetSearch.toLowerCase()) ||
                            c.name.toLowerCase().includes(vaultPicker.cabinetSearch.toLowerCase())
                            : true
                        )
                        .map((cab) => (
                          <div
                            key={cab.id}
                            onClick={() => handleSelectCabinet(cab)}
                            className="p-3.5 border border-slate-200 hover:border-purple-500 bg-white hover:bg-purple-50/40 rounded-xl transition cursor-pointer space-y-2 group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-xs text-slate-900 group-hover:text-purple-800">
                                {cab.code}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                                {cab.drawerCount || (cab.drawers?.length || 10)} Laci
                              </span>
                            </div>
                            <div className="font-semibold text-xs text-slate-800 line-clamp-1">
                              {cab.name}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                              <span>Kapasitas: {cab.usedCapacity || 0} / {cab.totalCapacity || 3300} slot</span>
                              <span className="text-purple-700 font-bold group-hover:translate-x-0.5 transition-transform">
                                Pilih ➔
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* STEP 2: Pilih Baki / Laci RFID */}
                {vaultPicker.step === 'DRAWERS' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-slate-800 text-xs">
                          Pilih Baki / Laci di Lemari {vaultPicker.selectedCabinet?.code}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {vaultPicker.selectedCabinet?.name} • Silakan pilih salah satu laci modular
                        </p>
                      </div>
                      {vaultPicker.cabinetsList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setVaultPicker((prev) => ({ ...prev, step: 'CABINETS' }))}
                          className="text-[11px] text-purple-700 hover:text-purple-800 font-semibold"
                        >
                          ← Ganti Lemari
                        </button>
                      )}
                    </div>

                    {vaultPicker.loadingDetail ? (
                      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                        <Loader2 size={24} className="animate-spin text-purple-600 mb-2" />
                        <span className="text-xs">Memuat daftar laci...</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {(vaultPicker.cabinetDetail?.drawers || []).map((drw) => {
                          const rows = drw.rows || 6;
                          const cols = drw.cols || 55;
                          const capacity = drw.capacity || rows * cols;
                          const used = drw.usedCapacity || drw.items?.length || 0;
                          const percent = capacity > 0 ? Math.round((used / capacity) * 100) : 0;

                          return (
                            <div
                              key={drw.id || drw.code}
                              onClick={() => handleSelectDrawer(drw)}
                              className="p-3 border border-slate-200 hover:border-purple-500 bg-white hover:bg-purple-50/40 rounded-xl transition cursor-pointer space-y-1.5 group"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-slate-800 group-hover:text-purple-800">
                                  {drw.name}
                                </span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-mono font-semibold">
                                  {drw.rfidAntenna || 'Antena RFID'}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500">
                                Struktur: <strong>{rows} Baris</strong> x <strong>{cols} Kolom</strong> ({capacity} slot)
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                                <span>Terisi: {used} / {capacity} keping ({percent}%)</span>
                                <span className="text-purple-700 font-bold group-hover:translate-x-0.5 transition-transform">
                                  Pilih Row ➔
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 3: Pilih Baris (Row 1 s/d rowsCount) */}
                {vaultPicker.step === 'ROWS' && vaultPicker.selectedDrawer && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-slate-800 text-xs">
                          Pilih Baris (Row) di {vaultPicker.selectedDrawer.name}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {vaultPicker.selectedCabinet?.code} • {vaultPicker.selectedDrawer.code} • Silakan pilih baris rak baki
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setVaultPicker((prev) => ({ ...prev, step: 'DRAWERS' }))}
                        className="text-[11px] text-purple-700 hover:text-purple-800 font-semibold"
                      >
                        ← Ganti Laci
                      </button>
                    </div>

                    <div className="space-y-2">
                      {Array.from({ length: vaultPicker.selectedDrawer.rows || 6 }, (_, idx) => {
                        const rowNum = idx + 1;
                        const cols = vaultPicker.selectedDrawer.cols || 55;
                        const drawerItems = vaultPicker.selectedDrawer.items || [];

                        // Exclude selected item if currently in this same drawer
                        const otherItems = drawerItems.filter(
                          (it) => it.id !== internalModal.selectedItemId
                        );

                        const usedCols = new Set();
                        otherItems.forEach((it) => {
                          const m = String(it.slotPosition || '').trim().toUpperCase().match(/^R(\d+)-(\d+)$/);
                          if (m && parseInt(m[1], 10) === rowNum) {
                            usedCols.add(parseInt(m[2], 10));
                          }
                        });

                        const itemsInRow = usedCols.size;
                        const availableInRow = Math.max(0, cols - itemsInRow);

                        // Find lowest available col
                        let nextCol = 1;
                        while (nextCol <= cols && usedCols.has(nextCol)) {
                          nextCol++;
                        }
                        const isFull = nextCol > cols;
                        const nextSlotPos = `R${rowNum}-${String(nextCol).padStart(2, '0')}`;

                        return (
                          <div
                            key={rowNum}
                            onClick={() => {
                              if (!isFull) handleSelectRow(rowNum, nextSlotPos);
                            }}
                            className={`p-3.5 border rounded-xl transition flex items-center justify-between gap-3 ${isFull
                                ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                                : 'bg-white border-slate-200 hover:border-purple-500 hover:bg-purple-50/40 cursor-pointer shadow-2xs group'
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-16 text-center py-1 bg-slate-100 group-hover:bg-purple-100 group-hover:text-purple-800 rounded-lg font-mono font-bold text-xs text-slate-700 border border-slate-200">
                                Row {rowNum}
                              </div>
                              <div>
                                <div className="font-semibold text-xs text-slate-800">
                                  Baris ke-{rowNum} ({cols} Slot Kolom)
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                  <span>Terisi: <strong className="text-slate-700">{itemsInRow}</strong> keping</span>
                                  <span>•</span>
                                  <span className={availableInRow > 0 ? 'text-emerald-700 font-semibold' : 'text-rose-600 font-semibold'}>
                                    Sisa: {availableInRow} slot kosong
                                  </span>
                                  <span>•</span>
                                  <span className="font-mono text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded text-[10px]">
                                    Next: {nextSlotPos}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={isFull}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${isFull
                                  ? 'bg-slate-100 text-slate-400'
                                  : 'bg-purple-600 group-hover:bg-purple-700 text-white shadow-2xs'
                                }`}
                            >
                              {isFull ? (
                                'Penuh'
                              ) : (
                                <>
                                  <span>Pilih Row {rowNum}</span>
                                  <ArrowRight size={12} />
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/80 rounded-b-2xl">
                <span className="text-xs text-slate-500">
                  {vaultPicker.step === 'CABINETS' && 'Langkah 1/3: Pilih Lemari'}
                  {vaultPicker.step === 'DRAWERS' && 'Langkah 2/3: Pilih Laci Modular'}
                  {vaultPicker.step === 'ROWS' && 'Langkah 3/3: Pilih Baris (Row)'}
                </span>
                <button
                  type="button"
                  onClick={() => setVaultPicker((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-1.5 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100"
                >
                  Tutup
                </button>
              </div>
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

              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <button
                  onClick={() => setDetailModal({ isOpen: false, transaction: null })}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Tutup
                </button>

                <div className="flex items-center gap-2">
                  {detailModal.transaction.status === 'PENDING_APPROVAL' && (
                    <button
                      onClick={() => {
                        const tx = detailModal.transaction;
                        handleApproveTx(tx);
                      }}
                      className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-sm transition flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Setujui Pengajuan (SPV)</span>
                    </button>
                  )}

                  {detailModal.transaction.status === 'APPROVED' && (
                    <button
                      onClick={() => {
                        const tx = detailModal.transaction;
                        setDetailModal({ isOpen: false, transaction: null });
                        handleOpenRfidModal(tx);
                      }}
                      className="px-4 py-2 text-xs font-bold text-white bg-violet-700 hover:bg-violet-800 rounded-xl shadow-sm transition flex items-center gap-1.5 animate-pulse"
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>Buka Verifikasi RFID Scan</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 5: PEMBUKTIAN RFID SCAN (PHYSICAL PROOF) */}
        {rfidModal.isOpen && rfidModal.transaction && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full my-6 flex flex-col max-h-[90vh] border border-slate-200">
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 rounded-t-2xl">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-violet-100 text-violet-700 rounded-xl">
                    <Radio size={20} className="animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-sm">
                        Pembuktian RFID Scan & Pengeluaran Fisik
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-800 border border-violet-200">
                        Smart Vault Sensor
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Verifikasi fisik keping emas sebelum dikeluarkan dari vault atau dipindahkan baki
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRfidModal((prev) => ({ ...prev, isOpen: false }))}
                  className="text-slate-400 hover:text-slate-600 font-bold text-xl p-1"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Sub-header Summary info */}
              <div className="px-5 py-3 bg-violet-50/60 border-b border-violet-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-slate-500">No. Ref:</span>{' '}
                  <span className="font-mono font-bold text-slate-800">{rfidModal.transaction.id}</span> •{' '}
                  <span className="text-slate-500">Tipe:</span>{' '}
                  <span className="font-semibold text-violet-900">{rfidModal.transaction.typeName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">SPV Approval:</span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px] flex items-center gap-1">
                    <Check size={11} /> {rfidModal.transaction.approvedBy || 'SPV Terverifikasi'}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 flex-1 overflow-y-auto space-y-4">
                {/* Actions banner */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-xs text-slate-800">
                      Instruksi Pembuktian Fisik Emas
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Arahkan reader scanner ke tag RFID keping emas atau aktifkan sensor antena baki.
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={rfidModal.antennaPinging}
                      onClick={handleBulkScanAll}
                      className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                    >
                      {rfidModal.antennaPinging ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Sparkles size={13} />
                      )}
                      <span>Pindai Semua (Reader Handheld)</span>
                    </button>
                  </div>
                </div>

                {/* Progress */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">Progress Scan Keping Emas:</span>
                    <span className="font-mono font-bold text-violet-700">
                      {Object.values(rfidModal.scannedItems).filter((v) => v.scanned).length} /{' '}
                      {(rfidModal.transaction.items || []).length} Keping Ter-scan
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-violet-600 h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${
                          (rfidModal.transaction.items || []).length > 0
                            ? (Object.values(rfidModal.scannedItems).filter((v) => v.scanned).length /
                                (rfidModal.transaction.items || []).length) *
                              100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-2.5">
                  {(rfidModal.transaction.items || []).map((it) => {
                    const scanState = rfidModal.scannedItems[it.id] || {};
                    const isScanned = !!scanState.scanned;

                    return (
                      <div
                        key={it.id}
                        className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isScanned
                            ? 'bg-emerald-50/60 border-emerald-200'
                            : 'bg-white border-slate-200 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`p-2 rounded-xl shrink-0 ${
                              isScanned
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {isScanned ? <Check size={18} /> : <Radio size={18} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-slate-900">{it.id}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-amber-100 text-amber-800">
                                {it.brand} {it.weight}g
                              </span>
                              {it.purity && (
                                <span className="text-[10px] text-slate-500 font-mono">
                                  Kadar {it.purity}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                              <span>
                                EPC Tag:{' '}
                                <strong className="font-mono text-slate-800">
                                  {it.rfidTag || 'EPC-PGD-2026-AUTO'}
                                </strong>
                              </span>
                              <span>•</span>
                              <span>
                                Lokasi Fisik:{' '}
                                <strong className="text-slate-700">
                                  {it.cabinetCode || it.fromCabinet || 'Vault'} ›{' '}
                                  {it.drawerName || it.fromDrawer || 'Laci'} ({it.slotPosition || it.fromSlot || '-'})
                                </strong>
                              </span>
                            </div>
                            {isScanned && (
                              <div className="text-[10px] text-emerald-800 font-semibold mt-1 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                                <span>
                                  {rfidModal.transaction.type === 'MUTATION_INTERNAL'
                                    ? `Terverifikasi: Sinyal terdeteksi di tujuan (${it.toDrawer || rfidModal.transaction.item?.toDrawer || 'Baki Baru'} Row ${it.toRow || rfidModal.transaction.item?.toRow || 1})`
                                    : 'Terverifikasi: Keping emas telah dikeluarkan dari baki lemari'}
                                </span>
                                <span className="text-slate-400">({scanState.scannedAt})</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-end shrink-0">
                          {isScanned ? (
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1">
                              <Check size={13} /> Ter-scan
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={scanState.scanning}
                              onClick={() => handleScanSingleItem(it.id)}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                            >
                              {scanState.scanning ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Radio size={13} />
                              )}
                              <span>Scan Tag RFID</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/80 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setRfidModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100"
                >
                  Tutup
                </button>

                <button
                  type="button"
                  disabled={
                    rfidModal.submitting ||
                    !(
                      (rfidModal.transaction.items || []).length > 0 &&
                      (rfidModal.transaction.items || []).every(
                        (it) => rfidModal.scannedItems[it.id]?.scanned
                      )
                    )
                  }
                  onClick={handleExecuteFinalOutbound}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {rfidModal.submitting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  <span>Selesaikan & Eksekusi Vault</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
