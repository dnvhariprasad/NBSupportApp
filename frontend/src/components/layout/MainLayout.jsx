import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const MainLayout = () => {
    return (
        <div className="bg-slate-50 min-h-screen font-sans text-slate-900">
            <Sidebar />
            <Topbar />
            <main className="pl-64 pt-16 min-h-screen">
                <div className="max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default MainLayout;
