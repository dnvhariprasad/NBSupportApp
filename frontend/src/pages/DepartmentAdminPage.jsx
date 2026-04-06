import { useState } from 'react';
import { Building2, FolderEdit, ArrowRightLeft } from 'lucide-react';
import { Toast } from '../components/dept-admin/shared';
import RenameWizard from '../components/dept-admin/RenameWizard';
import MergeWizard from '../components/dept-admin/MergeWizard';

const TABS = [
    { id: 'rename', label: 'Rename Department', icon: FolderEdit },
    { id: 'merge', label: 'Merge Departments', icon: ArrowRightLeft },
];

const DepartmentAdminPage = () => {
    const [activeTab, setActiveTab] = useState('rename');
    const [toast, setToast] = useState(null);

    return (
        <div className="p-6 space-y-6 bg-slate-50 min-h-full">
            <Toast toast={toast} onDismiss={() => setToast(null)} />

            <div>
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Building2 size={22} className="text-[#0A66C2]" /> Department Administration
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">Rename or merge HO departments and verticals</p>
            </div>

            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
                            activeTab === t.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}>
                        <t.icon size={15} />
                        {t.label}
                    </button>
                ))}
            </div>

            {activeTab === 'rename' && <RenameWizard onToast={setToast} />}
            {activeTab === 'merge' && <MergeWizard onToast={setToast} />}
        </div>
    );
};

export default DepartmentAdminPage;
