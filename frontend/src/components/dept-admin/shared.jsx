import { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X, ChevronRight } from 'lucide-react';

// ─── Status Badge ────────────────────────────────────────────────────────────

const STATUS_MAP = {
    pending:    { label: 'Pending',    cls: 'bg-slate-100 text-slate-600' },
    processing: { label: 'Processing', cls: 'bg-blue-100 text-blue-700' },
    done:       { label: 'Done',       cls: 'bg-green-100 text-green-700' },
    failed:     { label: 'Failed',     cls: 'bg-red-100 text-red-700' },
    skipped:    { label: 'Skipped',    cls: 'bg-amber-100 text-amber-700' },
};

export const Badge = ({ status }) => {
    const s = STATUS_MAP[status] || STATUS_MAP.pending;
    return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.cls}`}>{s.label}</span>;
};

// ─── Toast ───────────────────────────────────────────────────────────────────

export const Toast = ({ toast, onDismiss }) => {
    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(onDismiss, toast.type === 'success' ? 3000 : 5000);
        return () => clearTimeout(t);
    }, [toast, onDismiss]);

    if (!toast) return null;

    const isSuccess = toast.type === 'success';
    return (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-2 text-sm font-medium max-w-md ${
            isSuccess ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'
        }`}>
            {isSuccess ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {toast.message}
            <button onClick={onDismiss} className="ml-auto"><X size={14} /></button>
        </div>
    );
};

// ─── Step Indicator ──────────────────────────────────────────────────────────

export const StepIndicator = ({ steps, currentStep }) => (
    <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2">
        {steps.map((step, i) => (
            <div key={i} className="flex items-center">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${
                    i === currentStep ? 'bg-[#0A66C2] text-white'
                    : i < currentStep ? 'bg-green-100 text-green-700'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border border-current/20">
                        {i < currentStep ? '✓' : i + 1}
                    </span>
                    {step}
                </div>
                {i < steps.length - 1 && <ChevronRight size={14} className="text-slate-300 mx-1 shrink-0" />}
            </div>
        ))}
    </div>
);

// ─── Card ────────────────────────────────────────────────────────────────────

export const Card = ({ title, icon: Icon, children, className = '' }) => (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-6 ${className}`}>
        {title && (
            <div className="flex items-center gap-3 mb-4">
                {Icon && (
                    <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
                        <Icon size={18} className="text-indigo-600" />
                    </div>
                )}
                <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
            </div>
        )}
        {children}
    </div>
);

// ─── Navigation Buttons ──────────────────────────────────────────────────────

export const WizardNav = ({ onBack, onNext, backLabel = 'Back', nextLabel = 'Next', showBack = true, showNext = true }) => (
    <div className="flex gap-3 mt-4">
        {showBack && (
            <button onClick={onBack} className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-1">
                <ChevronRight size={14} className="rotate-180" />{backLabel}
            </button>
        )}
        {showNext && (
            <button onClick={onNext} className="px-5 py-2.5 bg-[#0A66C2] text-white rounded-xl text-sm font-semibold hover:bg-[#094d92] flex items-center gap-1">
                {nextLabel}<ChevronRight size={14} />
            </button>
        )}
    </div>
);

// ─── Group Name Mapper ───────────────────────────────────────────────────────

export function mapGroupName(oldName, oldCode, newCode) {
    return oldName.replace(new RegExp(`_${oldCode}`, 'gi'), `_${newCode.toLowerCase()}`);
}
