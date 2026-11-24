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
  Package,
  Truck,
  ArrowLeftRight,
  History,
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
  const userPerms = Array.isArray(user?.permissions) ? user.permissions : [];

  // Strict & dynamic check per-menu permission
  const hasPerm = (menuKey, legacyKey) => {
    if (isSuperAdmin) return true;
    if (userPerms.includes(menuKey)) return true;
    if (legacyKey && userPerms.includes(legacyKey)) return true;
    return false;
  };

  const menuSections = [
    // Super Admin / Master Section
    {
      title: 'SUPER ADMIN',
      items: [
        ...(hasPerm('MENU_ADMIN_DASHBOARD', 'DASHBOARD_ADMIN') ? [{ name: 'Dashboard Super Admin', href: '/admin/dashboard', icon: LayoutDashboard }] : []),
        ...(hasPerm('MENU_ADMIN_USERS', 'MASTER_USERS') ? [{ name: 'Master Pengguna (Users)', href: '/admin/users', icon: Users }] : []),
        ...(hasPerm('MENU_ADMIN_LOCATIONS', 'MASTER_LOCATIONS') ? [{ name: 'Master Unit & Lokasi', href: '/admin/locations', icon: MapPin }] : []),
        ...(hasPerm('MENU_ADMIN_ROLES', 'MASTER_ROLES') ? [{ name: 'Master Peran & Hak Akses', href: '/admin/roles', icon: KeyRound }] : []),
      ],
    },

    // Head Office (HO) Section
    {
      title: 'HEAD OFFICE (HO)',
      items: [
        ...(hasPerm('MENU_HO_DASHBOARD', 'DASHBOARD_HO') ? [{ name: 'Dashboard Vault HO', href: '/ho/dashboard', icon: Building2 }] : []),
        ...(hasPerm('MENU_HO_INBOUND', 'HO_INBOUND') ? [{ name: 'PO Inbound (Pengadaan)', href: '/ho/inbound', icon: Box }] : []),
        ...(hasPerm('MENU_HO_CABINETS', 'HO_CABINETS') ? [{ name: 'Lemari & Slot Modular', href: '/ho/cabinets', icon: Layers }] : []),
        ...(hasPerm('MENU_HO_INVENTORY', 'HO_INVENTORY') ? [{ name: 'Inventori & QR Emas', href: '/ho/inventory', icon: QrCode }] : []),
        ...(hasPerm('MENU_HO_ORDERS', 'HO_ORDERS') ? [{ name: 'PO Outlet & Picking Emas', href: '/ho/orders', icon: ShoppingCart }] : []),
        ...(hasPerm('MENU_HO_HISTORY', 'HO_HISTORY') ? [{ name: 'Lacak & Riwayat Emas', href: '/ho/history', icon: History }] : []),
      ],
    },

    // Outlet Section
    {
      title: 'OUTLET / CABANG',
      items: [
        ...(hasPerm('MENU_OUTLET_DASHBOARD', 'DASHBOARD_OUTLET') ? [{ name: 'Dashboard Outlet Hub', href: '/outlet/dashboard', icon: Radio }] : []),
        ...(hasPerm('MENU_OUTLET_INVENTORY', 'OUTLET_INVENTORY') ? [{ name: 'Inventori Emas Cabang', href: '/outlet/inventory', icon: Package }] : []),
        ...(hasPerm('MENU_OUTLET_CABINETS', 'OUTLET_CABINETS') ? [{ name: 'Lemari & Baki RFID', href: '/outlet/cabinets', icon: Layers }] : []),
        ...(hasPerm('MENU_OUTLET_ORDERS', 'OUTLET_ORDERS') ? [{ name: 'PO Inbound (Request ke HO)', href: '/outlet/orders', icon: ShoppingCart }] : []),
        ...(hasPerm('MENU_OUTLET_OUTBOUND', 'OUTLET_OUTBOUND') ? [{ name: 'PO Outbound & Mutasi Emas', href: '/outlet/outbound', icon: ArrowLeftRight }] : []),
        ...(hasPerm('MENU_OUTLET_HISTORY', 'OUTLET_HISTORY') ? [{ name: 'Lacak & Riwayat Emas', href: '/outlet/history', icon: History }] : []),
      ],
    },

    // System & Audit Section
    {
      title: 'SISTEM & AUDIT',
      items: [
        ...(hasPerm('MENU_AUDIT_LOG', 'AUDIT_LOG') ? [{ name: 'Audit Trail & Log', href: '/audit', icon: FileText }] : []),
      ],
    },
  ].filter((section) => section.items.length > 0);

  return (
    <div className="h-screen overflow-hidden bg-slate-50 text-slate-800 flex flex-col md:flex-row font-sans">
      {/* Sidebar - Individual Independent Scroll */}
      <aside className="w-full md:w-64 h-full bg-white border-r border-slate-200 flex flex-col shrink-0 shadow-[1px_0_4px_rgba(0,0,0,0.02)]">
        {/* Brand */}
        <div className="h-16 shrink-0 px-5 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold shadow-sm shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-tight text-slate-900 truncate">Pegadaian Vault</div>
            <div className="text-[11px] text-emerald-700 font-semibold truncate">Sistem Logam Mulia</div>
          </div>
        </div>

        {/* Navigation links with Section Dividers - Individual Independent Scroll */}
        <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto scrollbar-thin">
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
        <div className="p-3.5 border-t border-slate-100 shrink-0 bg-white">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-xs font-medium text-slate-600 transition-all shadow-xs"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar Sistem</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area - Individual Scroll */}
      <main className="flex-1 h-full flex flex-col min-w-0 bg-slate-50 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 shrink-0 border-b border-slate-200 bg-white px-6 flex items-center justify-between shadow-2xs z-10">
          {/* Left: Node Lokasi */}
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">Node Lokasi:</span>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              <span>{user?.location?.code || 'HO-CENTRAL'} &bull; {user?.location?.name || 'Head Office Sentral'}</span>
            </span>
          </div>

          {/* Right: Sistem Status & Petugas Aktif Profile */}
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-medium text-slate-600">Sistem Aktif & Terenkripsi</span>
            </div>

            <div className="hidden lg:block h-7 w-px bg-slate-200" />

            {/* Petugas Aktif Card on Navbar */}
            <div className="flex items-center gap-2.5 pl-1">
              <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0 uppercase">
                {(user?.fullName || user?.username || 'U').charAt(0)}
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-slate-900 leading-tight truncate max-w-37.5 sm:max-w-50">
                  {user?.fullName || user?.username || 'Petugas'}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                    {user?.role || 'GUEST'}
                  </span>
                  <span className="text-[10px] text-slate-400 hidden sm:flex items-center gap-0.5">
                    <MapPin className="w-2.5 h-2.5 text-slate-400" />
                    <span className="truncate max-w-30">{user?.location?.name || 'HO'}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content Page - Individual Independent Scroll */}
        <div className="p-6 md:p-8 flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
