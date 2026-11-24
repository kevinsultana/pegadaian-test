'use client';

import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { showToast, confirmAction, alertSuccess, alertError } from '@/lib/alerts';
import {
  KeyRound,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  Check,
  X,
  Loader2,
  AlertCircle,
  Edit2,
  Trash2,
  Users,
  Lock,
  CheckSquare,
  Square,
  Building2,
  Radio,
  FileText,
  Layers,
  Box,
  QrCode,
  ShoppingCart,
  History,
  Package,
  ArrowLeftRight,
  MapPin,
  LayoutDashboard,
  LayoutGrid,
  Table as TableIcon,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react';

// Icon mapping per menu key
const MENU_ICONS = {
  MENU_HO_DASHBOARD: Building2,
  MENU_HO_INBOUND: Box,
  MENU_HO_CABINETS: Layers,
  MENU_HO_INVENTORY: QrCode,
  MENU_HO_ORDERS: ShoppingCart,
  MENU_HO_HISTORY: History,

  MENU_OUTLET_DASHBOARD: Radio,
  MENU_OUTLET_INVENTORY: Package,
  MENU_OUTLET_CABINETS: Layers,
  MENU_OUTLET_ORDERS: ShoppingCart,
  MENU_OUTLET_OUTBOUND: ArrowLeftRight,
  MENU_OUTLET_HISTORY: History,

  MENU_ADMIN_DASHBOARD: LayoutDashboard,
  MENU_ADMIN_USERS: Users,
  MENU_ADMIN_LOCATIONS: MapPin,
  MENU_ADMIN_ROLES: KeyRound,

  MENU_AUDIT_LOG: FileText,
};

const CATEGORY_META = {
  HO: {
    title: 'Menu Head Office (HO)',
    short: 'Head Office',
    desc: '6 Menu operasional vault pusat, pengadaan emas, alokasi lemari, dan distribusi PO ke cabang',
    icon: Building2,
    badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    color: 'emerald',
    total: 6,
  },
  OUTLET: {
    title: 'Menu Outlet / Cabang',
    short: 'Outlet Cabang',
    desc: '6 Menu brankas cabang, deteksi RFID realtime, pemindahan laci/row, dan pelacakan emas cabang',
    icon: Radio,
    badgeBg: 'bg-blue-50 text-blue-800 border-blue-200',
    color: 'blue',
    total: 6,
  },
  ADMIN: {
    title: 'Menu Super Admin (Pusat)',
    short: 'Super Admin',
    desc: '4 Menu konfigurasi global sistem, manajemen pengguna, master unit lokasi, dan hak akses',
    icon: ShieldCheck,
    badgeBg: 'bg-purple-50 text-purple-800 border-purple-200',
    color: 'purple',
    total: 4,
  },
  AUDIT: {
    title: 'Menu Sistem & Audit',
    short: 'Sistem & Audit',
    desc: '1 Menu audit trail rekaman aktivitas pengguna dan jejak forensik keamanan transaksi',
    icon: FileText,
    badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
    color: 'amber',
    total: 1,
  },
};

export default function MasterRolesPage() {
  const { user } = useAuth();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('CARDS'); // 'CARDS' or 'MATRIX'
  const [activeTabCategory, setActiveTabCategory] = useState('ALL'); // 'ALL', 'HO', 'OUTLET', 'ADMIN', 'AUDIT'

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [modalActiveCategory, setModalActiveCategory] = useState('HO');

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    permissions: [],
  });

  const fetchData = async () => {
    try {
      const [roleRes, permRes] = await Promise.all([
        apiRequest('/master/roles'),
        apiRequest('/master/roles/permissions'),
      ]);
      setRoles(roleRes.data?.roles || []);
      setPermissions(permRes.data || []);
    } catch (err) {
      console.error(err);
      showToast.error('Gagal mengambil data peran');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Categorize permissions into 4 distinct groups
  const categorizedPermissions = useMemo(() => {
    const groups = {
      HO: [],
      OUTLET: [],
      ADMIN: [],
      AUDIT: [],
    };

    permissions.forEach((p) => {
      const cat = p.category || (p.module?.includes('HO') || p.module?.includes('Head Office') ? 'HO' : p.module?.includes('Outlet') ? 'OUTLET' : p.module?.includes('Admin') ? 'ADMIN' : 'AUDIT');
      if (groups[cat]) {
        groups[cat].push(p);
      } else {
        groups.HO.push(p);
      }
    });

    return groups;
  }, [permissions]);

  const openCreateModal = () => {
    setIsEditMode(false);
    setSelectedRoleId(null);
    setFormData({
      code: '',
      name: '',
      description: '',
      permissions: ['MENU_HO_DASHBOARD'],
    });
    setFormError('');
    setModalActiveCategory('HO');
    setIsModalOpen(true);
  };

  const openEditModal = (r) => {
    setIsEditMode(true);
    setSelectedRoleId(r.id);
    const rolePerms = Array.isArray(r.permissions) ? r.permissions : [];
    setFormData({
      code: r.code,
      name: r.name,
      description: r.description || '',
      permissions: rolePerms,
    });
    setFormError('');
    // Pick the category where role has the most permissions
    const hoCount = rolePerms.filter((k) => k.includes('HO')).length;
    const outletCount = rolePerms.filter((k) => k.includes('OUTLET')).length;
    if (outletCount > hoCount) setModalActiveCategory('OUTLET');
    else setModalActiveCategory('HO');
    setIsModalOpen(true);
  };

  const togglePermission = (permKey, legacyKey) => {
    setFormData((prev) => {
      const isCurrentlyChecked = prev.permissions.includes(permKey) || (legacyKey && prev.permissions.includes(legacyKey));
      let nextPerms = [...prev.permissions];

      if (isCurrentlyChecked) {
        nextPerms = nextPerms.filter((k) => k !== permKey && k !== legacyKey);
      } else {
        nextPerms.push(permKey);
        if (legacyKey && !nextPerms.includes(legacyKey)) {
          nextPerms.push(legacyKey);
        }
      }

      return {
        ...prev,
        permissions: nextPerms,
      };
    });
  };

  // Category batch toggle
  const toggleCategory = (catKey, forceState) => {
    const catPerms = categorizedPermissions[catKey] || [];
    const catKeys = catPerms.flatMap((p) => [p.key, p.legacyKey].filter(Boolean));

    setFormData((prev) => {
      const allSelected = catPerms.every((p) => prev.permissions.includes(p.key) || (p.legacyKey && prev.permissions.includes(p.legacyKey)));
      const shouldSelect = forceState !== undefined ? forceState : !allSelected;

      let nextPerms = [...prev.permissions];
      if (shouldSelect) {
        // Add all
        catKeys.forEach((k) => {
          if (!nextPerms.includes(k)) nextPerms.push(k);
        });
      } else {
        // Remove all
        nextPerms = nextPerms.filter((k) => !catKeys.includes(k));
      }

      return { ...prev, permissions: nextPerms };
    });
  };

  // All 17 menu permissions toggle
  const toggleAllPermissions = () => {
    const allMenuKeys = permissions.flatMap((p) => [p.key, p.legacyKey].filter(Boolean));
    const allSelected = permissions.every((p) => formData.permissions.includes(p.key) || (p.legacyKey && formData.permissions.includes(p.legacyKey)));

    if (allSelected) {
      setFormData((prev) => ({ ...prev, permissions: [] }));
    } else {
      setFormData((prev) => ({ ...prev, permissions: allMenuKeys }));
    }
  };

  const handleDeleteRole = async (r) => {
    if (r.isSystem || r.code === 'SUPER_ADMIN') {
      alertError('Ditolak', `Peran bawaan sistem "${r.name}" tidak dapat dihapus.`);
      return;
    }

    if (r.userCount > 0) {
      alertError(
        'Peran Masih Digunakan',
        `Peran "${r.name}" saat ini masih digunakan oleh ${r.userCount} akun pengguna. Pindahkan peran pengguna terkait terlebih dahulu.`
      );
      return;
    }

    const isConfirmed = await confirmAction(
      'Hapus Peran Pengguna?',
      `Apakah Anda yakin ingin menghapus definisi peran "${r.name}" (${r.code})? Tindakan ini tidak dapat dibatalkan.`,
      'Ya, Hapus Peran'
    );

    if (!isConfirmed) return;

    setDeletingId(r.id);
    const toastId = showToast.loading(`Menghapus peran ${r.name}...`);

    try {
      await apiRequest(`/master/roles/${r.id}`, { method: 'DELETE' });
      showToast.dismiss(toastId);
      showToast.success(`Peran ${r.name} berhasil dihapus!`);
      alertSuccess('Berhasil!', `Peran ${r.name} telah dihapus dari sistem.`);
      fetchData();
    } catch (err) {
      showToast.dismiss(toastId);
      const errMsg = err.message || 'Gagal menghapus peran';
      showToast.error(errMsg);
      alertError('Gagal Menghapus', errMsg);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (formData.permissions.length === 0) {
      setFormError('Harap pilih minimal 1 menu akses untuk peran ini');
      return;
    }

    // Count how many primary menus are selected
    const selectedMenuCount = permissions.filter(
      (p) => formData.permissions.includes(p.key) || (p.legacyKey && formData.permissions.includes(p.legacyKey))
    ).length;

    const isConfirmed = await confirmAction(
      isEditMode ? 'Simpan Perubahan Peran?' : 'Buat Peran Baru?',
      `Peran "${formData.name}" akan diberikan hak akses ke ${selectedMenuCount} menu sistem.`,
      isEditMode ? 'Ya, Simpan Perubahan' : 'Ya, Daftarkan Peran'
    );

    if (!isConfirmed) return;

    setSubmitting(true);
    const toastId = showToast.loading(isEditMode ? 'Menyimpan konfigurasi hak akses...' : 'Mendaftarkan peran baru...');

    try {
      if (isEditMode) {
        await apiRequest(`/master/roles/${selectedRoleId}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
        showToast.dismiss(toastId);
        showToast.success(`Hak akses peran ${formData.name} berhasil diperbarui!`);
        alertSuccess('Berhasil!', `Konfigurasi hak akses menu untuk peran "${formData.name}" telah disimpan.`);
      } else {
        await apiRequest('/master/roles', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
        showToast.dismiss(toastId);
        showToast.success(`Peran ${formData.name} berhasil dibuat!`);
        alertSuccess('Berhasil!', `Peran baru "${formData.name}" (${formData.code}) telah aktif.`);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      showToast.dismiss(toastId);
      const errMsg = err.message || 'Gagal menyimpan data peran';
      setFormError(errMsg);
      showToast.error(errMsg);
      alertError('Gagal Menyimpan', errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper count for a role
  const getRoleMenuStats = (rolePerms) => {
    const list = Array.isArray(rolePerms) ? rolePerms : [];
    const checkKey = (p) => list.includes(p.key) || (p.legacyKey && list.includes(p.legacyKey));

    const ho = (categorizedPermissions.HO || []).filter(checkKey).length;
    const outlet = (categorizedPermissions.OUTLET || []).filter(checkKey).length;
    const admin = (categorizedPermissions.ADMIN || []).filter(checkKey).length;
    const audit = (categorizedPermissions.AUDIT || []).filter(checkKey).length;
    const total = ho + outlet + admin + audit;

    return { ho, outlet, admin, audit, total };
  };

  const filteredRoles = roles.filter((r) => {
    const q = search.toLowerCase();
    const matchText =
      r.name.toLowerCase().includes(q) ||
      r.code.toLowerCase().includes(q) ||
      (r.description && r.description.toLowerCase().includes(q));

    if (!matchText) return false;

    if (activeTabCategory === 'ALL') return true;
    const stats = getRoleMenuStats(r.permissions);
    if (activeTabCategory === 'HO') return stats.ho > 0;
    if (activeTabCategory === 'OUTLET') return stats.outlet > 0;
    if (activeTabCategory === 'ADMIN') return stats.admin > 0;
    if (activeTabCategory === 'AUDIT') return stats.audit > 0;
    return true;
  });

  // Guard for Super Admin
  if (user && user.role !== 'SUPER_ADMIN') {
    return (
      <DashboardLayout>
        <div className="py-20 text-center max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto mb-4 text-rose-600">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Akses Terbatas</h2>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Modul Master Peran & Hak Akses Menu hanya dapat diakses secara eksklusif oleh Super Administrator.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
                RBAC Dinamis Per-Menu
              </span>
              <span className="text-xs text-slate-400">Total 17 Menu Sistem</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2 mt-1">
              <KeyRound className="w-6 h-6 text-emerald-700" />
              <span>Master Peran & Hak Akses Menu</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Atur hak akses menu sistem secara presisi per role. Setiap menu HO, Outlet, Super Admin, dan Audit dapat diaktifkan atau dinonaktifkan sesuai wewenang petugas.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            {/* View Switcher */}
            <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
              <button
                onClick={() => setViewMode('CARDS')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === 'CARDS'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Tampilan Kartu Peran"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Kartu Peran</span>
              </button>
              <button
                onClick={() => setViewMode('MATRIX')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === 'MATRIX'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Tampilan Matriks Hak Akses"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Matriks Menu</span>
              </button>
            </div>

            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Peran Baru</span>
            </button>
          </div>
        </div>

        {/* 4 Summary Stats Card for Modules */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Modul Head Office</span>
              <div className="text-xl font-bold text-slate-900 mt-0.5">6 Menu HO</div>
              <p className="text-[11px] text-emerald-700 font-medium">Vault, Inbound, PO, QR & Lacak</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Modul Outlet / Cabang</span>
              <div className="text-xl font-bold text-slate-900 mt-0.5">6 Menu Cabang</div>
              <p className="text-[11px] text-blue-700 font-medium">RFID, Inbound, Mutasi & Lacak</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center">
              <Radio className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Modul Super Admin</span>
              <div className="text-xl font-bold text-slate-900 mt-0.5">4 Menu Master</div>
              <p className="text-[11px] text-purple-700 font-medium">Pengguna, Lokasi & Hak Akses</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 border border-purple-100 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Modul Sistem & Audit</span>
              <div className="text-xl font-bold text-slate-900 mt-0.5">1 Menu Audit</div>
              <p className="text-[11px] text-amber-700 font-medium">Audit Trail Aktivitas Sistem</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Filter and Tab Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Search */}
            <div className="w-full sm:w-96 flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Cari peran (misal: HO_SUPERVISOR, Staff, Petugas)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            {/* Category tabs */}
            <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              <button
                onClick={() => setActiveTabCategory('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  activeTabCategory === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Semua Peran ({roles.length})
              </button>
              <button
                onClick={() => setActiveTabCategory('HO')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                  activeTabCategory === 'HO'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Memiliki Akses HO</span>
              </button>
              <button
                onClick={() => setActiveTabCategory('OUTLET')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                  activeTabCategory === 'OUTLET'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'text-blue-700 hover:bg-blue-50'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Memiliki Akses Outlet</span>
              </button>
              <button
                onClick={() => setActiveTabCategory('ADMIN')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                  activeTabCategory === 'ADMIN'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'text-purple-700 hover:bg-purple-50'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Super Admin</span>
              </button>
            </div>
          </div>
        </div>

        {/* VIEW MODE 1: CARDS VIEW */}
        {viewMode === 'CARDS' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full py-16 text-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-700 mb-2" />
                <span>Memuat master peran & konfigurasi menu RBAC...</span>
              </div>
            ) : filteredRoles.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500 bg-white border border-slate-200 rounded-2xl shadow-xs">
                Tidak ada peran yang cocok dengan kriteria pencarian &quot;{search}&quot;
              </div>
            ) : (
              filteredRoles.map((r) => {
                const stats = getRoleMenuStats(r.permissions);
                const isSuper = r.code === 'SUPER_ADMIN';

                return (
                  <div
                    key={r.id}
                    className={`p-5 rounded-2xl border transition-all flex flex-col justify-between shadow-xs ${
                      isSuper
                        ? 'bg-white border-emerald-400 ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      {/* Top badges */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
                          {isSuper ? (
                            <ShieldCheck className="w-5 h-5 text-emerald-700" />
                          ) : (
                            <Shield className="w-5 h-5 text-slate-700" />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {r.isSystem ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                              Sistem
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                              Kustom
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Role info */}
                      <h3 className="font-bold text-slate-900 text-base mt-3.5">{r.name}</h3>
                      <div className="text-xs font-mono font-semibold text-emerald-700 mt-0.5">{r.code}</div>

                      <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                        {r.description || 'Tidak ada keterangan wewenang.'}
                      </p>

                      {/* 4 Menu Module Badges */}
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                          <span>Akses Menu Sistem:</span>
                          <span className="text-emerald-700 font-bold">{stats.total} / 17 Menu</span>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          {/* HO badge */}
                          <div
                            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold flex items-center justify-between ${
                              stats.ho > 0
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-slate-50 text-slate-400 border-slate-200 opacity-60'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5" />
                              <span>Menu HO</span>
                            </span>
                            <span className="font-mono text-xs">{stats.ho}/6</span>
                          </div>

                          {/* Outlet badge */}
                          <div
                            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold flex items-center justify-between ${
                              stats.outlet > 0
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : 'bg-slate-50 text-slate-400 border-slate-200 opacity-60'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <Radio className="w-3.5 h-3.5" />
                              <span>Menu Outlet</span>
                            </span>
                            <span className="font-mono text-xs">{stats.outlet}/6</span>
                          </div>

                          {/* Admin badge */}
                          <div
                            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold flex items-center justify-between ${
                              stats.admin > 0
                                ? 'bg-purple-50 text-purple-800 border-purple-200'
                                : 'bg-slate-50 text-slate-400 border-slate-200 opacity-60'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Super Admin</span>
                            </span>
                            <span className="font-mono text-xs">{stats.admin}/4</span>
                          </div>

                          {/* Audit badge */}
                          <div
                            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold flex items-center justify-between ${
                              stats.audit > 0
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-slate-50 text-slate-400 border-slate-200 opacity-60'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5" />
                              <span>Audit Trail</span>
                            </span>
                            <span className="font-mono text-xs">{stats.audit}/1</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom actions */}
                    <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1 text-slate-500 font-medium">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{r.userCount || 0} Pengguna</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEditModal(r)}
                          className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors inline-flex items-center gap-1.5"
                          title="Ubah Konfigurasi Hak Akses Menu"
                        >
                          <Edit2 className="w-3 h-3 text-slate-500" />
                          <span>Atur Menu</span>
                        </button>
                        <button
                          onClick={() => handleDeleteRole(r)}
                          disabled={r.isSystem || r.userCount > 0 || deletingId === r.id}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors inline-flex items-center gap-1 ${
                            r.isSystem || r.userCount > 0
                              ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-40'
                              : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                          }`}
                          title={
                            r.isSystem
                              ? 'Peran bawaan sistem tidak dapat dihapus'
                              : r.userCount > 0
                              ? 'Peran masih digunakan oleh pengguna'
                              : 'Hapus Peran'
                          }
                        >
                          {deletingId === r.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* VIEW MODE 2: MATRIX VIEW */}
        {viewMode === 'MATRIX' && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Matriks Hak Akses Per-Menu Sistem (Overview)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tabel pemetaan seluruh 17 menu sistem terhadap peran yang terdaftar di Pegadaian Smart Vault
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-4 min-w-[200px]">Nama Peran & Kode</th>
                    <th className="py-3 px-3 text-center min-w-[120px] bg-emerald-50/60 text-emerald-900 border-x border-emerald-100">
                      🏢 Head Office (6)
                    </th>
                    <th className="py-3 px-3 text-center min-w-[120px] bg-blue-50/60 text-blue-900 border-r border-blue-100">
                      🏪 Outlet Cabang (6)
                    </th>
                    <th className="py-3 px-3 text-center min-w-[120px] bg-purple-50/60 text-purple-900 border-r border-purple-100">
                      👑 Super Admin (4)
                    </th>
                    <th className="py-3 px-3 text-center min-w-[100px] bg-amber-50/60 text-amber-900 border-r border-amber-100">
                      🛡️ Audit (1)
                    </th>
                    <th className="py-3 px-4 text-center min-w-[90px]">Total Menu</th>
                    <th className="py-3 px-4 text-center min-w-[100px]">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRoles.map((r) => {
                    const stats = getRoleMenuStats(r.permissions);
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{r.name}</div>
                          <div className="text-[11px] font-mono text-emerald-700">{r.code}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{r.userCount || 0} Pengguna aktif</div>
                        </td>

                        {/* HO Column */}
                        <td className="py-3.5 px-3 text-center bg-emerald-50/20 border-x border-emerald-50 font-semibold">
                          <span
                            className={`px-2 py-1 rounded-lg text-xs font-mono font-bold ${
                              stats.ho === 6
                                ? 'bg-emerald-600 text-white'
                                : stats.ho > 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'text-slate-300'
                            }`}
                          >
                            {stats.ho} / 6
                          </span>
                        </td>

                        {/* Outlet Column */}
                        <td className="py-3.5 px-3 text-center bg-blue-50/20 border-r border-blue-50 font-semibold">
                          <span
                            className={`px-2 py-1 rounded-lg text-xs font-mono font-bold ${
                              stats.outlet === 6
                                ? 'bg-blue-600 text-white'
                                : stats.outlet > 0
                                ? 'bg-blue-100 text-blue-800'
                                : 'text-slate-300'
                            }`}
                          >
                            {stats.outlet} / 6
                          </span>
                        </td>

                        {/* Admin Column */}
                        <td className="py-3.5 px-3 text-center bg-purple-50/20 border-r border-purple-50 font-semibold">
                          <span
                            className={`px-2 py-1 rounded-lg text-xs font-mono font-bold ${
                              stats.admin === 4
                                ? 'bg-purple-600 text-white'
                                : stats.admin > 0
                                ? 'bg-purple-100 text-purple-800'
                                : 'text-slate-300'
                            }`}
                          >
                            {stats.admin} / 4
                          </span>
                        </td>

                        {/* Audit Column */}
                        <td className="py-3.5 px-3 text-center bg-amber-50/20 border-r border-amber-50 font-semibold">
                          <span
                            className={`px-2 py-1 rounded-lg text-xs font-mono font-bold ${
                              stats.audit === 1
                                ? 'bg-amber-600 text-white'
                                : 'text-slate-300'
                            }`}
                          >
                            {stats.audit} / 1
                          </span>
                        </td>

                        {/* Total */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-bold text-xs text-slate-800">{stats.total} Menu</span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => openEditModal(r)}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold rounded-lg text-xs transition border border-emerald-200"
                          >
                            Atur Menu
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL: CREATE / EDIT ROLE WITH MENU PERMISSIONS */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl relative max-h-[92vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 mb-3.5 shrink-0">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-emerald-700" />
                    <span>{isEditMode ? `Pengaturan Hak Akses: ${formData.name}` : 'Buat Peran RBAC Baru'}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tentukan menu mana saja yang dapat dibuka dan dilihat oleh pemegang peran ini.
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="mb-3.5 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2 shrink-0">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 text-xs overflow-y-auto pr-1 flex-1">
                {/* Role Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Kode Peran (Unique Key Identifier)
                    </label>
                    <input
                      type="text"
                      required
                      disabled={isEditMode}
                      value={formData.code}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
                        })
                      }
                      placeholder="Contoh: HO_INBOUND_OPERATOR"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono uppercase focus:ring-2 focus:ring-emerald-500 focus:border-emerald-700 focus:outline-none disabled:opacity-50 disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Nama Peran (Label Tampilan)</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Contoh: Petugas Inbound HO"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-700 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 font-semibold mb-1">Deskripsi Ruang Lingkup Wewenang</label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Jelaskan peran tugas (misal: Bertanggung jawab atas penerimaan emas supplier di vault HO)..."
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-700 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Permissions Setup Per-Menu */}
                <div className="space-y-3">
                  {/* Top Bar for Permission Configuration */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                    <div>
                      <div className="text-slate-900 font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                        <span>Pilihan Akses Menu Sistem</span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-100 text-emerald-800">
                          {
                            permissions.filter(
                              (p) =>
                                formData.permissions.includes(p.key) ||
                                (p.legacyKey && formData.permissions.includes(p.legacyKey))
                            ).length
                          }{' '}
                          / 17 Menu Aktif
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={toggleAllPermissions}
                        className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 transition"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>Pilih Seluruh 17 Menu</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, permissions: [] }))}
                        className="text-[11px] font-semibold text-slate-600 hover:text-slate-800 flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 transition"
                      >
                        <Square className="w-3.5 h-3.5" />
                        <span>Kosongkan Semua</span>
                      </button>
                    </div>
                  </div>

                  {/* 4 Category Tabs in Modal */}
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 overflow-x-auto">
                    {['HO', 'OUTLET', 'ADMIN', 'AUDIT'].map((catKey) => {
                      const meta = CATEGORY_META[catKey];
                      const catPerms = categorizedPermissions[catKey] || [];
                      const selectedCount = catPerms.filter(
                        (p) =>
                          formData.permissions.includes(p.key) ||
                          (p.legacyKey && formData.permissions.includes(p.legacyKey))
                      ).length;
                      const Icon = meta.icon;

                      return (
                        <button
                          key={catKey}
                          type="button"
                          onClick={() => setModalActiveCategory(catKey)}
                          className={`flex-1 min-w-[130px] flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition ${
                            modalActiveCategory === catKey
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            <Icon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{meta.short}</span>
                          </span>
                          <span
                            className={`ml-1 text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                              selectedCount > 0
                                ? 'bg-emerald-100 text-emerald-800 font-bold'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {selectedCount}/{meta.total}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Category Content Box */}
                  {['HO', 'OUTLET', 'ADMIN', 'AUDIT'].map((catKey) => {
                    if (modalActiveCategory !== catKey) return null;
                    const meta = CATEGORY_META[catKey];
                    const catPerms = categorizedPermissions[catKey] || [];
                    const selectedCount = catPerms.filter(
                      (p) =>
                        formData.permissions.includes(p.key) ||
                        (p.legacyKey && formData.permissions.includes(p.legacyKey))
                    ).length;
                    const allCatSelected = selectedCount === catPerms.length;

                    return (
                      <div key={catKey} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
                          <div>
                            <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                              <span>{meta.title}</span>
                              <span className="text-[10px] text-slate-500 font-normal">
                                ({meta.desc})
                              </span>
                            </h4>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleCategory(catKey, true)}
                              className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 transition"
                            >
                              Pilih Semua {meta.short}
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleCategory(catKey, false)}
                              className="text-[11px] font-semibold text-slate-600 hover:text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200 transition"
                            >
                              Kosongkan
                            </button>
                          </div>
                        </div>

                        {/* Grid of Menus in this category */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                          {catPerms.map((p) => {
                            const isChecked =
                              formData.permissions.includes(p.key) ||
                              (p.legacyKey && formData.permissions.includes(p.legacyKey));
                            const MenuIcon = MENU_ICONS[p.key] || FileText;

                            return (
                              <div
                                key={p.key}
                                onClick={() => togglePermission(p.key, p.legacyKey)}
                                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                                  isChecked
                                    ? 'bg-white border-emerald-500 ring-1 ring-emerald-500 shadow-xs'
                                    : 'bg-white/80 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-white'
                                }`}
                              >
                                <div
                                  className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition ${
                                    isChecked
                                      ? 'bg-emerald-600 text-white'
                                      : 'border border-slate-300 bg-white text-transparent'
                                  }`}
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 truncate">
                                      <MenuIcon className={`w-3.5 h-3.5 shrink-0 ${isChecked ? 'text-emerald-700' : 'text-slate-400'}`} />
                                      <span className="truncate">{p.name}</span>
                                    </div>
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 shrink-0">
                                      {p.path}
                                    </span>
                                  </div>

                                  <p className="text-[11px] text-slate-500 mt-1 leading-snug line-clamp-2">
                                    {p.description}
                                  </p>

                                  <div className="mt-2 flex items-center gap-2">
                                    <span
                                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                                        isChecked
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-slate-100 text-slate-500'
                                      }`}
                                    >
                                      {isChecked ? 'Menu Aktif' : 'Tidak Ada Akses'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Modal Footer */}
                <div className="pt-3.5 flex items-center justify-between border-t border-slate-200 shrink-0">
                  <div className="text-xs text-slate-500">
                    Total menu diizinkan:{' '}
                    <span className="font-bold text-emerald-700 font-mono">
                      {
                        permissions.filter(
                          (p) =>
                            formData.permissions.includes(p.key) ||
                            (p.legacyKey && formData.permissions.includes(p.legacyKey))
                        ).length
                      }{' '}
                      Menu
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>{isEditMode ? 'Simpan Konfigurasi Menu' : 'Daftarkan Peran'}</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
