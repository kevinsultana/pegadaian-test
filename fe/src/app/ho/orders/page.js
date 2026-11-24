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
  WAITING_RESTOCK: { label: 'Menunggu Restock HO', color: 'bg-amber-100 text-amber-700' },
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
  const [slotQr, setSlotQr] = useState('');
  const [drawerQr, setDrawerQr] = useState('');
  const [itemQr, setItemQr] = useState('');

  // Refs to ALWAYS have the freshest values across async callbacks, timeouts, and animation frames
  const stepRef = useRef(step);
  const cabinetQrRef = useRef(cabinetQr);
  const slotQrRef = useRef(slotQr);
  const drawerQrRef = useRef(drawerQr);
  const itemQrRef = useRef(itemQr);

  useEffect(() => { stepRef.current = step; }, [step]);
  useEffect(() => { cabinetQrRef.current = cabinetQr; }, [cabinetQr]);
  useEffect(() => { slotQrRef.current = slotQr; }, [slotQr]);
  useEffect(() => { drawerQrRef.current = drawerQr; }, [drawerQr]);
  useEffect(() => { itemQrRef.current = itemQr; }, [itemQr]);

  // Target item yang sedang dipicking (item yang belum di-pick, atau item pertama)
  const pendingItems = (po.items || []).filter((pi) => !pi.isPicked);
  const currentTarget = pendingItems[0] || (po.items || [])[0];
  const targetItem = currentTarget?.item;
  const targetCabinetCode = targetItem?.drawer?.slot?.cabinet?.code;
  const targetCabinetQr = targetItem?.drawer?.slot?.cabinet?.qrCode || 'QR-CAB-HO-01';
  const targetSlotNumber = targetItem?.drawer?.slot?.slotNumber;
  const targetSlotQr = targetItem?.drawer?.slot?.qrCode || (targetCabinetCode && targetSlotNumber ? `QR-${targetCabinetCode}-SLOT-${String(targetSlotNumber).padStart(2, '0')}` : 'QR-HO-CAB-01-SLOT-07');
  const targetDrawerCode = targetItem?.drawer?.code;
  const targetDrawerQr = targetItem?.drawer?.qrCode || 'QR-HO-CAB-01-SL07-S06';
  const targetSerial = targetItem?.id || targetItem?.qrCode;

  // Location Verification Info
  const [verifiedInfo, setVerifiedInfo] = useState({
    cabinet: null,
    slot: null,
    drawer: null,
    item: null,
  });

  const [loading, setLoading] = useState(false);
  const [transitionState, setTransitionState] = useState(null); // Jeda & visual feedback antar tahap
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [manualInput, setManualInput] = useState('');
  const fileInputRef = useRef(null);

  // Refs for video & QR scanning
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const isScanningRef = useRef(false);

  const steps = [
    { key: 'cabinet', label: '1. Lemari', hint: 'Scan QR Lemari Vault' },
    { key: 'slot', label: '2. Slot', hint: 'Scan QR Slot Lemari' },
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
            isScanningRef.current = false; // pause scanning immediately
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

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraError('Browser Anda tidak mendukung WebRTC Camera. Silakan gunakan upload foto QR atau input manual.');
        return;
      }

      setCameraActive(true);

      const activeDeviceId = deviceId || selectedCameraId;
      let stream;

      try {
        const constraints = {
          video: activeDeviceId
            ? { deviceId: { exact: activeDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err1) {
        console.warn('Specific constraint failed, trying basic { video: true }:', err1);
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      streamRef.current = stream;

      // Update camera enumeration now that permission is granted
      if (navigator.mediaDevices?.enumerateDevices) {
        const devs = await navigator.mediaDevices.enumerateDevices();
        const vInputs = devs.filter((d) => d.kind === 'videoinput');
        setCameras(vInputs);
        const currentTrack = stream.getVideoTracks()[0];
        const currentDevId = currentTrack?.getSettings()?.deviceId;
        if (currentDevId) setSelectedCameraId(currentDevId);
      }

      // Small delay to ensure video element is mounted and rendered
      await new Promise((r) => setTimeout(r, 80));

      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.muted = true;

        video.onloadedmetadata = async () => {
          try {
            await video.play();
          } catch (playErr) {
            console.warn('Video play error:', playErr);
          }
          startScanLoop();
        };

        if (video.readyState >= 1) {
          try {
            await video.play();
          } catch (e) { }
          startScanLoop();
        }
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('Kamera tidak dapat diakses: ' + (err.message || 'Izin kamera ditolak di browser.'));
      setCameraActive(false);
    }
  }, [selectedCameraId, stopCamera, startScanLoop]);

  // Handle uploading QR Code photo / file
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height);
        if (code && code.data && code.data.trim()) {
          toast.success(`QR terdeteksi: ${code.data}`);
          handleQrScanned(code.data.trim());
        } else {
          toast.error('Tidak ditemukan QR code pada gambar. Pastikan gambar jelas atau gunakan tombol cepat.');
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Auto-start camera when modal mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      startCamera();
    }, 150);
    return () => {
      clearTimeout(timer);
      stopCamera();
    };
  }, []);

  // When step changes, if camera is active, resume scanning loop
  useEffect(() => {
    if (cameraActive && !isScanningRef.current && !transitionState) {
      startScanLoop();
    }
  }, [step, cameraActive, transitionState, startScanLoop]);

  // Verify step with backend and advance WITH DELAY & USER FEEDBACK
  const verifyAndAdvance = async (stepKey, value) => {
    if (loading || transitionState) return;
    setLoading(true);
    isScanningRef.current = false; // Pause scanning immediately

    try {
      const payload = {
        step: stepKey,
        targetItemId: targetItem?.id,
        cabinetQr: stepKey === 'cabinet' ? value : cabinetQrRef.current,
        slotQr: stepKey === 'slot' ? value : slotQrRef.current,
        drawerQr: stepKey === 'drawer' ? value : drawerQrRef.current,
        itemQr: stepKey === 'item' ? value : itemQrRef.current,
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

      // Advance sequentially with clear visual transition & delay
      if (stepKey === 'cabinet') {
        setCabinetQr(value);
        cabinetQrRef.current = value;
        setTransitionState({
          completedStep: '1. Lemari',
          completedText: res.data.locationName || `Lemari ${value}`,
          nextStep: '2. Slot',
          nextHint: `Arahkan kamera ke QR Slot (Target: Slot ${targetSlotNumber || '7'})`,
        });
        await new Promise((r) => setTimeout(r, 1400));
        setStep('slot');
        stepRef.current = 'slot';
        setTransitionState(null);
      } else if (stepKey === 'slot') {
        const validatedSlotQr = res.data.slotQr || value;
        setSlotQr(validatedSlotQr);
        slotQrRef.current = validatedSlotQr;
        setTransitionState({
          completedStep: '2. Slot',
          completedText: res.data.locationName || `Slot ${validatedSlotQr}`,
          nextStep: '3. Laci',
          nextHint: `Arahkan kamera ke QR Laci (Target: ${targetDrawerCode || 'Laci S03'})`,
        });
        await new Promise((r) => setTimeout(r, 1400));
        setStep('drawer');
        stepRef.current = 'drawer';
        setTransitionState(null);
      } else if (stepKey === 'drawer') {
        setDrawerQr(value);
        drawerQrRef.current = value;
        setTransitionState({
          completedStep: '3. Laci',
          completedText: res.data.locationName || `Laci ${value}`,
          nextStep: '4. Emas',
          nextHint: `Arahkan kamera ke QR / Serial Keping Emas (Target: ${targetSerial || 'E0040001'})`,
        });
        await new Promise((r) => setTimeout(r, 1400));
        setStep('item');
        stepRef.current = 'item';
        setTransitionState(null);
      } else if (stepKey === 'item') {
        setItemQr(value);
        itemQrRef.current = value;
        setTransitionState({
          completedStep: '4. Emas',
          completedText: res.data.locationName || `Emas ${value}`,
          nextStep: 'Selesai',
          nextHint: 'Menyimpan alokasi picking...',
        });
        await new Promise((r) => setTimeout(r, 1000));
        await completeItemPicking(cabinetQrRef.current, slotQrRef.current || value, drawerQrRef.current, value);
        setTransitionState(null);
      }
    } catch (err) {
      if (err.message && (err.message.includes('Salah tempat') || err.message.includes('Salah keping emas'))) {
        Swal.fire({
          title: 'Salah Tempat / Barang!',
          text: err.message,
          icon: 'warning',
          confirmButtonColor: '#d97706',
          confirmButtonText: 'Saya Mengerti, Coba Lagi',
        });
      } else {
        toast.error(err.message || 'Verifikasi gagal. Pastikan QR sesuai.');
      }
    } finally {
      setLoading(false);
      // Resume scanning on next step
      if (cameraActive && stepRef.current !== 'item') {
        setTimeout(() => {
          if (!isScanningRef.current) startScanLoop();
        }, 400);
      }
    }
  };

  const completeItemPicking = async (cab, slt, drw, itm) => {
    try {
      const res = await apiRequest(`/ho/orders/${po.id}/scan-item`, {
        method: 'PATCH',
        body: JSON.stringify({
          targetItemId: targetItem?.id,
          cabinetQr: cab,
          slotQr: slt,
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
          stepRef.current = 'cabinet';
          setCabinetQr('');
          cabinetQrRef.current = '';
          setSlotQr('');
          slotQrRef.current = '';
          setDrawerQr('');
          drawerQrRef.current = '';
          setItemQr('');
          itemQrRef.current = '';
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
    if (loading || !code || transitionState) return;
    const currentActiveStep = stepRef.current;
    await verifyAndAdvance(currentActiveStep, code);
  };

  const handleManualSubmit = async () => {
    if (!manualInput.trim() || transitionState) return;
    const val = manualInput.trim();
    setManualInput('');
    await verifyAndAdvance(stepRef.current, val);
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
          {/* Target Location Guidance Banner */}
          {targetItem && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <Package size={15} className="text-emerald-700" />
                  Target Item: {targetItem.brand} {targetItem.weight}g
                </span>
                <span className="font-mono bg-white px-2 py-0.5 rounded text-[11px] font-bold text-emerald-800 border border-emerald-200">
                  SN: {targetItem.id}
                </span>
              </div>
              <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-100 text-[11px] text-slate-700 space-y-1">
                <p className="font-semibold text-emerald-900 text-xs">📍 Panduan Lokasi Pengambilan Fisik:</p>
                <div className="grid grid-cols-3 gap-1.5 text-center mt-1">
                  <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">1. Lemari</span>
                    <span className="font-bold text-slate-800">{targetCabinetCode || 'HO-CAB-01'}</span>
                  </div>
                  <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">2. Slot</span>
                    <span className="font-bold text-slate-800">Slot {targetSlotNumber || '7'}</span>
                  </div>
                  <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">3. Laci</span>
                    <span className="font-bold text-slate-800 truncate block">{targetDrawerCode || 'Laci S03'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

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
              <div className="flex items-center gap-1.5">
                {/* Upload QR Image File Button */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors shadow-xs"
                  title="Upload foto / screenshot QR Code"
                >
                  <FileText size={13} />
                  Upload Foto QR
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (cameraActive) {
                      stopCamera();
                    } else {
                      startCamera();
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-xs ${cameraActive
                    ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                    : 'bg-emerald-700 text-white hover:bg-emerald-800'
                    }`}
                >
                  {cameraActive ? <><CameraOff size={14} /> Tutup Kamera</> : <><Camera size={14} /> Buka Kamera</>}
                </button>
              </div>
            </div>

            {/* Camera Viewport with Native HTML5 Video - Active across ALL steps */}
            <div className="mb-3 space-y-2">
              <div className="relative w-full aspect-4/3 bg-slate-950 rounded-xl overflow-hidden border-2 border-slate-200 shadow-sm flex items-center justify-center">
                {/* Real video feed */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
                />

                {/* Placeholder state when camera is inactive */}
                {!cameraActive && (
                  <div className="text-center p-6 space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 flex items-center justify-center mx-auto shadow-inner">
                      <Camera size={26} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">Kamera Sedang Nonaktif</p>
                      <p className="text-xs text-slate-400 mt-0.5">Aktifkan kamera untuk memindai QR code secara langsung</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startCamera()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold transition-all shadow-md"
                    >
                      <Camera size={14} /> Nyalakan Kamera
                    </button>
                  </div>
                )}

                {/* Viewfinder Target Reticle Overlay when Active */}
                {cameraActive && !transitionState && (
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

                {/* Transition / Jeda Berhasil Overlay (UI/UX Jeda Antar Tahap) */}
                {transitionState && (
                  <div className="absolute inset-0 bg-slate-950/92 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center text-white z-20">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mb-3 shadow-[0_0_24px_rgba(52,211,153,0.4)] animate-bounce">
                      <CheckCircle2 size={36} className="text-emerald-400" />
                    </div>
                    <span className="text-[11px] uppercase font-bold tracking-wider text-emerald-400 bg-emerald-950/90 border border-emerald-500/30 px-3 py-1 rounded-full mb-1.5">
                      ✓ {transitionState.completedStep} Berhasil Diverifikasi!
                    </span>
                    <p className="text-sm font-bold text-slate-100 max-w-xs truncate">
                      {transitionState.completedText}
                    </p>
                    <div className="mt-4 pt-3 border-t border-slate-800 w-full max-w-xs space-y-1">
                      <p className="text-xs font-semibold text-emerald-300 flex items-center justify-center gap-1.5">
                        <ArrowRight size={13} className="animate-pulse text-emerald-400" />
                        Lanjut ke Tahap: {transitionState.nextStep}
                      </p>
                      <p className="text-[11px] text-slate-300 font-medium">{transitionState.nextHint}</p>
                    </div>
                    <div className="w-48 h-1.5 bg-slate-800 rounded-full mt-3 overflow-hidden">
                      <div className="h-full bg-emerald-400 animate-pulse w-full rounded-full" />
                    </div>
                  </div>
                )}
              </div>

              {/* Camera selector */}
              {cameraActive && cameras.length > 0 && (
                <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                  <span className="font-medium">📷 Pilih Kamera:</span>
                  <select
                    value={selectedCameraId}
                    onChange={(e) => {
                      setSelectedCameraId(e.target.value);
                      startCamera(e.target.value);
                    }}
                    className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-50 truncate"
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
                <div className="space-y-1">
                  <p className="text-center text-xs text-emerald-700 font-medium animate-pulse">
                    🟢 Arahkan kamera tepat ke QR Code {steps[stepIdx].label.split('.')[1]}...
                  </p>
                  <p className="text-center text-[11px] text-slate-400">
                    💡 <i>Jika kamera gelap: buka penutup fisik webcam laptop atau gunakan tombol <b>Upload Foto QR</b> / tombol cepat di bawah.</i>
                  </p>
                </div>
              )}

              {cameraError && (
                <div className="bg-amber-50 text-amber-800 text-xs p-2.5 rounded-lg flex items-center gap-1.5 border border-amber-200">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}
            </div>

            {/* Manual QR Input & Quick Sample Chips */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <label className="text-xs font-medium text-slate-600">
                  Atau klik tombol target / tempel QR:
                </label>
                {/* Quick-test helper buttons */}
                <div className="flex gap-1 flex-wrap">
                  {step === 'cabinet' && (
                    <>
                      <button
                        type="button"
                        disabled={loading || !!transitionState}
                        onClick={() => verifyAndAdvance('cabinet', targetCabinetQr)}
                        className="text-[11px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2 py-0.5 rounded font-mono transition-colors border border-emerald-200 font-semibold disabled:opacity-50"
                      >
                        ⚡ Target: {targetCabinetCode || 'HO-01'}
                      </button>
                      <button
                        type="button"
                        disabled={loading || !!transitionState}
                        onClick={() => verifyAndAdvance('cabinet', 'QR-CAB-HO-01')}
                        className="text-[11px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 px-2 py-0.5 rounded text-slate-600 font-mono transition-colors disabled:opacity-50"
                      >
                        CAB-HO-01
                      </button>
                    </>
                  )}
                  {step === 'slot' && (
                    <>
                      <button
                        type="button"
                        disabled={loading || !!transitionState}
                        onClick={() => verifyAndAdvance('slot', targetSlotQr)}
                        className="text-[11px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2 py-0.5 rounded font-mono transition-colors border border-emerald-200 font-semibold disabled:opacity-50"
                      >
                        ⚡ Target: Slot {targetSlotNumber || '7'} ({targetSlotQr})
                      </button>
                      <button
                        type="button"
                        disabled={loading || !!transitionState}
                        onClick={() => verifyAndAdvance('slot', 'QR-HO-CAB-01-SLOT-07')}
                        className="text-[11px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 px-2 py-0.5 rounded text-slate-600 font-mono transition-colors disabled:opacity-50"
                      >
                        Slot 7
                      </button>
                      <button
                        type="button"
                        disabled={loading || !!transitionState}
                        onClick={() => verifyAndAdvance('slot', 'QR-HO-CAB-01-SLOT-05')}
                        className="text-[11px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 px-2 py-0.5 rounded text-slate-600 font-mono transition-colors disabled:opacity-50"
                      >
                        Slot 5
                      </button>
                    </>
                  )}
                  {step === 'drawer' && (
                    <>
                      <button
                        type="button"
                        disabled={loading || !!transitionState}
                        onClick={() => verifyAndAdvance('drawer', targetDrawerQr)}
                        className="text-[11px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2 py-0.5 rounded font-mono transition-colors border border-emerald-200 font-semibold disabled:opacity-50"
                      >
                        ⚡ Target: {targetDrawerCode || 'Laci S03'}
                      </button>
                      <button
                        type="button"
                        disabled={loading || !!transitionState}
                        onClick={() => verifyAndAdvance('drawer', 'QR-HO-CAB-01-SL07-S06')}
                        className="text-[11px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 px-2 py-0.5 rounded text-slate-600 font-mono transition-colors disabled:opacity-50"
                      >
                        SL07-S06
                      </button>
                      <button
                        type="button"
                        disabled={loading || !!transitionState}
                        onClick={() => verifyAndAdvance('drawer', 'QR-HO-CAB-01-SL05-BIG')}
                        className="text-[11px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 px-2 py-0.5 rounded text-slate-600 font-mono transition-colors disabled:opacity-50"
                      >
                        SL05-BIG
                      </button>
                    </>
                  )}
                  {step === 'item' && (
                    <>
                      <button
                        type="button"
                        disabled={loading || !!transitionState}
                        onClick={() => verifyAndAdvance('item', targetSerial || 'E0040001')}
                        className="text-[11px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2 py-0.5 rounded font-mono transition-colors border border-emerald-200 font-semibold disabled:opacity-50"
                      >
                        ⚡ Target: {targetSerial || 'E0040001'}
                      </button>
                      <button
                        type="button"
                        disabled={loading || !!transitionState}
                        onClick={() => verifyAndAdvance('item', 'E0040009')}
                        className="text-[11px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 px-2 py-0.5 rounded text-slate-600 font-mono transition-colors disabled:opacity-50"
                      >
                        E0040009 (25g)
                      </button>
                      <button
                        type="button"
                        disabled={loading || !!transitionState}
                        onClick={() => verifyAndAdvance('item', 'E0040010')}
                        className="text-[11px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 px-2 py-0.5 rounded text-slate-600 font-mono transition-colors disabled:opacity-50"
                      >
                        E0040010 (10g)
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  disabled={loading || !!transitionState}
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleManualSubmit(); }}
                  placeholder={
                    step === 'cabinet'
                      ? 'Contoh: QR-CAB-HO-01'
                      : step === 'slot'
                        ? 'Contoh: QR-HO-CAB-01-SLOT-07'
                        : step === 'drawer'
                          ? 'Contoh: QR-HO-CAB-01-SL07-S06'
                          : 'Contoh: E0040001 atau scan QR emas'
                  }
                  className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={loading || !!transitionState || !manualInput.trim()}
                  onClick={handleManualSubmit}
                  className="px-3.5 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 disabled:opacity-50 flex items-center gap-1 shadow-xs"
                >
                  {loading ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
                  Cek
                </button>
              </div>
            </div>
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

// ─── HO APPROVE ALLOCATION MODAL (FIFO & ITEM SELECTION) ───────────────────────
function HoApproveAllocationModal({ po, isPartial, onClose, onApproved }) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [allocationData, setAllocationData] = useState(null);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [note, setNote] = useState('');

  const fetchAvailableItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiRequest(`/ho/orders/${po.id}/available-items`);
      if (res.success && res.data) {
        setAllocationData(res.data);
        // Pre-select items based on FIFO recommendation
        const defaultSelected = [];
        (res.data.requestLines || []).forEach((line) => {
          (line.items || []).forEach((item) => {
            if (item.isFifoRecommended) {
              defaultSelected.push(item.id);
            }
          });
        });
        setSelectedItemIds(defaultSelected);
      }
    } catch (err) {
      toast.error(err.message || 'Gagal mengambil data ketersediaan item');
    } finally {
      setLoading(false);
    }
  }, [po.id]);

  useEffect(() => {
    fetchAvailableItems();
  }, [fetchAvailableItems]);

  const toggleItem = (itemId, line) => {
    if (selectedItemIds.includes(itemId)) {
      setSelectedItemIds(selectedItemIds.filter((id) => id !== itemId));
    } else {
      // Hitung item yang sudah terpilih untuk line ini
      const lineItemIds = (line.items || []).map((it) => it.id);
      const currentSelectedCountForLine = selectedItemIds.filter((id) => lineItemIds.includes(id)).length;
      if (currentSelectedCountForLine >= line.qtyRequested && !isPartial) {
        toast.error(`Kuantitas untuk ${line.goldBrand} ${line.weightGrams}g sudah mencukupi (${line.qtyRequested} keping). Batalkan pilihan item lain dulu jika ingin menukar.`);
        return;
      }
      setSelectedItemIds([...selectedItemIds, itemId]);
    }
  };

  const resetToFifo = () => {
    if (!allocationData) return;
    const fifoSelected = [];
    (allocationData.requestLines || []).forEach((line) => {
      (line.items || []).forEach((item) => {
        if (item.isFifoRecommended) {
          fifoSelected.push(item.id);
        }
      });
    });
    setSelectedItemIds(fifoSelected);
    toast.success('Pilihan direset ke rekomendasi FIFO');
  };

  const handleApprove = async () => {
    if (selectedItemIds.length === 0) {
      toast.error('Pilih minimal 1 keping emas untuk dialokasikan');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest(`/ho/orders/${po.id}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({
          isPartial: !!isPartial,
          selectedItemIds,
          note: note.trim() || undefined,
        }),
      });

      if (!res.success) throw new Error(res.message);

      toast.success(res.message || 'PO berhasil disetujui');
      onApproved();
    } catch (err) {
      toast.error(err.message || 'Gagal menyetujui PO');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
          <div>
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Package size={18} className="text-emerald-700" />
              Alokasi Stok Emas Fisik (Sistem FIFO)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              PO: {po.id} • {po.destLocation?.name} • {isPartial ? 'Persetujuan Sebagian (Parsial)' : 'Persetujuan Penuh'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1">
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* FIFO Guidance Info Banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-emerald-800">
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
              Prinsip FIFO (First In, First Out)
            </div>
            <p className="text-emerald-700 leading-relaxed text-[11px]">
              Sistem secara otomatis menandai dan memprioritaskan keping emas yang <b>pertama kali masuk ke Vault HO</b> (berdasarkan tanggal masuk). Anda dapat menyesuaikan atau memilih keping spesifik lain yang tersedia di laci bila dibutuhkan.
            </p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
              <Loader2 size={24} className="animate-spin text-emerald-600" />
              <p className="text-xs font-medium">Memeriksa ketersediaan fisik emas di Vault HO...</p>
            </div>
          ) : !allocationData || !allocationData.requestLines || allocationData.requestLines.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              Tidak ada baris permintaan yang ditemukan.
            </div>
          ) : (
            <div className="space-y-4">
              {allocationData.requestLines.map((line) => {
                const lineItemIds = (line.items || []).map((it) => it.id);
                const selectedInThisLine = selectedItemIds.filter((id) => lineItemIds.includes(id));
                const isComplete = selectedInThisLine.length === line.qtyRequested;

                return (
                  <div key={line.requestLineId} className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    {/* Header bar of line */}
                    <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-sm">{line.goldBrand} {line.weightGrams}g</span>
                        <span className="text-xs text-slate-500 font-normal">
                          (Permintaan: <b>{line.qtyRequested}</b> keping)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isComplete
                            ? 'bg-emerald-100 text-emerald-800'
                            : selectedInThisLine.length > 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                          Terpilih: {selectedInThisLine.length} / {line.qtyRequested}
                        </span>
                      </div>
                    </div>

                    {/* Item list for this line */}
                    <div className="p-3">
                      {line.items.length === 0 ? (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 flex items-center gap-2">
                          <XCircle size={15} className="shrink-0" />
                          <span>Stok fisik untuk {line.goldBrand} {line.weightGrams}g kosong di Vault HO.</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {line.items.map((item) => {
                            const isSelected = selectedItemIds.includes(item.id);
                            return (
                              <div
                                key={item.id}
                                onClick={() => toggleItem(item.id, line)}
                                className={`flex items-start gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-all ${isSelected
                                    ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-400'
                                    : 'bg-white border-slate-200 hover:bg-slate-50'
                                  }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => { }} // handled by parent div
                                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />

                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center justify-between flex-wrap gap-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-bold text-slate-800">{item.id}</span>
                                      <span className="text-slate-500 font-medium">({item.weight}g • {item.purity})</span>
                                    </div>

                                    {/* FIFO Rank Badge */}
                                    {item.fifoRank === 1 ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                        ⭐ FIFO #1 (Masuk Pertama)
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                                        FIFO #{item.fifoRank}
                                      </span>
                                    )}
                                  </div>

                                  {/* Detailed physical location */}
                                  <div className="text-[11px] text-slate-600 flex items-center gap-2 flex-wrap pt-0.5">
                                    <span className="font-semibold text-emerald-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                                      📍 {item.location?.display || 'Lokasi HO'}
                                    </span>
                                    <span className="text-slate-400">
                                      Tgl Masuk: {item.createdAt ? new Date(item.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Note field */}
              <div className="space-y-1 pt-1">
                <label className="text-xs font-semibold text-slate-700">Catatan Supervisor HO (opsional)</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Catatan tambahan alokasi..."
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none bg-slate-50"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50">
          <button
            type="button"
            onClick={resetToFifo}
            disabled={loading || submitting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50"
          >
            <RotateCcw size={13} /> Reset ke FIFO
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-medium hover:bg-white"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={loading || submitting || selectedItemIds.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-xl text-xs font-semibold hover:bg-emerald-800 disabled:opacity-50 shadow-md"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              {isPartial ? 'Setujui Sebagian & Alokasikan' : 'Setujui & Alokasikan Emas'}
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
  const [showApproveAllocation, setShowApproveAllocation] = useState(false);
  const [isPartialApprove, setIsPartialApprove] = useState(false);
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

  const handleHoldForRestock = async () => {
    const { value: formValues } = await Swal.fire({
      title: 'Tahan PO — Menunggu Restock HO',
      html: `
        <div class="text-left text-xs text-slate-500 mb-2">
          Status PO akan diubah menjadi <b class="text-amber-700">Menunggu Restock HO</b>. Berikan informasi estimasi barang tiba agar pihak outlet terinfo:
        </div>
        <input id="swal-restock-date" class="swal2-input text-xs" placeholder="Estimasi Tanggal Barang Ready (misal: 28 Nov 2026)" />
        <textarea id="swal-restock-note" class="swal2-textarea text-xs" placeholder="Catatan tambahan untuk outlet..."></textarea>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Tahan PO',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#d97706',
      preConfirm: () => {
        return {
          estimatedDate: document.getElementById('swal-restock-date')?.value || '',
          note: document.getElementById('swal-restock-note')?.value || '',
        };
      },
    });

    if (formValues) {
      await apiAction('hold-restock', formValues, 'PO berhasil ditahan (Menunggu Restock HO)');
    }
  };

  const handleApprovePartial = async () => {
    const result = await Swal.fire({
      title: 'Setujui Pengiriman Parsial?',
      text: 'HO akan menyetujui kuantitas sesuai stok fisik yang tersedia di lemari HO saat ini. Sisa kuantitas yang belum lengkap akan menunggu pengadaan/restock HO.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      confirmButtonText: 'Ya, Setujui Parsial',
      cancelButtonText: 'Batal',
    });
    if (result.isConfirmed) {
      await apiAction('approve', { isPartial: true }, 'PO disetujui sebagian. Sisa menunggu restock HO.');
    }
  };

  const handleReject = async () => {
    const defaultReason = po.overallStockStatus === 'OUT_OF_STOCK'
      ? 'Stok emas yang diminta saat ini kosong di Vault HO dan belum ada jadwal restock terdekat'
      : '';
    const { value: reason } = await Swal.fire({
      title: 'Tolak Permintaan PO',
      input: 'textarea',
      inputLabel: 'Alasan Penolakan',
      inputValue: defaultReason,
      placeholder: 'Tuliskan alasan penolakan...',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Tolak PO',
      cancelButtonText: 'Batal',
      inputValidator: (value) => {
        if (!value) return 'Alasan penolakan wajib diisi!';
      },
    });
    if (reason) {
      await apiAction('reject', { reason }, 'PO berhasil ditolak');
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

            {/* Stock Availability Analysis Card (HO SPV Review & Mitigation) */}
            {['SUBMITTED_TO_HO', 'WAITING_RESTOCK', 'APPROVED_HO'].includes(po.status) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">Analisis Ketersediaan Stok Fisik di Vault HO</h3>
                  {po.overallStockStatus === 'ALL_AVAILABLE' && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <CheckCircle2 size={13} /> Stok Fisik Lengkap
                    </span>
                  )}
                  {po.overallStockStatus === 'PARTIALLY_AVAILABLE' && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 flex items-center gap-1">
                      <AlertTriangle size={13} /> Stok Parsial (Sebagian Kosong)
                    </span>
                  )}
                  {po.overallStockStatus === 'OUT_OF_STOCK' && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 flex items-center gap-1">
                      <XCircle size={13} /> Stok Kosong di HO
                    </span>
                  )}
                </div>

                {/* Banner explanation */}
                {po.overallStockStatus === 'ALL_AVAILABLE' && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-900 flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-emerald-800">Semua Item Tersedia di Lemari Vault HO</p>
                      <p className="text-emerald-700 mt-0.5">
                        Kuantitas fisik emas di Vault HO mencukupi seluruh permintaan PO ini. Supervisor dapat langsung menyetujui PO untuk memulai proses picking fisik.
                      </p>
                    </div>
                  </div>
                )}

                {po.overallStockStatus === 'PARTIALLY_AVAILABLE' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
                    <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-amber-800">Sebagian Kuantitas Item Kurang / Kosong</p>
                      <p className="text-amber-700 mt-0.5">
                        HO memiliki sebagian stok fisik yang diminta. Anda dapat memilih <b>Setujui Sebagian</b> (kirim barang yang ada sekarang, sisa menunggu pengadaan) atau <b>Tahan PO</b> untuk menunggu restock emas lengkap.
                      </p>
                    </div>
                  </div>
                )}

                {po.overallStockStatus === 'OUT_OF_STOCK' && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-900 flex items-start gap-2.5">
                    <XCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-red-800">Stok Emas yang Diminta Kosong di Vault HO</p>
                      <p className="text-red-700 mt-0.5">
                        Tidak ada stok fisik emas yang sesuai di laci lemari HO. PO ini <b>tidak dapat disetujui langsung</b>. Silakan tahan PO (menunggu pengadaan / restock) atau tolak permintaan.
                      </p>
                    </div>
                  </div>
                )}

                {/* Prominent Info if PO is currently WAITING_RESTOCK */}
                {po.status === 'WAITING_RESTOCK' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900">
                    <p className="font-semibold text-blue-800">⏳ Status PO: Menunggu Restock HO</p>
                    <p className="text-blue-700 mt-0.5">{po.hoNote || 'Sedang menunggu pengiriman fisik emas inbound ke Vault HO.'}</p>
                  </div>
                )}
              </div>
            )}

            {/* Request Lines */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Daftar Permintaan & Ketersediaan Emas</h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs">
                    <tr>
                      <th className="px-4 py-2 text-left">Merk</th>
                      <th className="px-4 py-2 text-left">Berat</th>
                      <th className="px-4 py-2 text-center">Diminta</th>
                      <th className="px-4 py-2 text-center">Stok HO</th>
                      <th className="px-4 py-2 text-center">Status Stok</th>
                      <th className="px-4 py-2 text-center">Disetujui</th>
                      <th className="px-4 py-2 text-center">Terpenuhi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(po.requestLines || []).map((line) => (
                      <tr key={line.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-slate-700">{line.goldBrand}</td>
                        <td className="px-4 py-2.5 text-slate-600">{line.weightGrams}g</td>
                        <td className="px-4 py-2.5 text-center text-slate-700 font-semibold">{line.qtyRequested}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-md font-mono text-xs font-bold ${line.availableStock >= line.qtyRequested
                            ? 'bg-emerald-100 text-emerald-800'
                            : line.availableStock > 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                            }`}>
                            {line.availableStock ?? 0}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {line.stockStatus === 'FULL' && (
                            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              ✓ Lengkap
                            </span>
                          )}
                          {line.stockStatus === 'PARTIAL' && (
                            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                              Kurang {line.shortage}
                            </span>
                          )}
                          {line.stockStatus === 'EMPTY' && (
                            <span className="text-[11px] font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                              Kosong
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center text-slate-700 font-medium">
                          {line.qtyApproved !== null && line.qtyApproved !== undefined ? line.qtyApproved : line.qtyRequested}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`font-medium ${line.qtyFulfilled >= (line.qtyApproved ?? line.qtyRequested) ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {line.qtyFulfilled} / {line.qtyApproved ?? line.qtyRequested}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Picked / Allocated Items */}
            {po.items && po.items.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-700">
                    Alokasi Item Emas ({po.items.length} keping)
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">
                    {po.items.filter((i) => i.isPicked).length} dari {po.items.length} selesai dipicking
                  </span>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs">
                      <tr>
                        <th className="px-4 py-2 text-left">Serial</th>
                        <th className="px-4 py-2 text-left">Merk</th>
                        <th className="px-4 py-2 text-left">Berat</th>
                        <th className="px-4 py-2 text-left">Lokasi Fisik (Lemari / Slot / Laci)</th>
                        <th className="px-4 py-2 text-center">Status Picking</th>
                        {po.status === 'PICKING' && <th className="px-4 py-2"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {po.items.map((poi) => {
                        const cab = poi.item?.drawer?.slot?.cabinet?.code;
                        const slot = poi.item?.drawer?.slot?.slotNumber;
                        const drw = poi.item?.drawer?.code;
                        const locDisplay = cab && slot && drw ? `${cab} • Slot ${slot} • ${drw}` : (poi.item?.drawer ? `${poi.item.drawer.code}` : '-');

                        return (
                          <tr key={poi.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-2.5 font-mono text-xs font-bold text-slate-700">{poi.item?.id || poi.itemId}</td>
                            <td className="px-4 py-2.5 font-medium text-slate-700">{poi.item?.brand || '-'}</td>
                            <td className="px-4 py-2.5 text-slate-600">{poi.item?.weight}g</td>
                            <td className="px-4 py-2.5 text-xs">
                              <span className="font-semibold text-emerald-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 inline-block">
                                📍 {locDisplay}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {poi.isPicked ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                                  <CheckCircle2 size={12} /> Selesai Di-scan
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 animate-pulse">
                                  <Clock size={12} /> Target (Belum Di-scan)
                                </span>
                              )}
                            </td>
                            {po.status === 'PICKING' && (
                              <td className="px-4 py-2.5 text-right">
                                <button onClick={() => removeItem(poi.item?.id || poi.itemId)} className="text-red-400 hover:text-red-600 p-1" title="Hapus dari alokasi">
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Action bar */}
          <div className="flex gap-2 p-5 border-t border-slate-100 flex-wrap">
            {/* SPV Actions for SUBMITTED_TO_HO with Stock Mitigations */}
            {po.status === 'SUBMITTED_TO_HO' && isSupervisor && (
              <>
                {po.overallStockStatus === 'ALL_AVAILABLE' && (
                  <button
                    onClick={() => { setIsPartialApprove(false); setShowApproveAllocation(true); }}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-xl text-sm font-medium hover:bg-emerald-800 disabled:opacity-60 shadow-xs"
                  >
                    <CheckCircle size={14} /> Setujui PO (Review & Alokasi FIFO)
                  </button>
                )}

                {po.overallStockStatus === 'PARTIALLY_AVAILABLE' && (
                  <>
                    <button
                      onClick={() => { setIsPartialApprove(true); setShowApproveAllocation(true); }}
                      disabled={loading}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-xl text-sm font-medium hover:bg-emerald-800 disabled:opacity-60 shadow-xs"
                    >
                      <CheckCircle size={14} /> Setujui Sebagian (Alokasi Stok Ada)
                    </button>
                    <button
                      onClick={handleHoldForRestock}
                      disabled={loading}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 disabled:opacity-60 shadow-xs"
                    >
                      <Clock size={14} /> Tahan PO (Menunggu Restock)
                    </button>
                  </>
                )}

                {po.overallStockStatus === 'OUT_OF_STOCK' && (
                  <button
                    onClick={handleHoldForRestock}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 disabled:opacity-60 shadow-xs"
                  >
                    <Clock size={14} /> Tahan PO (Menunggu Restock HO)
                  </button>
                )}

                <button
                  onClick={handleReject}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-medium hover:bg-red-100 disabled:opacity-60"
                >
                  <XCircle size={14} /> Tolak PO
                </button>
              </>
            )}

            {/* SPV Actions for WAITING_RESTOCK */}
            {po.status === 'WAITING_RESTOCK' && isSupervisor && (
              <>
                <button
                  onClick={fetchDetail}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60 shadow-xs"
                >
                  <RefreshCw size={14} /> Cek Ketersediaan Stok Ulang
                </button>

                {po.overallStockStatus === 'ALL_AVAILABLE' && (
                  <button
                    onClick={() => { setIsPartialApprove(false); setShowApproveAllocation(true); }}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-xl text-sm font-medium hover:bg-emerald-800 disabled:opacity-60 shadow-xs"
                  >
                    <CheckCircle size={14} /> Setujui PO Sekarang (Alokasi FIFO)
                  </button>
                )}

                {po.overallStockStatus === 'PARTIALLY_AVAILABLE' && (
                  <button
                    onClick={() => { setIsPartialApprove(true); setShowApproveAllocation(true); }}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-xl text-sm font-medium hover:bg-emerald-800 disabled:opacity-60 shadow-xs"
                  >
                    <CheckCircle size={14} /> Setujui Sebagian (Stok Masuk)
                  </button>
                )}

                <button
                  onClick={handleReject}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-medium hover:bg-red-100 disabled:opacity-60"
                >
                  <XCircle size={14} /> Batalkan / Tolak PO
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

      {showApproveAllocation && (
        <HoApproveAllocationModal
          po={po}
          isPartial={isPartialApprove}
          onClose={() => setShowApproveAllocation(false)}
          onApproved={() => {
            setShowApproveAllocation(false);
            fetchDetail();
            onRefresh();
          }}
        />
      )}
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
    { label: 'Aktif', value: 'SUBMITTED_TO_HO,WAITING_RESTOCK,APPROVED_HO,PICKING' },
    { label: 'Masuk ke HO', value: 'SUBMITTED_TO_HO' },
    { label: 'Menunggu Restock', value: 'WAITING_RESTOCK' },
    { label: 'Disetujui', value: 'APPROVED_HO' },
    { label: 'Picking', value: 'PICKING' },
    { label: 'Dikirim', value: 'DISPATCHED,PARTIAL_HOLD' },
    { label: 'Selesai', value: 'RECEIVED' },
    { label: 'Semua', value: '' },
  ];

  // Stats
  const stats = [
    { label: 'Menunggu Approval', value: orders.filter((o) => o.status === 'SUBMITTED_TO_HO').length, color: 'text-blue-600' },
    { label: 'Menunggu Restock', value: orders.filter((o) => o.status === 'WAITING_RESTOCK').length, color: 'text-amber-600' },
    { label: 'Siap Picking', value: orders.filter((o) => o.status === 'APPROVED_HO').length, color: 'text-violet-600' },
    { label: 'Sedang Picking', value: orders.filter((o) => o.status === 'PICKING').length, color: 'text-emerald-600' },
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
