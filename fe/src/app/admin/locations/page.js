'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { showToast, confirmAction, alertSuccess, alertError } from '@/lib/alerts';
import {
  MapPin,
  Plus,
  Building2,
  Check,
  X,
  Loader2,
  AlertCircle,
  Radio,
  Layers,
  Edit2,
  Trash2,
  Search
} from 'lucide-react';

export default function MasterLocationsPage() {
  const { user: currentUser } = useAuth();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal & form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [formError, setFormError] = useState('');

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'OUTLET_HUB',
    address: '',
  });

  const fetchLocations = async () => {
    try {
      const res = await apiRequest('/master/locations');
      setLocations(res.data?.locations || []);
    } catch (err) {
      console.error(err);
      showToast.error('Gagal mengambil daftar lokasi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const openCreateModal = () => {
    setIsEditMode(false);
    setSelectedLocationId(null);
    setFormData({
      code: '',
      name: '',
      type: 'OUTLET_HUB',
      address: '',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (loc) => {
    setIsEditMode(true);
    setSelectedLocationId(loc.id);
    setFormData({
      code: loc.code,
      name: loc.name,
      type: loc.type,
      address: loc.address || '',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleDeleteLocation = async (loc) => {
    const currentUserLocId = currentUser?.location?.id || currentUser?.locationId;
    if (currentUserLocId === loc.id) {
      alertError('Tindakan Ditolak', 'Anda tidak dapat menghapus lokasi unit tempat akun Anda bertugas saat ini.');
      return;
    }

    const cabinetsCount = loc._count?.cabinets || 0;
    const usersCount = loc._count?.users || 0;

    if (cabinetsCount > 0 || usersCount > 0) {
      alertError(
        'Lokasi Tidak Dapat Dihapus',
        `Unit "${loc.name}" masih memiliki ${cabinetsCount} lemari vault dan ${usersCount} akun petugas yang terdaftar. Harap pindahkan data terkait terlebih dahulu sebelum menghapus lokasi ini.`
      );
      return;
    }

    const isConfirmed = await confirmAction(
      'Hapus Unit Vault?',
      `Apakah Anda yakin ingin menghapus unit lokasi "${loc.name}" (${loc.code})? Tindakan ini permanen dan tidak dapat dibatalkan.`,
      'Ya, Hapus Lokasi'
    );

    if (!isConfirmed) return;

    setDeletingId(loc.id);
    const toastId = showToast.loading(`Menghapus unit lokasi ${loc.name}...`);

    try {
      await apiRequest(`/master/locations/${loc.id}`, {
        method: 'DELETE',
      });
      showToast.dismiss(toastId);
      showToast.success(`Lokasi ${loc.name} berhasil dihapus!`);
      alertSuccess('Berhasil!', `Unit lokasi ${loc.name} (${loc.code}) telah dihapus.`);
      fetchLocations();
    } catch (err) {
      showToast.dismiss(toastId);
      const errMsg = err.message || 'Gagal menghapus lokasi';
      showToast.error(errMsg);
      alertError('Gagal Menghapus', errMsg);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const isConfirmed = await confirmAction(
      isEditMode ? 'Simpan Perubahan Lokasi?' : 'Daftarkan Titik Vault Baru?',
      `Unit ${formData.name} (${formData.code}) akan disimpan sebagai ${formData.type}.`,
      isEditMode ? 'Ya, Simpan Perubahan' : 'Ya, Daftarkan'
    );

    if (!isConfirmed) return;

    setSubmitting(true);
    const toastId = showToast.loading(isEditMode ? 'Memperbarui data unit lokasi...' : 'Mendaftarkan unit vault baru...');

    try {
      if (isEditMode) {
        await apiRequest(`/master/locations/${selectedLocationId}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
        showToast.dismiss(toastId);
        showToast.success(`Data lokasi ${formData.name} berhasil diperbarui!`);
        alertSuccess('Berhasil!', `Informasi unit lokasi ${formData.name} telah disimpan.`);
      } else {
        await apiRequest('/master/locations', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
        showToast.dismiss(toastId);
        showToast.success(`Lokasi ${formData.name} berhasil didaftarkan!`);
        alertSuccess('Berhasil!', `Unit vault ${formData.name} (${formData.code}) telah aktif.`);
      }
      setIsModalOpen(false);
      fetchLocations();
    } catch (err) {
      showToast.dismiss(toastId);
      const errMsg = err.message || 'Gagal menyimpan lokasi';
      setFormError(errMsg);
      showToast.error(errMsg);
      alertError('Gagal Menyimpan', errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredLocations = locations.filter((loc) => {
    const q = search.toLowerCase();
    return (
      loc.name.toLowerCase().includes(q) ||
      loc.code.toLowerCase().includes(q) ||
      (loc.address && loc.address.toLowerCase().includes(q))
    );
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
              <MapPin className="w-6 h-6 text-emerald-700" />
              <span>Master Unit & Titik Vault</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Daftar lokasi Head Office Sentral dan seluruh Outlet Hub Pegadaian di seluruh wilayah.
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Daftarkan Unit Baru</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm flex items-center gap-3 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-700 transition-all">
          <Search className="w-4 h-4 text-slate-400 ml-1.5" />
          <input
            type="text"
            placeholder="Cari berdasarkan nama lokasi, kode unit (misal: HO-CENTRAL, OUTLET-SENEN), atau alamat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-900 focus:outline-none placeholder:text-slate-400"
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

        {/* Location Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full py-12 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-700 mb-2" />
              <span className="text-xs">Memuat daftar lokasi...</span>
            </div>
          ) : filteredLocations.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400 bg-white border border-dashed border-slate-200 rounded-2xl">
              Tidak ada lokasi yang cocok dengan pencarian &quot;{search}&quot;
            </div>
          ) : (
            filteredLocations.map((loc) => {
              const currentUserLocId = currentUser?.location?.id || currentUser?.locationId;
              const isHO = loc.type === 'HEAD_OFFICE';
              const isUserLocation = currentUserLocId === loc.id;
              const hasRelations = (loc._count?.cabinets || 0) > 0 || (loc._count?.users || 0) > 0;

              return (
                <div
                  key={loc.id}
                  className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                        {isHO ? <Building2 className="w-5 h-5" /> : <Radio className="w-5 h-5" />}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {isUserLocation && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                            Unit Anda
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                            isHO
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {isHO ? 'Head Office (QR)' : 'Outlet Hub (RFID)'}
                        </span>
                      </div>
                    </div>

                    <h3 className="font-bold text-slate-900 text-base mt-3">{loc.name}</h3>
                    <div className="text-xs font-mono text-emerald-700 mt-0.5 font-bold">{loc.code}</div>

                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                      {loc.address || 'Alamat fisik belum diatur'}
                    </p>
                  </div>

                  <div>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-1 font-medium">
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        <span>{loc._count?.cabinets || 0} Lemari</span>
                      </div>
                      <div>{loc._count?.users || 0} Petugas</div>
                    </div>

                    {/* Actions: Edit & Delete */}
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openEditModal(loc)}
                        className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium border border-slate-200 transition-colors inline-flex items-center gap-1.5"
                        title="Edit Data Lokasi"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteLocation(loc)}
                        disabled={isUserLocation || deletingId === loc.id}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors inline-flex items-center gap-1.5 ${
                          isUserLocation
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-50'
                            : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                        }`}
                        title={
                          isUserLocation
                            ? 'Tidak dapat menghapus lokasi tugas akun Anda'
                            : hasRelations
                            ? 'Lokasi memiliki data lemari / petugas terhubung'
                            : 'Hapus Unit Lokasi'
                        }
                      >
                        {deletingId === loc.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
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

        {/* Modal Create / Edit Location */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-700" />
                  <span>{isEditMode ? 'Edit Data Unit / Titik Vault' : 'Daftarkan Unit / Titik Vault Baru'}</span>
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
                  <label className="block text-slate-700 font-semibold mb-1">Kode Unit / Lokasi</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="Contoh: OUTLET-RAWAMANGUN"
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 uppercase font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Nama Lokasi Unit</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Contoh: Pegadaian Cabang Pembantu Rawamangun"
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tipe Lokasi</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-700"
                  >
                    <option value="OUTLET_HUB">OUTLET_HUB (Vault Cabang - RFID Tracking)</option>
                    <option value="HEAD_OFFICE">HEAD_OFFICE (Vault Pusat - QR Code)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Alamat Lengkap</label>
                  <textarea
                    rows={3}
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Alamat kantor / outlet..."
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-700 resize-none"
                  />
                </div>

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
                    <span>{isEditMode ? 'Simpan Perubahan' : 'Simpan Lokasi'}</span>
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
