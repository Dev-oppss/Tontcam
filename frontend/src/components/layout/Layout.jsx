import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { Toast } from '../ui/Toast';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div
      className="app-shell flex h-screen overflow-hidden"
      style={{ '--content-offset': collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-w)' }}
    >
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto py-4 px-3 md:px-5">
          <div className="max-w-[1560px] mx-auto fade-up">
            <Outlet />
          </div>
        </main>
      </div>
      <Toast />
    </div>
  );
}
