'use client';

import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { showToast, confirmAction, alertSuccess, alertError } from '@/lib/alerts';
import {
  Users,
  Plus,
  Search,
  Shield,
  MapPin,
  Check,
  X,
  Loader2,
  AlertCircle,
  KeyRound,
  Edit2,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';

export default function MasterUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    role: 'HO_STAFF',
    locationId: '',
    isActive: true,
  });

  const DEFAULT_ROLES = [
    { value: 'SUPER_ADMIN', label: 'Super Admin (Pusat)' },
    { value: 'HO_SUPERVISOR', label: 'HO Supervisor (Vault HO Central)' },
    { value: 'HO_STAFF', label: 'HO Staff Vault (Inbound & QR)' },
    { value: 'HO_LOGISTICS', label: 'HO Logistics (Distribusi PO)' },
    { value: 'OUTLET_SUPERVISOR', label: 'Outlet Supervisor' },
    { value: 'OUTLET_STAFF', label: 'Outlet Staff' },
    { value: 'OUTLET_PETUGAS', label: 'Outlet Petugas Lapangan (RFID)' },
    { value: 'SPI_AUDITOR', label: 'Satuan Pengawas Internal (Auditor)' },
  ];

  const [availableRoles, setAvailableRoles] = useState(DEFAULT_ROLES);

  const fetchUsersAndLocations = async () => {
    try {
      const [uRes, lRes, rRes] = await Promise.all([
        apiRequest('/master/users'),
        apiRequest('/master/locations'),
        apiRequest('/master/roles').catch(() => null),
      ]);
      setUsers(uRes.data?.users || []);
      const locList = lRes.data?.locations || [];
      setLocations(locList);

      if (rRes?.data?.roles && Array.isArray(rRes.data.roles)) {
        const dynamicRoles = rRes.data.roles.map((r) => ({
          value: r.code,
          label: `${r.name} (${r.code})`,
        }));
        if (dynamicRoles.length > 0) {
          setAvailableRoles(dynamicRoles);
        }
      }

      if (locList.length > 0 && !formData.locationId) {
        const firstLoc = locList[0];
        const isFirstOut = firstLoc.type === 'OUTLET_HUB';
        setFormData((prev) => ({
          ...prev,
          locationId: firstLoc.id,
          role: isFirstOut ? 'OUTLET_STAFF' : 'HO_STAFF',
        }));
      }
    } catch (err) {
      console.error(err);
      showToast.error('Gagal mengambil data pengguna');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndLocations();
  }, []);

  // Helper check if a role belongs strictly to Outlet
  const isOutletRole = (roleCode = '') => {
    const code = String(roleCode).toUpperCase();
    return code.startsWith('OUTLET_') || code.includes('CABANG');
  };

  // Determine current selected location and filter available roles
  const selectedLocation = useMemo(() => {
    return locations.find((l) => l.id === formData.locationId) || locations[0] || null;
  }, [locations, formData.locationId]);

  const isOutletLocation = selectedLocation?.type === 'OUTLET_HUB';

  const filteredRolesForLocation = useMemo(() => {
    if (!selectedLocation) return availableRoles;
    if (isOutletLocation) {
      return availableRoles.filter((r) => isOutletRole(r.value));
    } else {
      // HEAD_OFFICE: only HO, Super Admin, and SPI roles
      return availableRoles.filter((r) => !isOutletRole(r.value));
    }
  }, [availableRoles, selectedLocation, isOutletLocation]);

  // Handle location change & automatically auto-switch role if invalid
  const handleLocationChange = (newLocId) => {
    const nextLoc = locations.find((l) => l.id === newLocId);
    const nextIsOutlet = nextLoc?.type === 'OUTLET_HUB';

    const validRoles = availableRoles.filter((r) => {
      const isOut = isOutletRole(r.value);
      return nextIsOutlet ? isOut : !isOut;
    });

    let nextRole = formData.role;
    const isCurrentRoleValid = validRoles.some((r) => r.value === formData.role);

    if (!isCurrentRoleValid && validRoles.length > 0) {
      if (nextIsOutlet) {
        const preferredOutlet = validRoles.find((r) => r.value === 'OUTLET_STAFF') || validRoles[0];
        nextRole = preferredOutlet.value;
      } else {
        const preferredHo = validRoles.find((r) => r.value === 'HO_STAFF') || validRoles[0];
        nextRole = preferredHo.value;
      }
    }

    setFormData((prev) => ({
      ...prev,
      locationId: newLocId,
      role: nextRole,
    }));
  };

  const openCreateModal = () => {
    setIsEditMode(false);
    setSelectedUserId(null);
    setShowPassword(false);

    const initialLoc = locations[0];
    const initialIsOutlet = initialLoc?.type === 'OUTLET_HUB';
    const initialRole = initialIsOutlet ? 'OUTLET_STAFF' : 'HO_STAFF';

    setFormData({
      username: '',
      password: 'Password123!',
      fullName: '',
      role: initialRole,
      locationId: initialLoc?.id || '',
      isActive: true,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (u) => {
    setIsEditMode(true);
    setSelectedUserId(u.id);
    setShowPassword(false);
    setFormData({
      username: u.username,
      password: '', // Leave empty if not changing
      fullName: u.fullName,
      role: u.role,
      locationId: u.locationId,
      isActive: u.isActive,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleDeleteUser = async (u) => {
    if (currentUser?.id === u.id) {
      alertError('Tindakan Ditolak', 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif digunakan.');
      return;
    }

    const isConfirmed = await confirmAction(
      'Hapus Akun Pengguna?',
      `Apakah Anda yakin ingin menghapus pengguna "${u.fullName}" (@${u.username})? Tindakan ini permanen dan tidak dapat dibatalkan.`,
      'Ya, Hapus Pengguna'
    );

    if (!isConfirmed) return;

    setDeletingId(u.id);
    const toastId = showToast.loading(`Menghapus akun ${u.fullName}...`);

    try {
      await apiRequest(`/master/users/${u.id}`, {
        method: 'DELETE',
      });
      showToast.dismiss(toastId);
      showToast.success(`Pengguna ${u.fullName} berhasil dihapus!`);
      alertSuccess('Berhasil!', `Pengguna ${u.fullName} (@${u.username}) telah berhasil dihapus.`);
      fetchUsersAndLocations();
    } catch (err) {
      showToast.dismiss(toastId);
      const errMsg = err.message || 'Gagal menghapus pengguna';
      showToast.error(errMsg);
      alertError('Gagal Menghapus', errMsg);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const targetLoc = locations.find((l) => l.id === formData.locationId);
    const isTargetOutlet = targetLoc?.type === 'OUTLET_HUB';
    const isRoleOutlet = isOutletRole(formData.role);

    if (isTargetOutlet && !isRoleOutlet) {
      setFormError(`Lokasi "${targetLoc?.name || 'Cabang'}" merupakan unit Outlet. Harap pilih peran akses khusus Outlet.`);
      return;
    }

    if (!isTargetOutlet && isRoleOutlet) {
      setFormError(`Lokasi "${targetLoc?.name || 'HO'}" merupakan unit Head Office. Peran Outlet tidak dapat ditugaskan pada unit HO.`);
      return;
    }

    // SweetAlert Confirmation
    const isConfirmed = await confirmAction(
      isEditMode ? 'Simpan Perubahan Pengguna?' : 'Buat Akun Pengguna Baru?',
      `Akun ${formData.fullName} (${formData.username}) akan disimpan dengan peran ${formData.role} di lokasi ${targetLoc?.name || ''}.`,
      isEditMode ? 'Ya, Simpan' : 'Ya, Daftarkan'
    );

    if (!isConfirmed) return;

    setSubmitting(true);
    const toastId = showToast.loading(isEditMode ? 'Memperbarui data pengguna...' : 'Membuat pengguna baru...');

    try {
      if (isEditMode) {
        await apiRequest(`/master/users/${selectedUserId}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
        showToast.dismiss(toastId);
        showToast.success(`Data ${formData.fullName} berhasil diperbarui!`);
        alertSuccess('Berhasil!', `Data pengguna ${formData.fullName} telah diperbarui.`);
      } else {
        await apiRequest('/master/users', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
        showToast.dismiss(toastId);
        showToast.success(`Pengguna ${formData.fullName} berhasil didaftarkan!`);
        alertSuccess('Berhasil!', `Pengguna baru ${formData.fullName} (${formData.username}) telah aktif.`);
      }
      setIsModalOpen(false);
      fetchUsersAndLocations();
    } catch (err) {
      showToast.dismiss(toastId);
      const errMsg = err.message || 'Terjadi kesalahan saat menyimpan data pengguna';
      setFormError(errMsg);
      showToast.error(errMsg);
      alertError('Gagal Menyimpan', errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      u.location?.name.toLowerCase().includes(q)
    );
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
              <Users className="w-6 h-6 text-emerald-700" />
              <span>Master Data Pengguna (RBAC)</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Kelola seluruh akun pengguna, penetapan peran (role), dan unit penempatan kerja (HO atau Outlet).
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah User Baru</span>
          </button>
        </div>

        {/* Filter bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm flex items-center gap-3 focus-within:ring-2 focus-within:ring-emerald-500 transition-all">
          <Search className="w-4 h-4 text-slate-400 ml-1.5" />
          <input
            type="text"
            placeholder="Cari berdasarkan nama, username, role, atau lokasi cabang..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-900 focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-slate-400 hover:text-slate-600 text-xs mr-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* User Table */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Nama Lengkap & Username</th>
                  <th className="py-3 px-4">Peran / Role RBAC</th>
                  <th className="py-3 px-4">Lokasi Penempatan</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-700 mb-2" />
                      <span className="text-xs">Memuat data pengguna...</span>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      Tidak ada pengguna yang cocok dengan pencarian
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{u.fullName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">@{u.username}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium">{u.location?.name || '-'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono ml-5">
                          {u.location?.code} ({u.location?.type})
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-rose-600 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(u)}
                            className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium border border-slate-200 transition-colors inline-flex items-center gap-1"
                            title="Edit Pengguna"
                          >
                            <Edit2 className="w-3 h-3 text-slate-500" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u)}
                            disabled={currentUser?.id === u.id || deletingId === u.id}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors inline-flex items-center gap-1 ${currentUser?.id === u.id
                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-50'
                                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                              }`}
                            title={currentUser?.id === u.id ? 'Tidak dapat menghapus akun Anda sendiri' : 'Hapus Pengguna'}
                          >
                            {deletingId === u.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                            <span>Hapus</span>
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

        {/* Modal Create / Edit User */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-700" />
                  <span>{isEditMode ? 'Edit Data Pengguna' : 'Tambah Pengguna Baru'}</span>
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="Contoh: Budi Santoso"
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Username Akun</label>
                  <input
                    type="text"
                    required
                    disabled={isEditMode}
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="Contoh: budi.spv"
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    {isEditMode ? 'Ganti Password (Kosongkan jika tetap)' : 'Password Baru'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required={!isEditMode}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={isEditMode ? 'Biarkan kosong jika tidak diubah' : 'Minimal 6 karakter'}
                      className="w-full p-2.5 pr-10 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* 1. Lokasi Vault Penempatan */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 font-semibold">Lokasi Vault Penempatan</label>
                    {selectedLocation && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${isOutletLocation
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                      >
                        {isOutletLocation ? 'Unit Outlet / Cabang' : 'Unit Head Office (HO)'}
                      </span>
                    )}
                  </div>
                  <select
                    value={formData.locationId}
                    onChange={(e) => handleLocationChange(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.code} - {loc.type === 'OUTLET_HUB' ? 'OUTLET_HUB' : 'HEAD_OFFICE'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Peran Akses (Role) - Filtered Strictly by Location Type */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 font-semibold">Peran Akses (Role)</label>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {isOutletLocation ? 'Khusus Peran Outlet' : 'Khusus Peran Head Office'}
                    </span>
                  </div>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {filteredRolesForLocation.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {isOutletLocation
                      ? '✓ Menampilkan peran operasional khusus brankas & kasir Outlet Cabang'
                      : '✓ Menampilkan peran operasional khusus pengelolaan vault pusat Head Office (HO)'}
                  </p>
                </div>

                {isEditMode && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="rounded border-slate-300 text-emerald-700 focus:ring-0"
                    />
                    <label htmlFor="isActive" className="text-slate-700 font-medium">
                      Status Akun Aktif
                    </label>
                  </div>
                )}

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
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
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{isEditMode ? 'Simpan Perubahan' : 'Buat Pengguna'}</span>
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
