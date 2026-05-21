import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    FileBarChart2, Filter, X, Search, ChevronLeft, ChevronRight,
    ChevronsLeft, FileText, ClipboardList, Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import axios from '../api/axios';
import { getLocations, fetchDepartments } from '../data/nabardMetadata';
import { CaseDetailsModal, MovementRegisterModal } from './DelegatePage';

const STATUS_OPTIONS   = ['In-Progress', 'Approved', 'Closed', 'Cancelled'];
const PRIORITY_OPTIONS = ['Ordinary', 'Urgent'];
const LANGUAGE_OPTIONS = ['Bilingual', 'English', 'Hindi', 'Others'];

const ReportsPage = () => {
    // ── Filter state ──────────────────────────────────────────────────────────
    const [officeType,   setOfficeType]   = useState('');
    const [location,     setLocation]     = useState('');
    const [deptName,     setDeptName]     = useState('');
    const [departments,  setDepartments]  = useState([]);
    const [fromDate,     setFromDate]     = useState('');
    const [toDate,       setToDate]       = useState('');
    const [statusFilter,   setStatusFilter]   = useState('');
    const [priorityFilter, setPriorityFilter] = useState('');
    const [languageFilter, setLanguageFilter] = useState('');

    // ── Results state ─────────────────────────────────────────────────────────
    const [cases,          setCases]          = useState([]);
    const [allCases,       setAllCases]       = useState([]); // holds full export dataset
    const [loading,        setLoading]        = useState(false);
    const [exporting,      setExporting]      = useState(false);
    const [page,           setPage]           = useState(1);
    const [pageSize,       setPageSize]       = useState(10);
    const [hasNextPage,    setHasNextPage]    = useState(false);
    const [filtersApplied, setFiltersApplied] = useState(false);
    const [error,          setError]          = useState('');

    // ── Modal state ───────────────────────────────────────────────────────────
    const [detailCase,   setDetailCase]   = useState(null);
    const [movementCase, setMovementCase] = useState(null);

    // ── Derived ───────────────────────────────────────────────────────────────
    const locations      = useMemo(() => getLocations(officeType), [officeType]);
    const isRoTe         = officeType === 'RO' || officeType === 'TE';
    const locationShortCode = useMemo(
        () => locations.find(l => l.location === location)?.shortCode || '',
        [locations, location]
    );

    useEffect(() => {
        setDeptName('');
        setDepartments([]);
        if (!officeType) return;
        if (isRoTe && !location) return;
        fetchDepartments(officeType, isRoTe ? location : '').then(setDepartments);
    }, [officeType, location, isRoTe]);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleOfficeTypeChange = (val) => {
        setOfficeType(val);
        setLocation('');
        setDeptName('');
        setDepartments([]);
    };

    const handleLocationChange = (val) => {
        setLocation(val);
        setDeptName('');
        setDepartments([]);
    };

    const buildParams = useCallback(() => {
        const p = {};
        if (officeType)            p.hoRo     = officeType;
        if (isRoTe && location)    p.location = location;
        if (deptName)              p.deptNames = deptName;
        if (fromDate)              p.fromDate = fromDate;
        if (toDate)                p.toDate   = toDate;
        if (statusFilter)          p.status   = statusFilter;
        if (priorityFilter)        p.priority = priorityFilter;
        if (languageFilter)        p.language = languageFilter;
        return p;
    }, [officeType, isRoTe, location, deptName, fromDate, toDate,
        statusFilter, priorityFilter, languageFilter]);

    const fetchReport = useCallback(async (pageNum, size) => {
        setLoading(true);
        setError('');
        try {
            const { data } = await axios.get('/cases/report', {
                params: { ...buildParams(), page: pageNum, size }
            });
            setCases(data.cases || []);
            setHasNextPage(data.hasNext || false);
            setFiltersApplied(true);
            setPage(pageNum);
        } catch {
            setError('Failed to load report. Please try again.');
            setCases([]);
        } finally {
            setLoading(false);
        }
    }, [buildParams]);

    const handleApply = () => fetchReport(1, pageSize);

    const handleClear = () => {
        setOfficeType(''); setLocation(''); setDeptName(''); setDepartments([]);
        setFromDate(''); setToDate('');
        setStatusFilter(''); setPriorityFilter(''); setLanguageFilter('');
        setCases([]); setAllCases([]);
        setFiltersApplied(false); setError(''); setPage(1);
    };

    const handlePageSizeChange = (newSize) => {
        setPageSize(newSize);
        fetchReport(1, newSize);
    };

    // ── Export ────────────────────────────────────────────────────────────────
    const fetchAllForExport = async () => {
        setExporting(true);
        try {
            // Fetch up to 1000 records for export (single large page)
            const { data } = await axios.get('/cases/report', {
                params: { ...buildParams(), page: 1, size: 1000 }
            });
            return data.cases || [];
        } catch {
            return [];
        } finally {
            setExporting(false);
        }
    };

    const exportToCSV = async () => {
        const rows = await fetchAllForExport();
        if (!rows.length) return;
        const cols = ['object_name', 'description', 'ho_ro', 'department_name',
                      'status', 'task_priority', 'language_type', 'r_creation_date',
                      'r_creator_name', 'case_nature', 'disposal_level', 'file_number',
                      'types', 'functions'];
        const headers = ['Case Number', 'Description', 'Office Type', 'Department',
                         'Status', 'Priority', 'Language', 'Date Created',
                         'Created By', 'Case Nature', 'Disposal Level', 'File No',
                         'Types', 'Functions'];
        const csvRows = [headers.join(',')];
        rows.forEach(r => {
            csvRows.push(cols.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','));
        });
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `cases_report_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const exportToExcel = async () => {
        const rows = await fetchAllForExport();
        if (!rows.length) return;
        const sheetData = rows.map((r, i) => ({
            '#':               i + 1,
            'Case Number':     r.object_name      ?? '',
            'Description':     r.description      ?? '',
            'Office Type':     r.ho_ro            ?? '',
            'Department':      r.department_name  ?? '',
            'Status':          r.status           ?? '',
            'Priority':        r.task_priority    ?? '',
            'Language':        r.language_type    ?? '',
            'Date Created':    r.r_creation_date  ?? '',
            'Created By':      r.r_creator_name   ?? '',
            'Case Nature':     r.case_nature      ?? '',
            'Disposal Level':  r.disposal_level   ?? '',
            'File No':         r.file_number      ?? '',
            'Types':           r.types            ?? '',
            'Functions':       r.functions        ?? '',
        }));
        const ws = XLSX.utils.json_to_sheet(sheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Cases Report');
        XLSX.writeFile(wb, `cases_report_${new Date().toISOString().slice(0,10)}.xlsx`);
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    const formatDate = (d) => {
        if (!d) return '-';
        try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
        catch { return d; }
    };

    const selectCls = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="p-6"
        >
            {/* Header */}
            <div className="mb-6 flex items-center gap-3">
                <div className="w-10 h-10 bg-[#0A66C2] rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <FileBarChart2 className="text-white" size={20} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
                    <p className="text-sm text-slate-500">Generate case reports with custom filters</p>
                </div>
            </div>

            {/* Tab Bar */}
            <div className="border-b border-slate-200 mb-6">
                <button className="px-4 py-2 text-sm font-semibold border-b-2 border-[#0A66C2] text-[#0A66C2]">
                    Cases Report
                </button>
            </div>

            {/* Filter Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <Filter size={16} className="text-slate-500" />
                    <span className="text-sm font-semibold text-slate-700">Filters</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-4">
                    {/* Office Type */}
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Office Type</label>
                        <select value={officeType} onChange={e => handleOfficeTypeChange(e.target.value)} className={selectCls}>
                            <option value="">All</option>
                            <option value="HO">HO</option>
                            <option value="RO">RO</option>
                            <option value="TE">TE</option>
                        </select>
                    </div>

                    {/* Location — RO/TE only */}
                    {isRoTe && (
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Location</label>
                            <select value={location} onChange={e => handleLocationChange(e.target.value)} className={selectCls}>
                                <option value="">All Locations</option>
                                {locations.map(l => <option key={l.shortCode} value={l.location}>{l.location}</option>)}
                            </select>
                        </div>
                    )}

                    {/* Department */}
                    {officeType && departments.length > 0 && (!isRoTe || location) && (
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Department</label>
                            <select value={deptName} onChange={e => setDeptName(e.target.value)} className={selectCls}>
                                <option value="">All Departments</option>
                                {departments.map(d => <option key={d.shortCode} value={d.name}>{d.name}</option>)}
                            </select>
                        </div>
                    )}

                    {/* From Date */}
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">From Date</label>
                        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                            className={selectCls} />
                    </div>

                    {/* To Date */}
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">To Date</label>
                        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                            className={selectCls} />
                    </div>

                    {/* Status */}
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectCls}>
                            <option value="">All Status</option>
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    {/* Priority */}
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
                        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className={selectCls}>
                            <option value="">All Priority</option>
                            {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>

                    {/* Language */}
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Language</label>
                        <select value={languageFilter} onChange={e => setLanguageFilter(e.target.value)} className={selectCls}>
                            <option value="">All Languages</option>
                            {LANGUAGE_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={handleApply} disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-[#0A66C2] text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                        <Search size={14} />
                        Apply Filters
                    </button>
                    <button onClick={handleClear} disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
                        <X size={14} />
                        Clear
                    </button>

                    {/* Export buttons — only visible after results are loaded */}
                    {filtersApplied && cases.length > 0 && (
                        <div className="ml-auto">
                            <button onClick={exportToExcel} disabled={exporting}
                                className="flex items-center gap-1.5 px-3 py-2 border border-emerald-200 text-emerald-700 bg-emerald-50 text-sm font-medium rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50">
                                <Download size={13} />
                                Export Excel
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Results Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {!filtersApplied && !loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <FileBarChart2 size={48} className="mb-3 opacity-30" />
                        <p className="text-sm">Apply filters to view the report</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-10">#</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Case Number</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Office / Dept</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Priority</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date Created</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                {Array.from({ length: 8 }).map((__, j) => (
                                                    <td key={j} className="px-4 py-3">
                                                        <div className="h-3 bg-slate-200 rounded w-full" />
                                                    </td>
                                                ))}
                                            </tr>
                                        ))
                                    ) : cases.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-4 py-16 text-center text-slate-400 text-sm">
                                                No cases found for the selected filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        cases.map((c, idx) => (
                                            <tr key={c.r_object_id || idx} className="hover:bg-blue-50/30 transition-colors group">
                                                <td className="px-4 py-2.5 text-slate-400 text-xs">
                                                    {(page - 1) * pageSize + idx + 1}
                                                </td>
                                                <td className="px-4 py-2.5 font-medium text-slate-900">{c.object_name}</td>
                                                <td className="px-4 py-2.5 text-slate-500 max-w-[200px] truncate" title={c.description}>
                                                    {c.description || c.subject || '-'}
                                                </td>
                                                <td className="px-4 py-2.5 text-slate-600">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{c.ho_ro}</span>
                                                        {c.department_name && <span className="text-xs text-slate-400">{c.department_name}</span>}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    {c.status ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                                            {c.status}
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                <td className="px-4 py-2.5 text-slate-600 text-xs">{c.task_priority || '-'}</td>
                                                <td className="px-4 py-2.5 text-slate-600 text-xs">{formatDate(c.r_creation_date)}</td>
                                                <td className="px-4 py-2.5">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button onClick={() => setDetailCase(c)} title="Case Details"
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#0A66C2] hover:bg-blue-50 transition-all">
                                                            <FileText size={15} />
                                                        </button>
                                                        <button onClick={() => setMovementCase(c)} title="Movement Register"
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all">
                                                            <ClipboardList size={15} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {filtersApplied && !loading && cases.length > 0 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <span>Rows per page:</span>
                                    <select value={pageSize} onChange={e => handlePageSizeChange(Number(e.target.value))}
                                        className="border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                                        {[5, 10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => fetchReport(1, pageSize)} disabled={page === 1}
                                        className="p-1.5 border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-600">
                                        <ChevronsLeft size={16} />
                                    </button>
                                    <button onClick={() => fetchReport(page - 1, pageSize)} disabled={page === 1}
                                        className="p-1.5 border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-600">
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="px-3 py-1 bg-white border border-slate-200 rounded text-slate-700 font-medium min-w-[2rem] text-center">
                                        {page}
                                    </span>
                                    <button onClick={() => fetchReport(page + 1, pageSize)} disabled={!hasNextPage}
                                        className="p-1.5 border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-600">
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {error && (
                    <div className="px-4 py-3 bg-red-50 text-red-600 text-sm border-t border-red-100">{error}</div>
                )}
            </div>

            {/* Modals */}
            {detailCase   && <CaseDetailsModal      caseItem={detailCase}   onClose={() => setDetailCase(null)}   />}
            {movementCase && <MovementRegisterModal  caseItem={movementCase} onClose={() => setMovementCase(null)} />}
        </motion.div>
    );
};

export default ReportsPage;
