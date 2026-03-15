import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { Review, ReviewScore } from '../types';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { TabView, TabPanel } from 'primereact/tabview';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import { Chart } from 'primereact/chart';
import { Download, TrendingUp, FileCheck, MessageSquare, Eye, Play, Mail } from 'lucide-react';
import Papa from 'papaparse';

export default function ReviewerDashboard() {
    const storeData = useStore();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState(0);

    const [designerFilter, setDesignerFilter] = useState<string>('all');
    const [timeFilter, setTimeFilter] = useState<string>('all');
    const [customDateRange, setCustomDateRange] = useState<Date[] | null>(null);

    const reviews = storeData.reviews;

    // Get unique designers
    const designers = [...new Set(reviews.map(r => r.designer_name))].filter(Boolean);

    // Filter reviews
    const filteredReviews = reviews.filter(r => {
        let keep = true;
        if (designerFilter && designerFilter !== 'all') {
            keep = keep && r.designer_name === designerFilter;
        }
        if (timeFilter !== 'all') {
            const dDate = new Date(r.created_at || Date.now());
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

    const inProgressReviews = filteredReviews.filter(r => r.status === 'in_progress');
    const completedReviews = filteredReviews.filter(r => r.status === 'reviewed');

    // Dashboard metrics from completed reviews
    const scoredReviews = completedReviews.filter(r => r.score);
    const avgScore = scoredReviews.length > 0 ? (scoredReviews.reduce((a, r) => a + (r.score?.composite_score || 0), 0) / scoredReviews.length) : 0;
    const totalReviewed = scoredReviews.length;

    // Chart data
    const chartLabels = scoredReviews.map(r => r.designer_name || 'Unknown').slice(-10);
    const chartData = {
        labels: chartLabels,
        datasets: [{
            label: 'Composite Score',
            data: scoredReviews.map(r => r.score?.composite_score || 0).slice(-10),
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

    const handleExportCSV = () => {
        const data = scoredReviews.map(r => ({
            'Document': r.title,
            'Job ID': r.job_id,
            'Designer': r.designer_name,
            'Quality': r.score?.quality,
            'Complexity': r.score?.complexity,
            'FTP Band': r.score?.ftp,
            'Design': r.score?.design,
            'Repeat Offence': r.score?.repeat_offence,
            'Composite Score': r.score?.composite_score.toFixed(2),
            'Date': r.created_at,
        }));
        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'review_scores_export.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const statusTemplate = (rowData: Review) => {
        const map: Record<string, 'info' | 'warning' | 'success'> = {
            in_progress: 'info', reviewed: 'success',
        };
        return <Tag value={rowData.status.replace('_', ' ')} severity={map[rowData.status] || 'info'} className="capitalize text-xs" />;
    };

    const designerOptions = [{ label: 'All Designers', value: 'all' }, ...designers.map(d => ({ label: d, value: d }))];
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
                    <p className="text-sm text-surface-500 mt-1">Review files and track performance</p>
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
                                <button onClick={handleExportCSV} disabled={scoredReviews.length === 0} className="flex items-center gap-2 px-4 py-2 h-[38px] text-sm font-medium text-white bg-brand-600 border border-brand-600 rounded-lg hover:bg-brand-700 transition-colors shadow-sm disabled:opacity-50">
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
                                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 border border-green-200">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center"><FileCheck size={20} className="text-white" /></div>
                                        <div>
                                            <p className="text-xs text-green-700 font-medium uppercase">Total Reviewed</p>
                                            <p className="text-2xl font-bold text-green-800">{totalReviewed}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-5 border border-amber-200">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center"><MessageSquare size={20} className="text-white" /></div>
                                        <div>
                                            <p className="text-xs text-amber-700 font-medium uppercase">In Progress</p>
                                            <p className="text-2xl font-bold text-amber-800">{inProgressReviews.length}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Chart */}
                            <div className="bg-surface-50 rounded-xl p-5 border border-surface-200">
                                <h3 className="text-sm font-semibold text-surface-700 mb-4">Review Scores (Last 10)</h3>
                                <div style={{ height: '280px' }}>
                                    {scoredReviews.length > 0 ? (
                                        <Chart type="bar" data={chartData} options={chartOptions} />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-surface-400 text-sm">No score data available</div>
                                    )}
                                </div>
                            </div>

                            {/* Scores Table */}
                            <DataTable value={scoredReviews} paginator rows={10} emptyMessage="No scores yet" stripedRows rowHover className="text-sm">
                                <Column field="title" header="Document" sortable />
                                <Column field="designer_name" header="Designer" sortable />
                                <Column header="Quality" sortable body={(r: Review) => r.score?.quality} />
                                <Column header="Score" sortable body={(r: Review) => <span className="font-semibold">{r.score?.composite_score.toFixed(2)}</span>} />
                                <Column field="created_at" header="Date" sortable body={(r: Review) => new Date(r.created_at).toLocaleDateString()} />
                            </DataTable>
                        </div>
                    </TabPanel>

                    {/* In Progress Tab */}
                    <TabPanel headerTemplate={tabHeaderTemplate('In Progress', 'pi pi-file mr-2', 1)}>
                        <DataTable value={inProgressReviews} paginator rows={10} emptyMessage="No files in progress" stripedRows rowHover className="text-sm">
                            <Column field="title" header="File Name" sortable />
                            <Column field="job_id" header="Job ID" sortable />
                            <Column field="designer_name" header="Designer" sortable />
                            <Column field="deliverable_type" header="Type" sortable className="capitalize" />
                            <Column field="status" header="Status" body={statusTemplate} sortable />
                            <Column header="Action" body={(rowData: Review) => (
                                rowData.fileBlobUrl ? (
                                    <button
                                        onClick={() => navigate(`/review/${rowData.id}`)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                                    >
                                        <Play size={14} /> Continue Review
                                    </button>
                                ) : (
                                    <span className="text-xs text-surface-400 italic">File unavailable (reload page)</span>
                                )
                            )} />
                        </DataTable>
                    </TabPanel>

                    {/* Completed Files Tab */}
                    <TabPanel headerTemplate={tabHeaderTemplate('Completed', 'pi pi-check-circle mr-2', 2)}>
                        <DataTable value={completedReviews} paginator rows={10} emptyMessage="No completed reviews" stripedRows rowHover className="text-sm">
                            <Column field="title" header="File Name" sortable />
                            <Column field="job_id" header="Job ID" sortable />
                            <Column field="designer_name" header="Designer" sortable />
                            <Column field="deliverable_type" header="Type" sortable className="capitalize" />
                            <Column header="Score" body={(r: Review) => r.score ? <span className="font-semibold">{r.score.composite_score.toFixed(2)}</span> : '—'} />
                            <Column header="Action" body={(rowData: Review) => (
                                <div className="flex items-center gap-2">
                                    <button onClick={() => navigate(`/view/${rowData.id}`)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-surface-300 text-surface-700 rounded hover:bg-surface-50 transition-colors" title="View">
                                        <Eye size={14} /> View
                                    </button>
                                    {rowData.fileBlobUrl && (
                                        <button onClick={() => navigate(`/review/${rowData.id}`)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand-600 text-white rounded hover:bg-brand-700 transition-colors">
                                            <MessageSquare size={14} /> Reopen
                                        </button>
                                    )}
                                </div>
                            )} />
                        </DataTable>
                    </TabPanel>
                </TabView>
            </div>
        </div>
    );
}
