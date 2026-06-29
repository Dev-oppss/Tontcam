import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { Toast } from '../ui/Toast';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="app-shell flex min-h-screen overflow-hidden bg-[linear-gradient(180deg,_rgba(251,246,238,0.96)_0%,_rgba(241,231,218,0.92)_100%)]">
      <div className="pointer-events-none absolute inset-0 opacity-[.10] surface-pattern" />
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto py-6 px-4 md:px-6">
          <div className="max-w-[1480px] mx-auto fade-up">
            <Outlet />
          </div>
        </main>
      </div>
      <Toast />
    </div>
  );
}
