'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { confirmAction, showToast } from '@/lib/alerts';
import {
  ShieldCheck,
  LayoutDashboard,
  Users,
  MapPin,
  Layers,
  QrCode,
  Radio,
  FileText,
  LogOut,
  Building2,
  Box,
  ShoppingCart,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';

export default function DashboardLayout({ children }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const handleLogout = async () => {
    const isConfirmed = await confirmAction(
      'Konfirmasi Keluar',
      'Apakah Anda yakin ingin keluar dari sistem Pegadaian Smart Vault?',
      'Ya, Keluar'
    );
    if (isConfirmed) {
      showToast.success('Anda berhasil keluar dari sistem');
      logout();
    }
  };

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isHO = user?.location?.type === 'HEAD_OFFICE' || user?.role?.startsWith('HO_');
  const userPerms = user?.permissions || [];
  const hasPerm = (perm) => isSuperAdmin || userPerms.includes(perm);

  const menuSections = [
    // Super Admin / Master Section
    {
      title: 'SUPER ADMIN',
      items: isSuperAdmin
        ? [
          { name: 'Dashboard Super Admin', href: '/admin/dashboard', icon: LayoutDashboard },
          { name: 'Master Pengguna (Users)', href: '/admin/users', icon: Users },
          { name: 'Master Unit & Lokasi', href: '/admin/locations', icon: MapPin },
          { name: 'Master Peran & Hak Akses', href: '/admin/roles', icon: KeyRound },
        ]
        : [
          ...(hasPerm('DASHBOARD_ADMIN') ? [{ name: 'Dashboard Admin', href: '/admin/dashboard', icon: LayoutDashboard }] : []),
          ...(hasPerm('MASTER_USERS') ? [{ name: 'Master Pengguna', href: '/admin/users', icon: Users }] : []),
          ...(hasPerm('MASTER_LOCATIONS') ? [{ name: 'Master Unit & Lokasi', href: '/admin/locations', icon: MapPin }] : []),
          ...(hasPerm('MASTER_ROLES') ? [{ name: 'Master Peran & Hak Akses', href: '/admin/roles', icon: KeyRound }] : []),
        ],
    },

    // Head Office (HO) Section
    {
      title: 'HEAD OFFICE (HO)',
      items: [
        ...((isSuperAdmin || hasPerm('DASHBOARD_HO') || isHO) ? [{ name: 'Dashboard Vault HO', href: '/ho/dashboard', icon: Building2 }] : []),
        ...((isSuperAdmin || hasPerm('HO_CABINETS') || isHO) ? [{ name: 'Lemari & Slot Modular', href: '/ho/cabinets', icon: Layers }] : []),
        ...((isSuperAdmin || hasPerm('HO_INVENTORY') || isHO) ? [{ name: 'Inventori & QR Emas', href: '/ho/inventory', icon: QrCode }] : []),
        ...((isSuperAdmin || hasPerm('HO_ORDERS') || isHO) ? [{ name: 'PO & Picking Emas', href: '/ho/orders', icon: ShoppingCart }] : []),
      ],
    },

    // Outlet Section
    {
      title: 'OUTLET / CABANG',
      items: [
        ...((isSuperAdmin || hasPerm('DASHBOARD_OUTLET') || !isHO) ? [{ name: 'Dashboard Outlet Hub', href: '/outlet/dashboard', icon: Radio }] : []),
        ...((isSuperAdmin || hasPerm('OUTLET_ORDERS') || (!isHO && user?.role !== 'SPI_AUDITOR')) ? [{ name: 'Request Emas ke HO', href: '/outlet/orders', icon: ShoppingCart }] : []),
      ],
    },

    // System & Audit Section
    {
      title: 'SISTEM & AUDIT',
      items: [
        ...((isSuperAdmin || hasPerm('AUDIT_LOG') || user?.role === 'SPI_AUDITOR' || user?.role === 'HO_SUPERVISOR' || user?.role === 'OUTLET_SUPERVISOR')
          ? [{ name: 'Audit Trail & Log', href: '/audit', icon: FileText }]
          : []),
      ],
    },
  ].filter((section) => section.items.length > 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col shadow-[1px_0_4px_rgba(0,0,0,0.02)]">
        {/* Brand */}
        <div className="p-5 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-slate-900">Pegadaian Vault</div>
            <div className="text-[11px] text-emerald-700 font-semibold">Sistem Manajemen Logam Mulia</div>
          </div>
        </div>

        {/* User Card */}
        <div className="p-3.5 mx-3 my-3 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Petugas Aktif</div>
          <div className="text-xs font-bold text-slate-900 truncate mt-0.5">{user?.fullName || 'Petugas'}</div>
          <div className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-800 rounded-md border border-emerald-200/70">
            {user?.role || 'GUEST'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1.5">
            <MapPin className="w-3 h-3 text-slate-400" />
            <span className="truncate">{user?.location?.name || 'Head Office Central'}</span>
          </div>
        </div>

        {/* Navigation links with Section Dividers */}
        <nav className="flex-1 px-3 py-1 space-y-4 overflow-y-auto">
          {menuSections.map((section, idx) => (
            <div key={section.title} className="space-y-1">
              {/* Divider & Section Title */}
              <div className={`px-2 flex items-center gap-2 ${idx > 0 ? 'pt-2' : 'pt-0'} pb-1`}>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {section.title}
                </span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Section Items */}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'));
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${active
                          ? 'bg-emerald-700 text-white font-semibold shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                        }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Logout button */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-xs font-medium text-slate-600 transition-all shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar Sistem</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50">
        <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-slate-500 font-medium">Node Lokasi:</span>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              {user?.location?.code || 'HO-CENTRAL'} &bull; {user?.location?.name || 'Head Office Sentral'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="font-medium text-slate-600">Sistem Aktif & Terenkripsi</span>
            </div>
          </div>
        </header>

        <div className="p-6 md:p-8 flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
