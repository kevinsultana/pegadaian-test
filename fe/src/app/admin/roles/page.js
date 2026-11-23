'use client';

import React, { useState, useEffect } from 'react';
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
  Square
} from 'lucide-react';

export default function MasterRolesPage() {
  const { user } = useAuth();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [formError, setFormError] = useState('');

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

  const openCreateModal = () => {
    setIsEditMode(false);
    setSelectedRoleId(null);
    setFormData({
      code: '',
      name: '',
      description: '',
      permissions: ['DASHBOARD_HO'],
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (r) => {
    setIsEditMode(true);
    setSelectedRoleId(r.id);
    setFormData({
      code: r.code,
      name: r.name,
      description: r.description || '',
      permissions: Array.isArray(r.permissions) ? r.permissions : [],
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const togglePermission = (permKey) => {
    setFormData((prev) => {
      const exists = prev.permissions.includes(permKey);
      if (exists) {
        return {
          ...prev,
          permissions: prev.permissions.filter((k) => k !== permKey),
        };
      } else {
        return {
          ...prev,
          permissions: [...prev.permissions, permKey],
        };
      }
    });
  };

  const toggleAllPermissions = () => {
    if (formData.permissions.length === permissions.length) {
      setFormData((prev) => ({ ...prev, permissions: [] }));
    } else {
      setFormData((prev) => ({ ...prev, permissions: permissions.map((p) => p.key) }));
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
      await apiRequest(`/master/roles/${r.id}`, {
        method: 'DELETE',
      });
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
      setFormError('Harap pilih minimal 1 hak akses izin untuk peran ini');
      return;
    }

    const isConfirmed = await confirmAction(
      isEditMode ? 'Simpan Perubahan Peran?' : 'Buat Peran Baru?',
      `Peran "${formData.name}" akan disimpan dengan ${formData.permissions.length} hak akses izin.`,
      isEditMode ? 'Ya, Simpan Perubahan' : 'Ya, Daftarkan Peran'
    );

    if (!isConfirmed) return;

    setSubmitting(true);
    const toastId = showToast.loading(isEditMode ? 'Memperbarui data peran...' : 'Membuat peran baru...');

    try {
      if (isEditMode) {
        await apiRequest(`/master/roles/${selectedRoleId}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
        showToast.dismiss(toastId);
        showToast.success(`Peran ${formData.name} berhasil diperbarui!`);
        alertSuccess('Berhasil!', `Data peran ${formData.name} telah disimpan.`);
      } else {
        await apiRequest('/master/roles', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
        showToast.dismiss(toastId);
        showToast.success(`Peran ${formData.name} berhasil dibuat!`);
        alertSuccess('Berhasil!', `Peran baru ${formData.name} (${formData.code}) telah aktif.`);
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

  // Group permissions by module
  const permissionsByModule = permissions.reduce((acc, curr) => {
    const mod = curr.module || 'Umum';
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(curr);
    return acc;
  }, {});

  const filteredRoles = roles.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.code.toLowerCase().includes(q) ||
      (r.description && r.description.toLowerCase().includes(q))
    );
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
            Modul Master Peran (RBAC) hanya dapat diakses secara eksklusif oleh Super Administrator.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-6 h-6 text-emerald-700" />
              <span>Master Peran & Hak Akses (RBAC Dinamis)</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Konfigurasi peran pengguna dan matriks hak akses sistem secara dinamis untuk mengontrol akses modul Pegadaian Smart Vault.
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Peran Baru</span>
          </button>
        </div>

        {/* Filter bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 shadow-sm">
          <Search className="w-4 h-4 text-slate-400 ml-1 shrink-0" />
          <input
            type="text"
            placeholder="Cari berdasarkan nama peran, kode (misal: SUPER_ADMIN, HO_STAFF), atau deskripsi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        {/* Roles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full py-16 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-700 mb-2" />
              <span>Memuat master peran RBAC...</span>
            </div>
          ) : filteredRoles.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500 bg-white border border-slate-200 rounded-2xl shadow-sm">
              Tidak ada peran yang cocok dengan pencarian &quot;{search}&quot;
            </div>
          ) : (
            filteredRoles.map((r) => {
              const permCount = Array.isArray(r.permissions) ? r.permissions.length : 0;
              const isSuper = r.code === 'SUPER_ADMIN';

              return (
                <div
                  key={r.id}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between shadow-sm ${
                    isSuper
                      ? 'bg-white border-emerald-300 ring-1 ring-emerald-500'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                        {isSuper ? <ShieldCheck className="w-5 h-5 text-emerald-700" /> : <Shield className="w-5 h-5" />}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {r.isSystem ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                            Sistem Bawaan
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            Kustom Dinamis
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 className="font-bold text-slate-900 text-base mt-4">{r.name}</h3>
                    <div className="text-xs font-mono font-semibold text-emerald-700 mt-0.5">{r.code}</div>

                    <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                      {r.description || 'Tidak ada deskripsi peruntukan.'}
                    </p>

                    {/* Permissions tags preview */}
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <div className="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center justify-between">
                        <span>Hak Akses Modul:</span>
                        <span className="text-emerald-700 font-bold">{permCount} Izin</span>
                      </div>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                        {Array.isArray(r.permissions) &&
                          r.permissions.map((pKey) => {
                            const pObj = permissions.find((p) => p.key === pKey);
                            return (
                              <span
                                key={pKey}
                                className="text-[10px] px-2 py-0.5 rounded bg-slate-50 text-slate-700 border border-slate-200 font-mono"
                                title={pObj?.name || pKey}
                              >
                                {pObj?.name || pKey}
                              </span>
                            );
                          })}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-slate-500">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{r.userCount || 0} Pengguna</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditModal(r)}
                        className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium border border-slate-200 transition-colors inline-flex items-center gap-1"
                        title="Edit Hak Akses Peran"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteRole(r)}
                        disabled={r.isSystem || r.userCount > 0 || deletingId === r.id}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors inline-flex items-center gap-1 ${
                          r.isSystem || r.userCount > 0
                            ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-50'
                            : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                        }`}
                        title={
                          r.isSystem
                            ? 'Peran sistem tidak dapat dihapus'
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
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Create / Edit Role */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4 shrink-0">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-emerald-700" />
                  <span>{isEditMode ? `Edit Hak Akses: ${formData.name}` : 'Buat Peran RBAC Baru'}</span>
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2 shrink-0">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 text-xs overflow-y-auto pr-1 flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Kode Peran (Kode Unik / Identifier)
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
                      placeholder="Contoh: AUDITOR_WILAYAH"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono uppercase focus:ring-2 focus:ring-emerald-500 focus:border-emerald-700 focus:outline-none disabled:opacity-50 disabled:bg-slate-50"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Nama Peran (Display Name)</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Contoh: Auditor Wilayah Regional"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-700 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Deskripsi Peran</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Jelaskan ruang lingkup wewenang dan tugas pemegang peran ini..."
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-700 focus:outline-none"
                  />
                </div>

                {/* Permissions Matrix */}
                <div className="pt-2">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                    <label className="text-slate-900 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <span>Daftar Izin & Akses Modul Sistem</span>
                      <span className="text-[11px] text-emerald-700 font-mono font-semibold">
                        ({formData.permissions.length} dipilih)
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={toggleAllPermissions}
                      className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
                    >
                      {formData.permissions.length === permissions.length ? (
                        <>
                          <Square className="w-3.5 h-3.5" />
                          <span>Batalkan Semua</span>
                        </>
                      ) : (
                        <>
                          <CheckSquare className="w-3.5 h-3.5" />
                          <span>Pilih Semua</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
                    {Object.entries(permissionsByModule).map(([modName, perms]) => (
                      <div key={modName} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <div className="font-bold text-emerald-800 text-[11px] uppercase tracking-wider mb-2">
                          Modul {modName}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {perms.map((p) => {
                            const isChecked = formData.permissions.includes(p.key);
                            return (
                              <label
                                key={p.key}
                                onClick={() => togglePermission(p.key)}
                                className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 select-none ${
                                  isChecked
                                    ? 'bg-emerald-50/80 border-emerald-300 text-slate-900'
                                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  className="mt-0.5 rounded border-slate-300 text-emerald-700 focus:ring-0"
                                />
                                <div>
                                  <div className={`font-semibold text-xs ${isChecked ? 'text-slate-900' : 'text-slate-800'}`}>
                                    {p.name}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                    {p.path}
                                  </div>
                                  <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                                    {p.description}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-200 shrink-0">
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
                    <span>{isEditMode ? 'Simpan Perubahan' : 'Buat Peran'}</span>
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
