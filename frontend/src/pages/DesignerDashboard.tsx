import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { documentsApi, usersApi } from '../services/api';
import { Document as DocType, User } from '../types';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { TabView, TabPanel } from 'primereact/tabview';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import { Button } from 'primereact/button';
import { useNavigate, useLocation } from 'react-router-dom';
import { Upload, Send, FileText, CheckCircle2, Clock, Eye, Trash2, Download } from 'lucide-react';
import { downloadDocumentPdf } from '../utils/exportUtils';

interface Props {
    defaultTab?: 'upload' | 'reviewed' | 'previous';
}

export default function DesignerDashboard({ defaultTab = 'upload' }: Props) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState(defaultTab === 'reviewed' ? 1 : defaultTab === 'previous' ? 2 : 0);

    // Sync tab when navigating via notification or URL change
    useEffect(() => {
        if (location.pathname.includes('/reviewed')) {
            setActiveTab(1);
        } else if (location.pathname.includes('/previous')) {
            setActiveTab(2);
        } else if (location.pathname === '/designer' || location.pathname === '/designer/') {
            setActiveTab(0);
        }
    }, [location.pathname]);
    const [documents, setDocuments] = useState<DocType[]>([]);
    const [loading, setLoading] = useState(true);
    const [reviewers, setReviewers] = useState<User[]>([]);

    // Upload form state
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [jobId, setJobId] = useState('');
    const [deliverableType, setDeliverableType] = useState('assets');
    const [complexity, setComplexity] = useState('');
    const [dueDate, setDueDate] = useState<Date | null>(null);
    const [deliveryDate, setDeliveryDate] = useState<Date | null>(null);
    const [selectedReviewer, setSelectedReviewer] = useState('');
    const [uploading, setUploading] = useState(false);
    const [downloadingId, setDownloadingId] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (user) {
            loadDocuments();
            loadReviewers();
        }
    }, [user]);

    const loadDocuments = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const docs = await documentsApi.getByDesigner(user.id);
            setDocuments(docs);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const loadReviewers = async () => {
        try {
            const data = await usersApi.getReviewers();
            setReviewers(data);
        } catch (e) { console.error(e); }
    };

    const handleUpload = async () => {
        if (!selectedFile || !user || !jobId || !deliverableType || !selectedReviewer) {
            alert('Please fill all required fields');
            return;
        }
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('designer_id', user.id);
            formData.append('reviewer_id', selectedReviewer);
            formData.append('job_id', jobId);
            formData.append('deliverable_type', deliverableType);
            formData.append('complexity', complexity);
            formData.append('due_date', dueDate ? dueDate.toISOString().split('T')[0] : '');
            formData.append('delivery_date', deliveryDate ? deliveryDate.toISOString().split('T')[0] : '');

            await documentsApi.upload(formData);
            setShowUploadDialog(false);
            resetUploadForm();
            loadDocuments();
        } catch (e: any) { alert(e.message || 'Upload failed'); }
        finally { setUploading(false); }
    };

    const resetUploadForm = () => {
        setSelectedFile(null);
        setJobId('');
        setDeliverableType('assets');
        setComplexity('');
        setDueDate(null);
        setDeliveryDate(null);
        setSelectedReviewer('');
    };

    const pendingDocs = documents.filter(d => ['pending', 'in_review'].includes(d.status));
    const reviewedDocs = documents.filter(d => d.status === 'reviewed');
    const completedDocs = documents.filter(d => d.status === 'completed');

    const statusTemplate = (rowData: DocType) => {
        const map: Record<string, 'info' | 'warning' | 'success' | 'danger'> = {
            pending: 'warning', in_review: 'info', reviewed: 'success', completed: 'success'
        };
        return <Tag value={rowData.status.replace('_', ' ')} severity={map[rowData.status] || 'info'} className="capitalize text-xs" />;
    };

    const handleRollback = async (doc: DocType) => {
        if (!confirm(`Are you sure you want to delete "${doc.title}"? This cannot be undone.`)) return;
        try {
            await documentsApi.delete(doc.id);
            loadDocuments();
        } catch (e: any) {
            alert(e.message || 'Failed to delete');
        }
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

    const dateTemplate = (field: string) => (rowData: any) => {
        const val = rowData[field];
        return val ? new Date(val).toLocaleDateString() : '—';
    };

    const complexityOptions = [
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' },
    ];

    const deliverableTypes = [
        { label: 'Assets', value: 'assets' },
        { label: 'Ecomms', value: 'ecomms' },
        { label: 'Marketing', value: 'marketing' },
    ];

    const reviewerOptions = reviewers.map(r => ({ label: `${r.name} (${r.email})`, value: r.id }));

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
                    <h1 className="text-2xl font-bold text-surface-800">Designer Dashboard</h1>
                    <p className="text-sm text-surface-500 mt-1">Upload files, track reviews, and manage your work</p>
                </div>
                <button
                    onClick={() => setShowUploadDialog(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition-colors shadow-sm"
                >
                    <Upload size={18} />
                    <span>Upload File</span>
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-card border border-surface-200 overflow-hidden">
                <TabView activeIndex={activeTab} onTabChange={e => setActiveTab(e.index)} pt={{
                    nav: { className: 'bg-surface-50 border-b border-surface-200 flex' }
                }}>
                    <TabPanel headerTemplate={tabHeaderTemplate('Sent for Review', 'pi pi-send mr-2', 0)}>
                        <DataTable value={pendingDocs} loading={loading} paginator rows={10} emptyMessage="No files sent for review" stripedRows rowHover className="text-sm">
                            <Column field="title" header="File Name" sortable />
                            <Column field="job_id" header="Job ID" sortable />
                            <Column field="deliverable_type" header="Type" sortable className="capitalize" />
                            <Column field="reviewer_name" header="Reviewer" sortable />
                            <Column field="status" header="Status" body={statusTemplate} sortable />
                            <Column field="created_at" header="Sent On" body={dateTemplate('created_at')} sortable />
                            <Column header="Action" body={(rowData: DocType) => (
                                rowData.status === 'pending' ? (
                                    <button
                                        onClick={() => handleRollback(rowData)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger-light rounded-lg transition-colors"
                                        title="Delete / Rollback"
                                    >
                                        <Trash2 size={14} /> Delete
                                    </button>
                                ) : (
                                    <span className="text-xs text-surface-400 italic">In progress</span>
                                )
                            )} />
                        </DataTable>
                    </TabPanel>

                    <TabPanel headerTemplate={tabHeaderTemplate('Reviewed', 'pi pi-check-circle mr-2', 1)}>
                        <DataTable value={reviewedDocs} loading={loading} paginator rows={10} emptyMessage="No reviewed files" stripedRows rowHover className="text-sm">
                            <Column field="title" header="File Name" sortable />
                            <Column field="job_id" header="Job ID" sortable />
                            <Column field="reviewer_name" header="Reviewed By" sortable />
                            <Column field="status" header="Status" body={statusTemplate} sortable />
                            <Column header="Action" body={(rowData: DocType) => (
                                <button onClick={() => navigate(`/designer/view/${rowData.id}`)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                                    <Eye size={14} /> View
                                </button>
                            )} />
                        </DataTable>
                    </TabPanel>

                    <TabPanel headerTemplate={tabHeaderTemplate('Previous Work', 'pi pi-history mr-2', 2)}>
                        <DataTable value={completedDocs} loading={loading} paginator rows={10} emptyMessage="No completed work" stripedRows rowHover className="text-sm">
                            <Column field="title" header="File Name" sortable />
                            <Column field="job_id" header="Job ID" sortable />
                            <Column field="deliverable_type" header="Type" sortable className="capitalize" />
                            <Column field="reviewer_name" header="Reviewed By" sortable />
                            <Column field="created_at" header="Date" body={dateTemplate('created_at')} sortable />
                            <Column header="Action" body={(rowData: DocType) => (
                                <div className="flex items-center gap-2">
                                    <button onClick={() => navigate(`/designer/view/${rowData.id}`)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-surface-300 text-surface-700 rounded hover:bg-surface-50 transition-colors" title="View">
                                        <Eye size={14} /> View
                                    </button>
                                    <button onClick={() => handleDownloadPdf(rowData)} disabled={downloadingId === rowData.id} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-brand-300 text-brand-700 rounded hover:bg-brand-50 transition-colors disabled:opacity-50" title="Save as PDF">
                                        {downloadingId === rowData.id ? <i className="pi pi-spin pi-spinner text-[14px]" /> : <Download size={14} />} PDF
                                    </button>
                                </div>
                            )} />
                        </DataTable>
                    </TabPanel>
                </TabView>
            </div>

            {/* Upload Dialog */}
            <Dialog
                header="Upload File for Review"
                visible={showUploadDialog}
                onHide={() => { setShowUploadDialog(false); resetUploadForm(); }}
                style={{ width: '520px' }}
                modal
            >
                <div className="space-y-4 pt-2">
                    <div>
                        <label className="block text-sm font-medium text-surface-600 mb-1">File (PDF or Image)</label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                            className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-50 file:text-brand-700 file:font-medium hover:file:bg-brand-100 file:cursor-pointer"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-surface-600 mb-1">Job ID *</label>
                            <InputText value={jobId} onChange={e => setJobId(e.target.value)} className="w-full" placeholder="e.g. JB-2026-01" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-surface-600 mb-1">Deliverable Type *</label>
                            <Dropdown value={deliverableType} options={deliverableTypes} onChange={e => setDeliverableType(e.value)} className="w-full" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-surface-600 mb-1">Complexity *</label>
                        <Dropdown value={complexity} options={complexityOptions} onChange={e => setComplexity(e.value)} className="w-full" placeholder="Select complexity" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-surface-600 mb-1">Due Date</label>
                            <Calendar value={dueDate} onChange={e => setDueDate(e.value as Date)} className="w-full" dateFormat="yy-mm-dd" showIcon />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-surface-600 mb-1">Delivery Date</label>
                            <Calendar value={deliveryDate} onChange={e => setDeliveryDate(e.value as Date)} className="w-full" dateFormat="yy-mm-dd" showIcon />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-surface-600 mb-1">Send to Reviewer *</label>
                        <Dropdown
                            value={selectedReviewer}
                            options={reviewerOptions}
                            onChange={e => setSelectedReviewer(e.value)}
                            className="w-full"
                            placeholder="Select reviewer"
                            filter
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-surface-200 mt-4">
                        <button onClick={() => { setShowUploadDialog(false); resetUploadForm(); }} className="px-4 py-2 text-sm font-medium text-surface-600 border border-surface-300 rounded-lg hover:bg-surface-50 transition-colors">Cancel</button>
                        <button onClick={handleUpload} disabled={uploading || !selectedFile || !jobId || !selectedReviewer} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-50 transition-colors">
                            {uploading ? <i className="pi pi-spin pi-spinner" /> : <i className="pi pi-send" />} {uploading ? 'Uploading...' : 'Send for Review'}
                        </button>
                    </div>
                </div>
            </Dialog>
        </div>
    );
}
