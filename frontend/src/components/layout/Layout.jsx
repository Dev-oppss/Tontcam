import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { Toast } from '../ui/Toast';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(59,110,165,0.12),_transparent_30%),_linear-gradient(180deg,_#f8fafc_0%,_#eef4fb_100%)]">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto py-6 px-4 md:px-6 mesh-bg">
          <div className="max-w-[1480px] mx-auto fade-up">
            <Outlet />
          </div>
        </main>
      </div>
      <Toast />
    </div>
  );
}
