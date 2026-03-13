import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { documentsApi, scoresApi, usersApi } from '../services/api';
import { Document as DocType, Score, User } from '../types';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { TabView, TabPanel } from 'primereact/tabview';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import { Chart } from 'primereact/chart';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Play, Download, TrendingUp, FileCheck, MessageSquare, Eye } from 'lucide-react';
import Papa from 'papaparse';
import { downloadDocumentPdf } from '../utils/exportUtils';

interface Props {
    defaultTab?: 'dashboard' | 'assigned';
}

export default function ReviewerDashboard({ defaultTab = 'dashboard' }: Props) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState(defaultTab === 'assigned' ? 1 : 0);

    // Sync tab when navigating via notification or URL change
    useEffect(() => {
        if (location.pathname.includes('/assigned')) {
            setActiveTab(1);
        } else if (location.pathname === '/reviewer') {
            setActiveTab(0);
        }
    }, [location.pathname]);
    const [documents, setDocuments] = useState<DocType[]>([]);
    const [scores, setScores] = useState<Score[]>([]);
    const [designers, setDesigners] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [designerFilter, setDesignerFilter] = useState<string | null>(null);
    const [timeFilter, setTimeFilter] = useState<string>('all');
    const [customDateRange, setCustomDateRange] = useState<Date[] | null>(null);
    const [showExportDialog, setShowExportDialog] = useState(false);
    const [downloadingId, setDownloadingId] = useState('');

    useEffect(() => {
        if (user) { loadData(); }
    }, [user]);

    const loadData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [docs, scoreData, designerData] = await Promise.all([
                documentsApi.getByReviewer(user.id),
                scoresApi.getByReviewer(user.id),
                usersApi.getDesigners(),
            ]);
            setDocuments(docs);
            setScores(scoreData);
            setDesigners(designerData);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const filteredDocs = documents.filter(d => {
        let keep = true;
        if (designerFilter) {
            keep = keep && d.designer_id === designerFilter;
        }
        if (timeFilter !== 'all') {
            const dDate = new Date(d.created_at || Date.now());
            const now = new Date();
            if (timeFilter === 'week') keep = keep && dDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            if (timeFilter === 'month') keep = keep && dDate.getMonth() === now.getMonth() && dDate.getFullYear() === now.getFullYear();
            if (timeFilter === 'year') keep = keep && dDate.getFullYear() === now.getFullYear();
            if (timeFilter === 'custom' && customDateRange && customDateRange[0] && customDateRange[1]) {
                const end = new Date(customDateRange[1]);
                end.setHours(23, 59, 59, 999);
                keep = keep && dDate >= customDateRange[0] && dDate <= end;
            }
        }
        return keep;
    });

    const assignedDocs = filteredDocs.filter(d => ['pending', 'in_review'].includes(d.status));
    const completedDocs = filteredDocs.filter(d => ['reviewed', 'completed'].includes(d.status));

    // Dashboard metrics — filter scores locally by designer + time
    const designerFilteredScores = designerFilter ? scores.filter(s => s.designer_id === designerFilter) : scores;
    const filteredScores = filterByTime(designerFilteredScores, timeFilter, customDateRange);
    const avgScore = filteredScores.length > 0 ? (filteredScores.reduce((a, s) => a + s.composite_score, 0) / filteredScores.length) : 0;
    const totalReviewed = filteredScores.length;
    const totalComments = 0; // Would need annotation count per doc — future enhancement

    // Chart data
    const chartLabels = filteredScores.map(s => s.designer_name || 'Unknown').slice(-10);
    const chartData = {
        labels: chartLabels,
        datasets: [{
            label: 'Composite Score',
            data: filteredScores.map(s => s.composite_score).slice(-10),
            backgroundColor: '#818cf8',
            borderColor: '#4f46e5',
            borderWidth: 2,
            borderRadius: 6,
            barThickness: 24,
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            y: { beginAtZero: true, max: 120, grid: { color: '#f1f5f9' } },
            x: { grid: { display: false }, ticks: { maxRotation: 45 } },
        }
    };

    const handleStartReview = async (doc: DocType) => {
        try {
            await documentsApi.updateStatus(doc.id, 'in_review');
            navigate(`/reviewer/review/${doc.id}`);
        } catch (e) { console.error(e); }
    };

    const handleReopenFile = async (doc: DocType) => {
        try {
            await documentsApi.updateStatus(doc.id, 'in_review');
            navigate(`/reviewer/review/${doc.id}`);
        } catch (e) { console.error(e); }
    };

    const handleDownloadPdf = async (doc: DocType) => {
        try {
            setDownloadingId(doc.id);
            await downloadDocumentPdf(doc);
        } catch (err: any) {
            alert('Failed to download PDF: ' + err.message);
        } finally {
            setDownloadingId('');
        }
    };

    const handleExportCSV = () => {
        const data = filteredScores.map(s => ({
            'Document': s.title,
            'Job ID': s.job_id,
            'Designer': s.designer_name,
            'Quality': s.quality,
            'Complexity': s.complexity,
            'FTP Band': s.ftp,
            'Design': s.design,
            'Repeat Offence': s.repeat_offence,
            'Composite Score': s.composite_score.toFixed(2),
            'Date': s.created_at,
        }));
        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'review_scores_export.csv';
        link.click();
        URL.revokeObjectURL(link.href);
        setShowExportDialog(false);
    };

    const statusTemplate = (rowData: DocType) => {
        const map: Record<string, 'info' | 'warning' | 'success'> = {
            pending: 'warning', in_review: 'info', reviewed: 'success', completed: 'success'
        };
        return <Tag value={rowData.status.replace('_', ' ')} severity={map[rowData.status] || 'info'} className="capitalize text-xs" />;
    };

    const designerOptions = [{ label: 'All Designers', value: null as any }, ...designers.map(d => ({ label: d.name, value: d.id }))];
    const timeOptions = [
        { label: 'All Time', value: 'all' },
        { label: 'This Week', value: 'week' },
        { label: 'This Month', value: 'month' },
        { label: 'This Year', value: 'year' },
        { label: 'Custom Range', value: 'custom' },
    ];

    const tabHeaderTemplate = (title: string, icon: string, index: number) => (options: any) => {
        return (
            <button onClick={options.onClick} className={`flex items-center gap-2 px-6 py-4 font-semibold text-sm transition-all border-b-2 outline-none cursor-pointer ${activeTab === index ? 'border-brand-600 text-brand-700 bg-white shadow-sm' : 'border-transparent text-surface-500 hover:text-surface-800 hover:bg-surface-100/50'}`}>
                <i className={icon}></i>
                <span>{title}</span>
            </button>
        );
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-surface-800">Reviewer Dashboard</h1>
                    <p className="text-sm text-surface-500 mt-1">Review assigned files and track performance</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-card border border-surface-200 overflow-hidden">
                <TabView activeIndex={activeTab} onTabChange={e => setActiveTab(e.index)} pt={{
                    nav: { className: 'bg-surface-50 border-b border-surface-200 flex' }
                }}>
                    {/* Dashboard Tab */}
                    <TabPanel headerTemplate={tabHeaderTemplate('Dashboard', 'pi pi-chart-bar mr-2', 0)}>
                        <div className="space-y-6">
                            {/* Filters Top Bar */}
                            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                                <Dropdown 
                                    value={designerFilter} 
                                    options={designerOptions} 
                                    onChange={e => setDesignerFilter(e.value)} 
                                    placeholder="All Designers" 
                                    className="w-48 text-sm h-[38px] flex items-center" 
                                />
                                <Dropdown 
                                    value={timeFilter} 
                                    options={timeOptions} 
                                    onChange={e => setTimeFilter(e.value)} 
                                    className="w-40 text-sm h-[38px] flex items-center" 
                                />
                                {timeFilter === 'custom' && (
                                    <Calendar
                                        value={customDateRange}
                                        onChange={(e) => setCustomDateRange(e.value as Date[])}
                                        selectionMode="range"
                                        readOnlyInput
                                        hideOnRangeSelection
                                        placeholder="Select Date Range"
                                        className="h-[38px] w-60 text-sm"
                                        inputClassName="text-sm h-[38px] px-3 py-2 border border-surface-300 rounded-lg"
                                    />
                                )}
                                <button onClick={handleExportCSV} disabled={filteredScores.length === 0} className="flex items-center gap-2 px-4 py-2 h-[38px] text-sm font-medium text-white bg-brand-600 border border-brand-600 rounded-lg hover:bg-brand-700 transition-colors shadow-sm disabled:opacity-50">
                                    <Download size={16} /> Export CSV
                                </button>
                            </div>

                            {/* Stat Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-gradient-to-br from-brand-50 to-brand-100 rounded-xl p-5 border border-brand-200">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 bg-brand-600 rounded-lg flex items-center justify-center"><TrendingUp size={20} className="text-white" /></div>
                                        <div>
                                            <p className="text-xs text-brand-600 font-medium uppercase">Avg Score</p>
                                            <p className="text-2xl font-bold text-brand-800">{avgScore.toFixed(1)}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gradient-to-br from-success-light to-green-100 rounded-xl p-5 border border-green-200">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 bg-success rounded-lg flex items-center justify-center"><FileCheck size={20} className="text-white" /></div>
                                        <div>
                                            <p className="text-xs text-green-700 font-medium uppercase">Total Reviewed</p>
                                            <p className="text-2xl font-bold text-green-800">{totalReviewed}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gradient-to-br from-warning-light to-amber-100 rounded-xl p-5 border border-amber-200">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 bg-warning rounded-lg flex items-center justify-center"><MessageSquare size={20} className="text-white" /></div>
                                        <div>
                                            <p className="text-xs text-amber-700 font-medium uppercase">Pending Reviews</p>
                                            <p className="text-2xl font-bold text-amber-800">{assignedDocs.length}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Chart */}
                            <div className="bg-surface-50 rounded-xl p-5 border border-surface-200">
                                <h3 className="text-sm font-semibold text-surface-700 mb-4">Review Scores (Last 10)</h3>
                                <div style={{ height: '280px' }}>
                                    {filteredScores.length > 0 ? (
                                        <Chart type="bar" data={chartData} options={chartOptions} />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-surface-400 text-sm">No score data available</div>
                                    )}
                                </div>
                            </div>

                            {/* Scores Table */}
                            <DataTable value={filteredScores} paginator rows={10} emptyMessage="No scores yet" stripedRows rowHover className="text-sm">
                                <Column field="title" header="Document" sortable />
                                <Column field="designer_name" header="Designer" sortable />
                                <Column field="quality" header="Quality" sortable />
                                <Column field="composite_score" header="Score" sortable body={(r: Score) => <span className="font-semibold">{r.composite_score.toFixed(2)}</span>} />
                                <Column field="created_at" header="Date" sortable body={(r: Score) => new Date(r.created_at).toLocaleDateString()} />
                            </DataTable>
                        </div>
                    </TabPanel>

                    {/* Assigned Files Tab */}
                    <TabPanel headerTemplate={tabHeaderTemplate('Assigned Files', 'pi pi-file mr-2', 1)}>
                        <DataTable value={assignedDocs} loading={loading} paginator rows={10} emptyMessage="No files assigned for review" stripedRows rowHover className="text-sm">
                            <Column field="title" header="File Name" sortable />
                            <Column field="job_id" header="Job ID" sortable />
                            <Column field="designer_name" header="Designer" sortable />
                            <Column field="deliverable_type" header="Type" sortable className="capitalize" />
                            <Column field="status" header="Status" body={statusTemplate} sortable />
                            <Column header="Action" body={(rowData: DocType) => (
                                <button
                                    onClick={() => handleStartReview(rowData)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                                >
                                    <Play size={14} /> {rowData.status === 'in_review' ? 'Continue Review' : 'Start Review'}
                                </button>
                            )} />
                        </DataTable>
                    </TabPanel>

                    {/* Completed Files Tab */}
                    <TabPanel headerTemplate={tabHeaderTemplate('Completed Files', 'pi pi-check-circle mr-2', 2)}>
                        <DataTable value={completedDocs} loading={loading} paginator rows={10} emptyMessage="No completed files" stripedRows rowHover className="text-sm">
                            <Column field="title" header="File Name" sortable />
                            <Column field="job_id" header="Job ID" sortable />
                            <Column field="designer_name" header="Designer" sortable />
                            <Column field="deliverable_type" header="Type" sortable className="capitalize" />
                            <Column field="status" header="Status" body={statusTemplate} sortable />
                            <Column header="Action" body={(rowData: DocType) => (
                                <div className="flex items-center gap-2">
                                    <button onClick={() => navigate(`/reviewer/view/${rowData.id}`)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-surface-300 text-surface-700 rounded hover:bg-surface-50 transition-colors" title="View">
                                        <Eye size={14} /> View
                                    </button>
                                    <button onClick={() => handleDownloadPdf(rowData)} disabled={downloadingId === rowData.id} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-brand-300 text-brand-700 rounded hover:bg-brand-50 transition-colors disabled:opacity-50" title="Save as PDF">
                                        {downloadingId === rowData.id ? <i className="pi pi-spin pi-spinner text-[14px]" /> : <Download size={14} />} PDF
                                    </button>
                                    <button onClick={() => handleReopenFile(rowData)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand-600 text-white rounded hover:bg-brand-700 transition-colors">
                                        <MessageSquare size={14} /> Reopen
                                    </button>
                                </div>
                            )} />
                        </DataTable>
                    </TabPanel>
                </TabView>
            </div>

            {/* Export CSV Dialog Replaced Since It was Moved to Dashboard Header (Intentionally empty placeholder) */}
        </div>
    );
}

function filterByTime(scores: Score[], period: string, customRange?: Date[] | null): Score[] {
    if (period === 'all') return scores;
    const now = new Date();
    return scores.filter(s => {
        const d = new Date(s.created_at);
        if (period === 'week') {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return d >= weekAgo;
        }
        if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        if (period === 'year') return d.getFullYear() === now.getFullYear();
        if (period === 'custom' && customRange && customRange[0] && customRange[1]) {
            const end = new Date(customRange[1]);
            end.setHours(23, 59, 59, 999);
            return d >= customRange[0] && d <= end;
        }
        return true;
    });
}
