'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (user.role === 'SUPER_ADMIN') {
        router.push('/admin/dashboard');
      } else if (user.location?.type === 'HEAD_OFFICE' || user.role.startsWith('HO_')) {
        router.push('/ho/dashboard');
      } else {
        router.push('/outlet/dashboard');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-700" />
        <p className="text-sm text-slate-500">Memuat Pegadaian Smart Vault...</p>
      </div>
    </div>
  );
}
