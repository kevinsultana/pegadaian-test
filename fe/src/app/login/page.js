'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { showToast, alertError } from '@/lib/alerts';
import {
  ShieldCheck,
  Lock,
  User,
  AlertCircle,
  Loader2,
  Sparkles,
  Layers,
  ArrowRight,
  Eye,
  EyeOff
} from 'lucide-react';

export default function LoginPage() {
  const { user, login } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Password123!');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Quick switch role preset for demo / testing convenience
  const presets = [
    { label: 'Super Admin', u: 'admin', desc: 'Kelola Seluruh Master User, Lokasi, HO & Outlet' },
    { label: 'HO Supervisor', u: 'ho.spv', desc: 'Persetujuan PO & Konfigurasi Modular Lemari HO' },
    { label: 'HO Staff Vault', u: 'ho.staff', desc: 'Inbound Emas, Cetak QR Code & Picking' },
    { label: 'Outlet SPV', u: 'outlet.spv', desc: 'Permintaan PO & Approval Tebusan Outlet' },
    { label: 'Outlet Petugas RFID', u: 'outlet.petugas', desc: 'Scan RFID Mutasi & Tebusan Nasabah' },
  ];

  useEffect(() => {
    if (user) {
      if (user.role === 'SUPER_ADMIN') router.push('/admin/dashboard');
      else if (user.location?.type === 'HEAD_OFFICE' || user.role.startsWith('HO_')) router.push('/ho/dashboard');
      else router.push('/outlet/dashboard');
    }
  }, [user, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const toastId = showToast.loading('Memverifikasi kredensial login...');

    try {
      const res = await login(username, password);
      showToast.dismiss(toastId);
      showToast.success(`Selamat datang, ${res.user?.fullName || username}!`);
    } catch (err) {
      showToast.dismiss(toastId);
      const errMsg = err.message || 'Gagal masuk. Periksa username dan password.';
      setError(errMsg);
      showToast.error(errMsg);
      alertError('Autentikasi Gagal', errMsg);
    } finally {
      setLoading(false);
    }
  };

  const selectPreset = (presetUsername) => {
    setUsername(presetUsername);
    setPassword('Password123!');
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-8">
      <div className="max-w-md w-full">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-700 text-white shadow-md shadow-emerald-700/20 mb-4 ring-4 ring-emerald-50">
            <ShieldCheck className="w-9 h-9" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Pegadaian Smart Vault
          </h1>
          <p className="text-slate-500 text-sm mt-1.5 font-medium">
            Sistem Manajemen Vault Emas Terpusat HO & Outlet
          </p>
        </div>

        {/* Login Form Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm relative">
          {error && (
            <div className="mb-5 flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Username Akun
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username"
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-300 rounded-xl placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  className="w-full pl-11 pr-11 py-3 bg-white border border-slate-300 rounded-xl placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl shadow-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.99] disabled:opacity-50 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Memverifikasi Akses...</span>
                </>
              ) : (
                <>
                  <span>Masuk ke Smart Vault</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Role Picker */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-700 mb-3">
              <Sparkles className="w-4 h-4 text-emerald-700" />
              <span>Pilih Cepat Akun Demo (Seeded)</span>
            </div>
            <div className="space-y-2">
              {presets.map((p) => (
                <button
                  key={p.u}
                  type="button"
                  onClick={() => selectPreset(p.u)}
                  className={`w-full text-left p-2.5 rounded-xl border text-xs transition-colors flex items-center justify-between ${username === p.u
                      ? 'bg-emerald-50/80 border-emerald-300 text-slate-900'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                >
                  <div>
                    <div className="font-semibold text-slate-900">{p.label}</div>
                    <div className="text-[11px] text-slate-500">{p.desc}</div>
                  </div>
                  <span className="text-[10px] font-mono bg-white text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                    {p.u}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-xs text-slate-400">
          PT Pegadaian (Persero) &bull; Smart Vault Management &copy; 2026
        </div>
      </div>
    </div>
  );
}
