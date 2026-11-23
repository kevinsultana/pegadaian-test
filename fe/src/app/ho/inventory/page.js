'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { apiRequest } from '@/lib/api';
import { showToast, confirmAction, alertSuccess, alertError } from '@/lib/alerts';
import {
  QrCode,
  Plus,
  Search,
  Box,
  Layers,
  Printer,
  Check,
  X,
  Loader2,
  AlertCircle,
  Eye,
} from 'lucide-react';

export default function HOInventoryPage() {
  const [items, setItems] = useState([]);
  const [cabinets, setCabinets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal Inbound
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Detail & QR Modal
  const [qrModal, setQrModal] = useState({ isOpen: false, item: null });

  // Inbound Form Data
  const [formData, setFormData] = useState({
    serialNumber: '',
    goldType: 'ANTAM_BAR',
    weightGrams: 10,
    purity: '99.99%',
    drawerCode: '',
    slotPosition: 1,
    notes: 'Penerimaan Inbound Batch Baru HO',
  });

  const [availableDrawers, setAvailableDrawers] = useState([]);

  const fetchData = async () => {
    try {
      const [invRes, cabRes] = await Promise.all([
        apiRequest('/ho/inventory?limit=50'),
        apiRequest('/ho/cabinets'),
      ]);
      const rawItems = invRes?.data?.items || (Array.isArray(invRes?.data) ? invRes.data : (Array.isArray(invRes) ? invRes : []));
      const safeItems = (Array.isArray(rawItems) ? rawItems : []).map((it) => ({
        ...it,
        serialNumber: it.serialNumber || it.id || '',
        goldType: it.goldType || it.brand || '',
        weightGrams: it.weightGrams ?? it.weight ?? 0,
      }));
      setItems(safeItems);
      const cabs = cabRes.data?.cabinets || (Array.isArray(cabRes.data) ? cabRes.data : []);
      setCabinets(cabs);

      // Collect drawers from first cabinet
      if (cabs.length > 0) {
        loadDrawersForCabinet(cabs[0].code);
      }
    } catch (err) {
      console.error(err);
      showToast.error('Gagal memuat inventori emas');
    } finally {
      setLoading(false);
    }
  };

  const loadDrawersForCabinet = async (cabCode) => {
    try {
      const res = await apiRequest(`/ho/cabinets/${cabCode}`);
      const cab = res.data?.cabinet;
      const drws = [];
      cab?.slots?.forEach((s) => {
        s.drawers?.forEach((d) => drws.push(d));
      });
      setAvailableDrawers(drws);
      if (drws.length > 0 && !formData.drawerCode) {
        setFormData((prev) => ({ ...prev, drawerCode: drws[0].code }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openInboundModal = () => {
    const randomSerial = `LM-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    setFormData((prev) => ({
      ...prev,
      serialNumber: randomSerial,
    }));
    setFormError('');
    setIsModalOpen(true);
  };

  const handleInboundSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    try {
      const res = await apiRequest('/ho/inventory/inbound', {
        method: 'POST',
        body: JSON.stringify({
          serialNumber: formData.serialNumber,
          goldType: formData.goldType,
          weightGrams: parseFloat(formData.weightGrams),
          purity: formData.purity,
          drawerCode: formData.drawerCode,
          slotPosition: parseInt(formData.slotPosition, 10),
          notes: formData.notes,
        }),
      });

      showToast.success(`Keping emas ${formData.serialNumber} berhasil didaftarkan ke ${formData.drawerCode}`);
      alertSuccess(
        'Inbound Berhasil!',
        `Keping emas ${formData.serialNumber} (${formData.goldType} ${formData.weightGrams}g) berhasil disimpan ke ${formData.drawerCode}.`
      );

      setIsModalOpen(false);
      fetchData();

      // Langsung buka modal cetak QR
      if (res.data) {
        openQrModal(res.data);
      }
    } catch (err) {
      const errMsg = err.message || 'Gagal registrasi item';
      setFormError(errMsg);
      showToast.error(errMsg);
      alertError('Gagal Inbound', errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const openQrModal = async (item) => {
    try {
      const res = await apiRequest(`/ho/inventory/${item.id}`);
      const modalItem = res.data?.item || res.data || item;
      setQrModal({
        isOpen: true,
        item: {
          ...item,
          ...modalItem,
          serialNumber: modalItem.serialNumber || modalItem.itemId || item.serialNumber || item.id,
          goldType: modalItem.goldType || modalItem.brand || item.goldType || item.brand,
          weightGrams: modalItem.weightGrams ?? item.weightGrams ?? item.weight,
        },
      });
    } catch (e) {
      setQrModal({ isOpen: true, item });
    }
  };

  const filteredItems = (Array.isArray(items) ? items : []).filter((it) => {
    if (!it) return false;
    const q = (search || '').toLowerCase().trim();
    if (!q) return true;
    const serial = String(it.serialNumber || it.id || '').toLowerCase();
    const qr = String(it.qrCode || '').toLowerCase();
    const brand = String(it.goldType || it.brand || '').toLowerCase();
    const drawerCode = String(it.drawer?.code || '').toLowerCase();
    const drawerName = String(it.drawer?.name || '').toLowerCase();
    const sbg = String(it.sbgNumber || '').toLowerCase();

    return (
      serial.includes(q) ||
      qr.includes(q) ||
      brand.includes(q) ||
      drawerCode.includes(q) ||
      drawerName.includes(q) ||
      sbg.includes(q)
    );
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
              <QrCode className="w-6 h-6 text-emerald-700" />
              <span>Inventori Vault HO & Cetak QR Code</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Penerimaan keping emas baru (Inbound), penandaan QR unik per keping, pemetaan slot laci, dan pencetakan label stiker QR.
            </p>
          </div>

          <button
            onClick={openInboundModal}
            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Inbound Emas Baru</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm flex items-center gap-3 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-700 transition-all">
          <Search className="w-4 h-4 text-slate-400 ml-1.5" />
          <input
            type="text"
            placeholder="Cari berdasarkan No Seri, QR Code, tipe emas, atau kode laci..."
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

        {/* Inventory Table */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">No. Seri & QR Code</th>
                  <th className="py-3 px-4">Tipe & Berat Emas</th>
                  <th className="py-3 px-4">Lokasi Laci / Lemari</th>
                  <th className="py-3 px-4">Status Keping</th>
                  <th className="py-3 px-4 text-right">Label QR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-700 mb-2" />
                      <span className="text-xs">Memuat inventori emas...</span>
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <Box className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <span className="text-xs font-medium text-slate-600">Tidak ada keping emas ditemukan.</span>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900">{item.serialNumber || item.id}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.qrCode}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900">{item.goldType || item.brand}</span>
                        <div className="text-[11px] font-semibold text-amber-800 mt-0.5">
                          {item.weightGrams ?? item.weight} Gram
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">
                          {item.drawer?.name || item.drawerCode || '-'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {item.drawer?.code || '-'} ({item.slotPosition || 'SLOT-01'})
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {item.currentStatus || 'IN_HO'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openQrModal(item)}
                          className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 text-xs font-medium inline-flex items-center gap-1.5 transition-colors shadow-sm"
                        >
                          <QrCode className="w-3.5 h-3.5 text-slate-600" />
                          <span>QR Label</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Inbound Emas Baru */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Box className="w-4 h-4 text-emerald-700" />
                  <span>Inbound Keping Emas Baru (HO)</span>
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
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

              <form onSubmit={handleInboundSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Nomor Seri Fisik (Serial Number)</label>
                  <input
                    type="text"
                    required
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value.toUpperCase() })}
                    placeholder="Contoh: LM-2026-9901"
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Tipe Logam Mulia</label>
                    <select
                      value={formData.goldType}
                      onChange={(e) => setFormData({ ...formData, goldType: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-700"
                    >
                      <option value="ANTAM_BAR">Antam CertiCard</option>
                      <option value="UBS_BAR">UBS Gold Bar</option>
                      <option value="GALERI24_BAR">Galeri 24 Baby Gold</option>
                      <option value="BATANGAN_BESAR">Emas Batangan Besar (Cast)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Berat (Gram)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.weightGrams}
                      onChange={(e) => setFormData({ ...formData, weightGrams: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Pilih Lemari & Laci Tujuan</label>
                  <select
                    value={formData.drawerCode}
                    onChange={(e) => setFormData({ ...formData, drawerCode: e.target.value })}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-700"
                  >
                    {availableDrawers.map((d) => (
                      <option key={d.id} value={d.code}>
                        {d.code} - {d.name} ({d.capacity} max)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Posisi Slot Grid di Laci</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={formData.slotPosition}
                    onChange={(e) => setFormData({ ...formData, slotPosition: e.target.value })}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-700"
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
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl shadow-sm flex items-center gap-2 disabled:opacity-50 transition-colors"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Registrasi & Generate QR</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Tampilan QR Code untuk Cetak Label */}
        {qrModal.isOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Label QR Code Keping Emas
                </span>
                <button
                  onClick={() => setQrModal({ isOpen: false, item: null })}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Printable label visual */}
              <div className="bg-slate-50 text-slate-950 p-5 rounded-2xl border-2 border-dashed border-slate-200 inline-block w-full">
                {qrModal.item?.qrDataUrl ? (
                  <img
                    src={qrModal.item.qrDataUrl}
                    alt={qrModal.item.qrCode}
                    className="w-36 h-36 mx-auto mb-2 bg-white p-2 rounded-xl border border-slate-200"
                  />
                ) : (
                  <div className="w-36 h-36 mx-auto bg-white border border-slate-200 rounded-xl flex items-center justify-center mb-2">
                    <QrCode className="w-16 h-16 text-slate-400" />
                  </div>
                )}
                <div className="text-sm font-bold font-mono tracking-tight text-slate-900">{qrModal.item?.serialNumber || qrModal.item?.id}</div>
                <div className="text-[11px] font-bold text-slate-700 mt-0.5">{qrModal.item?.goldType || qrModal.item?.brand} &bull; {qrModal.item?.weightGrams ?? qrModal.item?.weight}g</div>
                <div className="text-[10px] text-slate-500 font-mono mt-1 bg-white p-1 rounded border border-slate-200">{qrModal.item?.qrCode}</div>
              </div>

              <div className="mt-4 text-xs text-slate-500">
                Laci: <strong className="text-slate-700">{qrModal.item?.drawer?.code || qrModal.item?.drawerCode}</strong> (Slot #{qrModal.item?.slotPosition || 1})
              </div>

              <button
                onClick={() => window.print()}
                className="mt-5 w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Label Stiker QR</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
