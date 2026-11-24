'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import jsQR from 'jsqr';
import {
  ShoppingCart, CheckCircle, XCircle, Truck, Package, Clock,
  Search, RefreshCw, Loader2, QrCode, Trash2, Printer, AlertTriangle,
  ChevronRight, FileText, Send, Eye, Camera, CameraOff, CheckCircle2,
  ArrowRight, RotateCcw, Box, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';

const STATUS_CONFIG = {
  DRAFT: { label: 'Draft', color: 'bg-slate-100 text-slate-600' },
  PENDING_OUTLET_SPV: { label: 'Menunggu SPV Outlet', color: 'bg-amber-100 text-amber-700' },
  SUBMITTED_TO_HO: { label: 'Masuk ke HO', color: 'bg-blue-100 text-blue-700' },
  APPROVED_HO: { label: 'Disetujui HO', color: 'bg-emerald-100 text-emerald-700' },
  PICKING: { label: 'Proses Picking', color: 'bg-violet-100 text-violet-700' },
  PARTIAL_HOLD: { label: 'Dikirim Sebagian', color: 'bg-orange-100 text-orange-700' },
  DISPATCHED: { label: 'Dikirim', color: 'bg-cyan-100 text-cyan-700' },
  RECEIVED: { label: 'Diterima', color: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Ditolak', color: 'bg-red-100 text-red-700' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'bg-slate-100 text-slate-600' };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>;
}

// ─── SURAT JALAN PRINT MODAL ──────────────────────────────────────────────────
function SuratJalanModal({ suratJalan, onClose }) {
  const printRef = useRef();
  const handlePrint = () => {
    const content = printRef.current.innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Surat Jalan - ${suratJalan.documentNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; padding: 24px; color: #1e293b; }
        h1 { font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 4px; }
        .subtitle { text-align: center; color: #64748b; margin-bottom: 20px; font-size: 11px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
        .info-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; }
        .info-box label { font-size: 10px; color: #64748b; display: block; margin-bottom: 2px; }
        .info-box span { font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11px; }
        th { background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; font-weight: 600; }
        td { border: 1px solid #e2e8f0; padding: 6px 10px; }
        .footer { margin-top: 32px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
        .sign-box { text-align: center; border-top: 1px solid #94a3b8; padding-top: 4px; margin-top: 60px; font-size: 10px; }
        @media print { body { margin: 0; } }
      </style></head><body>${content}</body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Surat Jalan - {suratJalan.documentNumber}</h2>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800">
              <Printer size={14} /> Print
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold px-2">×</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6" ref={printRef}>
          <h1>SURAT JALAN PENGIRIMAN EMAS</h1>
          <p className="subtitle">PT Pegadaian (Persero) — Smart Vault Management System</p>

          <div className="grid grid-cols-2 gap-4 mb-5 text-sm">
            <div className="bg-slate-50 rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Informasi Dokumen</h3>
              <div className="flex justify-between"><span className="text-slate-500">No. Dokumen</span><span className="font-semibold text-slate-700">{suratJalan.documentNumber}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">No. PO</span><span className="font-semibold text-slate-700">{suratJalan.poId}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Tanggal</span><span className="font-semibold text-slate-700">{new Date(suratJalan.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</span></div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Pengiriman</h3>
              <div className="flex justify-between"><span className="text-slate-500">Kurir</span><span className="font-semibold text-slate-700">{suratJalan.kurirName || '-'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Kendaraan</span><span className="font-semibold text-slate-700">{suratJalan.vehicleNumber || '-'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Petugas HO</span><span className="font-semibold text-slate-700">{suratJalan.pickerName || '-'}</span></div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 space-y-1">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Dari</h3>
              <p className="font-semibold text-slate-700">{suratJalan.from?.name}</p>
              <p className="text-xs text-slate-500">{suratJalan.from?.code}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 space-y-1">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Kepada</h3>
              <p className="font-semibold text-slate-700">{suratJalan.to?.name}</p>
              <p className="text-xs text-slate-500">{suratJalan.to?.code}</p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden mb-5">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs">
                <tr>
                  <th className="px-4 py-2 text-left">No</th>
                  <th className="px-4 py-2 text-left">Serial</th>
                  <th className="px-4 py-2 text-left">Merk</th>
                  <th className="px-4 py-2 text-left">Berat</th>
                  <th className="px-4 py-2 text-left">Kemurnian</th>
                  <th className="px-4 py-2 text-left">Lokasi Asal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suratJalan.items?.map((item, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2.5 text-slate-500">{i + 1}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{item.serialNumber}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-700">{item.brand}</td>
                    <td className="px-4 py-2.5 text-slate-600">{item.weight}g</td>
                    <td className="px-4 py-2.5 text-slate-600">{item.purity}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{item.location}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 text-sm font-semibold">
                <tr>
                  <td colSpan={3} className="px-4 py-2.5 text-slate-700">Total</td>
                  <td className="px-4 py-2.5 text-slate-700">{suratJalan.totalWeight}g</td>
                  <td colSpan={2} className="px-4 py-2.5 text-slate-500">{suratJalan.totalItems} keping emas</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="grid grid-cols-3 gap-6 mt-10">
            {[{ label: 'Petugas HO', name: suratJalan.dispatchedBy }, { label: 'Kurir / Pengantar', name: suratJalan.kurirName }, { label: 'Petugas Outlet Penerima', name: '' }].map((s, i) => (
              <div key={i} className="text-center text-sm">
                <div className="h-14 border-b border-slate-300 mb-2" />
                <p className="text-xs font-medium text-slate-600">{s.label}</p>
                {s.name && <p className="text-xs text-slate-500">({s.name})</p>}
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">Digenerate pada {new Date(suratJalan.generatedAt).toLocaleString('id-ID')} oleh {suratJalan.generatedBy}</p>
        </div>
      </div>
    </div>
  );
}

// ─── SCAN ITEM MODAL DENGAN LIVE KAMERA (HTML5 VIDEO + jsQR) ─────────────────
function ScanItemModal({ po, onClose, onItemAdded }) {
  const [step, setStep] = useState('cabinet'); // cabinet | slot | drawer | item
  const [cabinetQr, setCabinetQr] = useState('');
  const [slotNumber, setSlotNumber] = useState('');
  const [drawerQr, setDrawerQr] = useState('');
  const [itemQr, setItemQr] = useState('');

  // Location Verification Info
  const [verifiedInfo, setVerifiedInfo] = useState({
    cabinet: null,
    slot: null,
    drawer: null,
    item: null,
  });

  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [manualInput, setManualInput] = useState('');

  // Refs for video & QR scanning
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const isScanningRef = useRef(false);

  const steps = [
    { key: 'cabinet', label: '1. Lemari', hint: 'Scan QR Lemari Vault' },
    { key: 'slot', label: '2. Slot', hint: 'Pilih nomor slot (1-8)' },
    { key: 'drawer', label: '3. Laci', hint: 'Scan QR Laci Emas' },
    { key: 'item', label: '4. Emas', hint: 'Scan QR Keping Emas' },
  ];
  const stepIdx = steps.findIndex((s) => s.key === step);

  // Enumerate video devices
  const loadCameras = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setCameras(videoInputs);
        if (videoInputs.length > 0 && !selectedCameraId) {
          setSelectedCameraId(videoInputs[0].deviceId);
        }
      }
    } catch (err) {
      console.warn('Error enumerating cameras:', err);
    }
  }, [selectedCameraId]);

  useEffect(() => {
    loadCameras();
  }, [loadCameras]);

  // Stop camera stream & scan loop
  const stopCamera = useCallback(() => {
    isScanningRef.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  // Continuous frame scanning with jsQR
  const startScanLoop = useCallback(() => {
    isScanningRef.current = true;

    const scanFrame = () => {
      if (!isScanningRef.current) return;

      const video = videoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        if (!canvasRef.current) {
          canvasRef.current = document.createElement('canvas');
        }
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code && code.data && code.data.trim()) {
            isScanningRef.current = false; // pause scanning
            handleQrScanned(code.data.trim());
            return;
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animFrameRef.current = requestAnimationFrame(scanFrame);
  }, []);

  // Start native camera stream
  const startCamera = useCallback(async (deviceId) => {
    try {
      setCameraError('');
      stopCamera();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Browser Anda tidak mendukung WebRTC Camera. Silakan gunakan input manual.');
        return;
      }

      const activeDeviceId = deviceId || selectedCameraId;
      const constraints = {
        video: activeDeviceId
          ? { deviceId: { exact: activeDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      };

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        // Fallback to basic video constraint
        console.warn('Specific constraint failed, trying basic { video: true }', err);
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
        startScanLoop();
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('Kamera tidak dapat diakses atau izin ditolak. Pastikan izin kamera aktif di browser.');
      setCameraActive(false);
    }
  }, [selectedCameraId, stopCamera, startScanLoop]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // When step changes, if camera is active, resume scanning loop
  useEffect(() => {
    if (cameraActive && step !== 'slot' && !isScanningRef.current) {
      startScanLoop();
    }
  }, [step, cameraActive, startScanLoop]);

  // Verify step with backend and advance
  const verifyAndAdvance = async (stepKey, value) => {
    setLoading(true);
    try {
      const payload = {
        step: stepKey,
        cabinetQr: stepKey === 'cabinet' ? value : cabinetQr,
        slotNumber: stepKey === 'slot' ? Number(value) : Number(slotNumber),
        drawerQr: stepKey === 'drawer' ? value : drawerQr,
        itemQr: stepKey === 'item' ? value : itemQr,
      };

      const res = await apiRequest(`/ho/orders/${po.id}/verify-step`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!res.success) throw new Error(res.message);

      // Store verified location feedback
      setVerifiedInfo((prev) => ({
        ...prev,
        [stepKey]: res.data,
      }));

      toast.success(res.data.locationName ? `✓ ${res.data.locationName}` : res.message);

      // Advance sequentially
      if (stepKey === 'cabinet') {
        setCabinetQr(value);
        setStep('slot');
      } else if (stepKey === 'slot') {
        setSlotNumber(Number(value));
        setStep('drawer');
      } else if (stepKey === 'drawer') {
        setDrawerQr(value);
        setStep('item');
      } else if (stepKey === 'item') {
        setItemQr(value);
        // Step 4 final: execute actual item picking allocation
        await completeItemPicking(cabinetQr, slotNumber, drawerQr, value);
      }
    } catch (err) {
      toast.error(err.message || 'Verifikasi gagal. Pastikan QR sesuai.');
      // Resume scanning on error
      if (cameraActive && stepKey !== 'slot') {
        setTimeout(() => {
          if (!isScanningRef.current) startScanLoop();
        }, 1500);
      }
    } finally {
      setLoading(false);
    }
  };

  const completeItemPicking = async (cab, slt, drw, itm) => {
    try {
      const res = await apiRequest(`/ho/orders/${po.id}/scan-item`, {
        method: 'PATCH',
        body: JSON.stringify({
          cabinetQr: cab,
          slotNumber: Number(slt),
          drawerQr: drw,
          itemQr: itm,
        }),
      });

      stopCamera();

      Swal.fire({
        title: 'Berhasil Dipicking!',
        text: `${res.data.item.brand} ${res.data.item.weight}g dari ${res.data.location} berhasil dialokasikan ke PO`,
        icon: 'success',
        confirmButtonColor: '#059669',
        confirmButtonText: 'Lanjut Scan Item Berikutnya',
        showCancelButton: true,
        cancelButtonText: 'Selesai Picking',
      }).then((result) => {
        onItemAdded(res.data);
        if (result.isConfirmed) {
          setStep('cabinet');
          setCabinetQr('');
          setSlotNumber('');
          setDrawerQr('');
          setItemQr('');
          setVerifiedInfo({ cabinet: null, slot: null, drawer: null, item: null });
        } else {
          onClose();
        }
      });
    } catch (err) {
      toast.error(err.message || 'Gagal menyimpan picking item');
    }
  };

  const handleQrScanned = async (code) => {
    if (loading || !code) return;
    if (step === 'cabinet') {
      await verifyAndAdvance('cabinet', code);
    } else if (step === 'drawer') {
      await verifyAndAdvance('drawer', code);
    } else if (step === 'item') {
      await verifyAndAdvance('item', code);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualInput.trim()) return;
    const val = manualInput.trim();
    setManualInput('');
    if (step === 'cabinet') {
      await verifyAndAdvance('cabinet', val);
    } else if (step === 'slot') {
      await verifyAndAdvance('slot', val);
    } else if (step === 'drawer') {
      await verifyAndAdvance('drawer', val);
    } else if (step === 'item') {
      await verifyAndAdvance('item', val);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[94vh] flex flex-col overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
          <div>
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Camera size={18} className="text-emerald-700" />
              Scan & Verifikasi Lokasi Fisik Emas
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">PO: {po.id}</p>
          </div>
          <button
            onClick={() => { stopCamera(); onClose(); }}
            className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Step Breadcrumbs */}
          <div className="grid grid-cols-4 gap-1.5 bg-slate-100 p-1.5 rounded-xl text-center">
            {steps.map((s, i) => (
              <div
                key={s.key}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${i === stepIdx
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : i < stepIdx
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'text-slate-400'
                  }`}
              >
                {i < stepIdx ? '✓ ' : ''}{s.label}
              </div>
            ))}
          </div>

          {/* Location Verification Status Banners */}
          <div className="space-y-2">
            {verifiedInfo.cabinet && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-emerald-800">{verifiedInfo.cabinet.locationName}</p>
                  <p className="text-emerald-600 text-[11px] mt-0.5">{verifiedInfo.cabinet.details}</p>
                </div>
              </div>
            )}
            {verifiedInfo.slot && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-emerald-800">{verifiedInfo.slot.locationName}</p>
                  <p className="text-emerald-600 text-[11px] mt-0.5">{verifiedInfo.slot.details}</p>
                </div>
              </div>
            )}
            {verifiedInfo.drawer && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-emerald-800">{verifiedInfo.drawer.locationName}</p>
                  <p className="text-emerald-600 text-[11px] mt-0.5">{verifiedInfo.drawer.details}</p>
                </div>
              </div>
            )}
          </div>

          {/* Current Step Instruction & Controls */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                  Tahap {stepIdx + 1} dari 4
                </span>
                <h3 className="text-sm font-bold text-slate-800 mt-1">{steps[stepIdx].label}: {steps[stepIdx].hint}</h3>
              </div>
              {step !== 'slot' && (
                <button
                  type="button"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-xs ${cameraActive
                    ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                    : 'bg-emerald-700 text-white hover:bg-emerald-800'
                    }`}
                >
                  {cameraActive ? <><CameraOff size={14} /> Tutup Kamera</> : <><Camera size={14} /> Buka Kamera</>}
                </button>
              )}
            </div>

            {/* Camera Viewport with Native HTML5 Video */}
            {step !== 'slot' && (
              <div className="mb-3 space-y-2">
                <div
                  className={`relative w-full aspect-4/3 bg-slate-900 rounded-xl overflow-hidden border-2 transition-all ${cameraActive ? 'border-emerald-500 shadow-md block' : 'border-slate-200 hidden'
                    }`}
                >
                  {/* Real video feed */}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />

                  {/* Viewfinder Target Reticle Overlay */}
                  {cameraActive && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-48 h-48 border-2 border-emerald-400/80 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                        {/* Corner Accents */}
                        <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                        <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                        <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
                        {/* Animated Laser Scanning Line */}
                        <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_8px_#34d399] absolute top-1/2 -translate-y-1/2 animate-pulse" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Camera selector if multiple cameras detected */}
                {cameraActive && cameras.length > 1 && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>Kamera:</span>
                    <select
                      value={selectedCameraId}
                      onChange={(e) => {
                        setSelectedCameraId(e.target.value);
                        startCamera(e.target.value);
                      }}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      {cameras.map((cam, idx) => (
                        <option key={cam.deviceId || idx} value={cam.deviceId}>
                          {cam.label || `Kamera ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {cameraActive && (
                  <p className="text-center text-xs text-emerald-700 font-medium animate-pulse">
                    🟢 Arahkan kamera tepat ke QR Code {steps[stepIdx].label.split('.')[1]}...
                  </p>
                )}

                {cameraError && (
                  <div className="bg-amber-50 text-amber-800 text-xs p-2.5 rounded-lg flex items-center gap-1.5 border border-amber-200">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>{cameraError}</span>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Slot Selection Buttons */}
            {step === 'slot' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">Pilih nomor slot tempat laci berada (Lemari: <span className="font-semibold text-slate-700">{cabinetQr}</span>):</p>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={loading}
                      onClick={() => verifyAndAdvance('slot', s)}
                      className={`p-3 rounded-xl border text-center transition-all ${slotNumber === s
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold'
                        : 'border-slate-200 hover:border-emerald-500 hover:bg-slate-50 text-slate-700 font-medium'
                        }`}
                    >
                      <Layers size={18} className="mx-auto mb-1 text-slate-400" />
                      Slot {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Manual QR Input & Quick Sample Chips */}
            {step !== 'slot' && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-600">
                    Atau ketik / tempel kode QR:
                  </label>
                  {/* Quick-test helper button */}
                  <div className="flex gap-1">
                    {step === 'cabinet' && (
                      <button
                        type="button"
                        onClick={() => verifyAndAdvance('cabinet', 'QR-CAB-HO-01')}
                        className="text-[11px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 px-2 py-0.5 rounded text-slate-600 font-mono transition-colors"
                      >
                        + HO-CAB-01
                      </button>
                    )}
                    {step === 'drawer' && (
                      <button
                        type="button"
                        onClick={() => verifyAndAdvance('drawer', 'QR-HO-CAB-01-SL01-BIG')}
                        className="text-[11px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 px-2 py-0.5 rounded text-slate-600 font-mono transition-colors"
                      >
                        + Laci Slot 1
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleManualSubmit(); }}
                    placeholder={
                      step === 'cabinet'
                        ? 'Contoh: QR-CAB-HO-01'
                        : step === 'drawer'
                          ? 'Contoh: QR-HO-CAB-01-SL01-BIG'
                          : 'Contoh: PGD-HO-GOLD:TEST-LM-5774|...'
                    }
                    className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    disabled={loading || !manualInput.trim()}
                    onClick={handleManualSubmit}
                    className="px-3.5 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 disabled:opacity-50 flex items-center gap-1 shadow-xs"
                  >
                    {loading ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
                    Cek
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50">
          <button
            type="button"
            disabled={stepIdx === 0 || loading}
            onClick={() => {
              if (step === 'slot') setStep('cabinet');
              else if (step === 'drawer') setStep('slot');
              else if (step === 'item') setStep('drawer');
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 disabled:opacity-30"
          >
            ← Kembali ke tahap sebelumnya
          </button>
          <button
            type="button"
            onClick={() => { stopCamera(); onClose(); }}
            className="px-4 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-white"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DISPATCH MODAL ───────────────────────────────────────────────────────────
function DispatchModal({ po, onClose, onDispatched }) {
  const [kurirName, setKurirName] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [dispatchNote, setDispatchNote] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!kurirName || !vehicleNumber) return toast.error('Nama kurir dan nomor kendaraan wajib diisi');
    setLoading(true);
    try {
      const res = await apiRequest(`/ho/orders/${po.id}/dispatch`, {
        method: 'PATCH',
        body: JSON.stringify({ kurirName, vehicleNumber, dispatchNote }),
      });
      toast.success(res.message || 'PO berhasil di-dispatch');
      onDispatched(res.data);
    } catch (err) {
      toast.error(err.message || 'Gagal dispatch');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Dispatch Pengiriman</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Nama Kurir *</label>
            <input value={kurirName} onChange={(e) => setKurirName(e.target.value)}
              placeholder="Nama kurir pengiriman"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Nomor Kendaraan *</label>
            <input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)}
              placeholder="B 1234 ABC"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Catatan (opsional)</label>
            <textarea value={dispatchNote} onChange={(e) => setDispatchNote(e.target.value)}
              rows={2} placeholder="Catatan pengiriman..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">
              Batal
            </button>
            <button onClick={submit} disabled={loading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 text-white rounded-xl text-sm font-medium hover:bg-emerald-800 disabled:opacity-60">
              {loading && <Loader2 size={14} className="animate-spin" />}
              <Truck size={14} /> Kirim Sekarang
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PO DETAIL MODAL ──────────────────────────────────────────────────────────
function HoPoDetailModal({ po: initialPo, userRole, onClose, onRefresh }) {
  const [po, setPo] = useState(initialPo);
  const [loading, setLoading] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [showDispatch, setShowDispatch] = useState(false);
  const [suratJalan, setSuratJalan] = useState(null);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await apiRequest(`/ho/orders/${initialPo.id}`);
      if (res.success && res.data) setPo(res.data);
    } catch (err) {
      console.error(err);
    }
  }, [initialPo.id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const apiAction = async (endpoint, body = {}, successMsg) => {
    setLoading(true);
    try {
      const res = await apiRequest(`/ho/orders/${po.id}/${endpoint}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      toast.success(successMsg || res.message || 'Berhasil');
      fetchDetail();
      onRefresh();
    } catch (err) {
      toast.error(err.message || 'Gagal memproses aksi');
    } finally {
      setLoading(false);
    }
  };

  const confirmAction = async (endpoint, confirmMsg, successMsg, body = {}) => {
    const result = await Swal.fire({
      title: 'Konfirmasi',
      text: confirmMsg,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Ya, Lanjutkan',
      cancelButtonText: 'Batal',
    });
    if (result.isConfirmed) await apiAction(endpoint, body, successMsg);
  };

  const removeItem = async (itemId) => {
    const result = await Swal.fire({
      title: 'Hapus item dari picking?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    await apiAction('remove-item', { itemId }, 'Item dihapus dari picking list');
  };

  const loadSuratJalan = async () => {
    try {
      const res = await apiRequest(`/ho/orders/${po.id}/surat-jalan`);
      if (res.success && res.data) {
        setSuratJalan(res.data);
      }
    } catch (err) {
      toast.error(err.message || 'Gagal memuat surat jalan');
    }
  };

  const isSupervisor = ['HO_SUPERVISOR', 'SUPER_ADMIN'].includes(userRole);
  const isStaff = ['HO_STAFF', 'HO_LOGISTICS', 'HO_SUPERVISOR', 'SUPER_ADMIN'].includes(userRole);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-800">{po.id}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <StatusBadge status={po.status} />
                  <span className="text-xs text-slate-400">{po.destLocation?.name}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Outlet</p>
                <p className="font-medium text-slate-700">{po.destLocation?.name}</p>
                <p className="text-xs text-slate-500">Requested by: {po.requestedBy}</p>
                {po.outletApprovedBy && <p className="text-xs text-slate-500">SPV Outlet: {po.outletApprovedBy}</p>}
              </div>
              <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">HO Progress</p>
                {po.hoApprovedBy && <p className="text-xs text-slate-700">✓ Disetujui: {po.hoApprovedBy}</p>}
                {po.pickerName && <p className="text-xs text-slate-700">📦 Picker: {po.pickerName}</p>}
                {po.kurirName && <p className="text-xs text-slate-700">🚚 Kurir: {po.kurirName} ({po.vehicleNumber})</p>}
                {po.trackingNumber && <p className="text-xs text-emerald-700 font-medium">📋 {po.trackingNumber}</p>}
              </div>
            </div>

            {/* Request Lines */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Permintaan Emas</h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs">
                    <tr>
                      <th className="px-4 py-2 text-left">Merk</th>
                      <th className="px-4 py-2 text-left">Berat</th>
                      <th className="px-4 py-2 text-center">Diminta</th>
                      <th className="px-4 py-2 text-center">Terpenuhi</th>
                      <th className="px-4 py-2 text-center">Sisa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(po.requestLines || []).map((line) => (
                      <tr key={line.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-slate-700">{line.goldBrand}</td>
                        <td className="px-4 py-2.5 text-slate-600">{line.weightGrams}g</td>
                        <td className="px-4 py-2.5 text-center text-slate-700">{line.qtyRequested}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`font-medium ${line.qtyFulfilled >= line.qtyRequested ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {line.qtyFulfilled}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center text-slate-500">{line.qtyRequested - line.qtyFulfilled}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Picked Items */}
            {po.items && po.items.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Item Dipicking ({po.items.length} keping)</h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs">
                      <tr>
                        <th className="px-4 py-2 text-left">Serial</th>
                        <th className="px-4 py-2 text-left">Merk</th>
                        <th className="px-4 py-2 text-left">Berat</th>
                        <th className="px-4 py-2 text-left">Lokasi</th>
                        {po.status === 'PICKING' && <th className="px-4 py-2"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {po.items.map((poi) => (
                        <tr key={poi.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{poi.item?.id || poi.itemId}</td>
                          <td className="px-4 py-2.5 font-medium text-slate-700">{poi.item?.brand || '-'}</td>
                          <td className="px-4 py-2.5 text-slate-600">{poi.item?.weight}g</td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">
                            {poi.item?.drawer ? `${poi.item.drawer.slot?.cabinet?.code} / Slot ${poi.item.drawer.slot?.slotNumber} / ${poi.item.drawer.code}` : '-'}
                          </td>
                          {po.status === 'PICKING' && (
                            <td className="px-4 py-2.5">
                              <button onClick={() => removeItem(poi.item?.id || poi.itemId)} className="text-red-400 hover:text-red-600">
                                <Trash2 size={13} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Action bar */}
          <div className="flex gap-2 p-5 border-t border-slate-100 flex-wrap">
            {/* Approve (HO SPV) */}
            {po.status === 'SUBMITTED_TO_HO' && isSupervisor && (
              <>
                <button onClick={() => confirmAction('approve', 'Setujui PO ini dan mulai proses picking?', 'PO disetujui oleh HO')}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-xl text-sm font-medium hover:bg-emerald-800 disabled:opacity-60">
                  <CheckCircle size={14} /> Setujui PO
                </button>
                <button onClick={() => confirmAction('reject', 'Tolak PO ini?', 'PO ditolak')}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-medium hover:bg-red-100 disabled:opacity-60">
                  <XCircle size={14} /> Tolak
                </button>
              </>
            )}
            {/* Start Picking */}
            {po.status === 'APPROVED_HO' && isStaff && (
              <button onClick={() => confirmAction('start-picking', 'Mulai proses picking untuk PO ini?', 'Proses picking dimulai')}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 disabled:opacity-60">
                <Package size={14} /> Mulai Picking
              </button>
            )}
            {/* Scan item */}
            {po.status === 'PICKING' && isStaff && (
              <>
                <button onClick={() => setShowScan(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700">
                  <QrCode size={14} /> Scan Item
                </button>
                <button onClick={() => setShowDispatch(true)}
                  disabled={!po.items || po.items.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-xl text-sm font-medium hover:bg-cyan-700 disabled:opacity-60">
                  <Truck size={14} /> Dispatch
                </button>
              </>
            )}
            {/* Print Surat Jalan */}
            {['DISPATCHED', 'PARTIAL_HOLD', 'RECEIVED'].includes(po.status) && (
              <button onClick={loadSuratJalan}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-xl text-sm font-medium hover:bg-slate-800">
                <Printer size={14} /> Surat Jalan
              </button>
            )}
            <button onClick={onClose} className="ml-auto px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">
              Tutup
            </button>
          </div>
        </div>
      </div>

      {showScan && (
        <ScanItemModal po={po} onClose={() => setShowScan(false)} onItemAdded={() => { fetchDetail(); onRefresh(); }} />
      )}
      {showDispatch && (
        <DispatchModal po={po} onClose={() => setShowDispatch(false)} onDispatched={() => { setShowDispatch(false); fetchDetail(); onRefresh(); }} />
      )}
      {suratJalan && (
        <SuratJalanModal suratJalan={suratJalan} onClose={() => setSuratJalan(null)} />
      )}
    </>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function HoOrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('SUBMITTED_TO_HO,APPROVED_HO,PICKING');
  const [search, setSearch] = useState('');
  const [selectedPo, setSelectedPo] = useState(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (search) params.search = search;
      const res = await apiRequest('/ho/orders', { params });
      if (res && res.data) {
        setOrders(res.data.orders || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat data PO');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, search]);

  useEffect(() => {
    if (!authLoading) {
      fetchOrders();
    }
  }, [fetchOrders, authLoading]);

  const filters = [
    { label: 'Aktif', value: 'SUBMITTED_TO_HO,APPROVED_HO,PICKING' },
    { label: 'Masuk ke HO', value: 'SUBMITTED_TO_HO' },
    { label: 'Disetujui', value: 'APPROVED_HO' },
    { label: 'Picking', value: 'PICKING' },
    { label: 'Dikirim', value: 'DISPATCHED,PARTIAL_HOLD' },
    { label: 'Selesai', value: 'RECEIVED' },
    { label: 'Semua', value: '' },
  ];

  // Stats
  const stats = [
    { label: 'Menunggu Approval', value: orders.filter((o) => o.status === 'SUBMITTED_TO_HO').length, color: 'text-blue-600' },
    { label: 'Siap Picking', value: orders.filter((o) => o.status === 'APPROVED_HO').length, color: 'text-violet-600' },
    { label: 'Sedang Picking', value: orders.filter((o) => o.status === 'PICKING').length, color: 'text-amber-600' },
    { label: 'Total PO', value: orders.length, color: 'text-slate-700' },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Manajemen PO Emas</h1>
            <p className="text-sm text-slate-500 mt-0.5">Review, approve, dan kelola proses picking & dispatch ke outlet</p>
          </div>
          <button onClick={fetchOrders} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filter + Search */}
        <div className="flex gap-3 items-center flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilterStatus(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === f.value ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari No. PO..."
              className="pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48"
            />
          </div>
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
              <p className="font-medium">Tidak ada PO ditemukan</p>
              <p className="text-xs mt-1">Coba ubah filter atau tunggu order dari outlet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">No. PO</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">Outlet</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">Tanggal</th>
                  <th className="px-5 py-3 text-center font-medium text-slate-500">Diminta</th>
                  <th className="px-5 py-3 text-center font-medium text-slate-500">Dipicked</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((po) => {
                  const totalQty = po.requestLines?.reduce((s, l) => s + l.qtyRequested, 0) || 0;
                  const pickedCount = po.items?.length || 0;
                  return (
                    <tr key={po.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-700">{po.id}</td>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-700">{po.destLocation?.name}</p>
                        <p className="text-xs text-slate-400">{po.requestedBy}</p>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 text-xs">{new Date(po.createdAt).toLocaleDateString('id-ID')}</td>
                      <td className="px-5 py-3.5 text-center text-slate-700 font-medium">{totalQty} pcs</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={pickedCount >= totalQty ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-medium'}>
                          {pickedCount}
                        </span>
                        <span className="text-slate-400">/{totalQty}</span>
                      </td>
                      <td className="px-5 py-3.5"><StatusBadge status={po.status} /></td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => setSelectedPo(po)}
                          className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 font-medium"
                        >
                          <Eye size={13} /> Kelola
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

      {selectedPo && (
        <HoPoDetailModal
          po={selectedPo}
          userRole={user?.role || ''}
          onClose={() => setSelectedPo(null)}
          onRefresh={fetchOrders}
        />
      )}
    </DashboardLayout>
  );
}
