import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { documentsApi, annotationsApi } from '../services/api';
import { Document as DocType, Annotation, Severity, ShapeType } from '../types';
import { Button } from 'primereact/button';
import { ArrowLeft, Check, CheckCircle2, Save } from 'lucide-react';

declare global { interface Window { pdfjsLib: any; } }

const SEVERITY_COLORS: Record<Severity, string> = {
    [Severity.MINOR]: '#9ca3af',
    [Severity.MODERATE]: '#f59e0b',
    [Severity.MAJOR]: '#f97316',
    [Severity.CRITICAL]: '#ef4444',
};

export default function ViewReviewedPage() {
    const { documentId } = useParams<{ documentId: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const viewerRef = useRef<HTMLDivElement>(null);

    const [doc, setDoc] = useState<DocType | null>(null);
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // PDF
    const [pdfImageSrc, setPdfImageSrc] = useState<string | null>(null);
    const [isLoadingPdf, setIsLoadingPdf] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [numPages, setNumPages] = useState<number | null>(null);

    useEffect(() => { if (documentId) loadData(); }, [documentId]);

    const loadData = async () => {
        if (!documentId) return;
        setLoading(true);
        try {
            const [docData, annData] = await Promise.all([
                documentsApi.getById(documentId),
                annotationsApi.getByDocument(documentId),
            ]);
            setDoc(docData);
            setAnnotations(annData.map((a: any) => ({
                ...a,
                pageNumber: a.page_number || a.pageNumber || 1,
            })));
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        if (!doc || !documentId) return;
        const ext = doc.filepath.split('.').pop()?.toLowerCase();
        if (ext === 'pdf') {
            setIsLoadingPdf(true);
            (async () => {
                try {
                    if (!window.pdfjsLib) {
                        console.error('pdf.js not loaded');
                        return;
                    }
                    const response = await documentsApi.getFileBase64(documentId);
                    if (!response || !response.base64) throw new Error('PDF file is empty');
                    
                    const binaryString = atob(response.base64);
                    const arrayBuffer = new ArrayBuffer(binaryString.length);
                    const uint8Array = new Uint8Array(arrayBuffer);
                    for (let i = 0; i < binaryString.length; i++) {
                        uint8Array[i] = binaryString.charCodeAt(i);
                    }
                    
                    if (arrayBuffer.byteLength === 0) throw new Error('PDF file is empty after decode');
                    const loadingTask = window.pdfjsLib.getDocument({ data: uint8Array });
                    const pdf = await loadingTask.promise;
                    setNumPages(pdf.numPages);
                    const page = await pdf.getPage(currentPage);
                    const viewport = page.getViewport({ scale: 2.0 });
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    await page.render({ canvasContext: ctx, viewport }).promise;
                    setPdfImageSrc(canvas.toDataURL('image/png'));
                } catch (err) { console.error('PDF render error:', err); }
                finally { setIsLoadingPdf(false); }
            })();
        }
    }, [doc, documentId, currentPage]);

    const isPdf = doc?.filepath.split('.').pop()?.toLowerCase() === 'pdf';
    const fileUrl = documentId ? documentsApi.getFileUrl(documentId) : '';
    const visibleAnnotations = annotations.filter(a => isPdf ? (a.pageNumber || 1) === currentPage : true);

    const resolvedCount = annotations.filter(a => a.is_resolved).length;
    const allResolved = annotations.length > 0 && resolvedCount === annotations.length;
    const noComments = annotations.length === 0;

    const toggleResolve = (id: string) => {
        setAnnotations(prev => prev.map(a => a.id === id ? { ...a, is_resolved: a.is_resolved ? 0 : 1 } : a));
    };

    const handleSave = async () => {
        if (!documentId) return;
        setSaving(true);
        try {
            if (noComments) {
                // No comments from reviewer — move directly to completed
                await documentsApi.updateStatus(documentId, 'completed');
                alert('No comments to action on. File moved to Previous Work.');
                navigate('/designer');
            } else if (allResolved) {
                await annotationsApi.save(documentId, annotations);
                await documentsApi.updateStatus(documentId, 'completed');
                alert('All comments resolved! File moved to Previous Work.');
                navigate('/designer');
            } else {
                await annotationsApi.save(documentId, annotations);
                alert('Progress saved!');
            }
        } catch (e: any) { alert(e.message); }
        finally { setSaving(false); }
    };

    if (loading) return <div className="flex items-center justify-center h-screen"><i className="pi pi-spin pi-spinner text-4xl text-brand-600" /></div>;

    return (
        <div className="flex h-[calc(100vh-57px)]">
            {/* Viewer */}
            <div className="flex-1 relative bg-surface-100 overflow-auto p-6 flex items-start justify-center">
                <div ref={viewerRef} className="relative inline-block bg-white shadow-card select-none">
                    {isPdf ? (
                        isLoadingPdf ? <div className="flex items-center justify-center h-96 w-96"><i className="pi pi-spin pi-spinner text-2xl text-brand-600" /></div>
                            : pdfImageSrc ? <img src={pdfImageSrc} alt="PDF" className="max-w-full h-auto pointer-events-none" />
                                : <div className="p-8 text-danger">Failed to render PDF</div>
                    ) : (
                        <img src={fileUrl} alt="Review" className="max-w-full h-auto pointer-events-none" />
                    )}

                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        {visibleAnnotations.map((ann, idx) => (
                            <div
                                key={ann.id}
                                className={`absolute border-2 shadow-sm ${ann.is_resolved ? 'opacity-40' : ''}`}
                                style={{
                                    left: `${ann.x}%`, top: `${ann.y}%`, width: `${ann.width}%`, height: `${ann.height}%`,
                                    borderRadius: ann.type === ShapeType.CIRCLE ? '50%' : '4px',
                                    borderColor: ann.is_resolved ? '#22c55e' : SEVERITY_COLORS[ann.severity],
                                    backgroundColor: ann.is_resolved ? '#22c55e22' : `${SEVERITY_COLORS[ann.severity]}33`,
                                }}
                            >
                                <div className={`absolute -top-2 -left-2 w-5 h-5 flex items-center justify-center text-white text-[10px] font-bold rounded-full shadow-sm ${ann.is_resolved ? 'bg-success' : 'bg-surface-900'}`}>
                                    {ann.is_resolved ? <Check size={10} /> : annotations.indexOf(ann) + 1}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {isPdf && numPages && numPages > 1 && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-full shadow-lg border border-surface-200 flex items-center gap-3 z-20">
                        <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="text-sm font-medium hover:bg-surface-100 p-1 rounded disabled:opacity-50">← Prev</button>
                        <span className="text-sm text-surface-600 font-medium">Page {currentPage} of {numPages}</span>
                        <button disabled={currentPage >= numPages} onClick={() => setCurrentPage(p => p + 1)} className="text-sm font-medium hover:bg-surface-100 p-1 rounded disabled:opacity-50">Next →</button>
                    </div>
                )}
            </div>

            {/* Right Sidebar - Comments */}
            <div className="w-80 bg-white border-l border-surface-200 flex flex-col h-full shadow-lg">
                <div className="p-4 border-b border-surface-100 bg-surface-50">
                    <button onClick={() => navigate(user?.role === 'reviewer' ? '/reviewer' : '/designer')} className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 mb-2"><ArrowLeft size={14} /> Back</button>
                    <h2 className="text-base font-bold text-surface-800 truncate">{doc?.title}</h2>
                    <p className="text-xs text-surface-400 mt-0.5">Reviewed by: {doc?.reviewer_name}</p>
                    <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-surface-200 rounded-full overflow-hidden">
                            <div className="h-full bg-success rounded-full transition-all" style={{ width: `${annotations.length > 0 ? (resolvedCount / annotations.length) * 100 : 0}%` }} />
                        </div>
                        <span className="text-[10px] font-semibold text-surface-500">{resolvedCount}/{annotations.length}</span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {annotations.length === 0 ? (
                        <div className="text-center py-8 text-surface-300 text-sm">No comments from reviewer</div>
                    ) : (
                        annotations.map((ann, i) => (
                            <div
                                key={ann.id}
                                className={`p-3 rounded-lg border text-sm relative transition-all cursor-pointer ${ann.is_resolved ? 'bg-success-light border-green-200 opacity-75' : 'bg-white border-surface-200 hover:border-surface-300'}`}
                                onClick={() => toggleResolve(ann.id)}
                            >
                                <div className="flex items-start gap-2">
                                    <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${ann.is_resolved ? 'bg-success border-success' : 'border-surface-300'}`}>
                                        {ann.is_resolved && <Check size={10} className="text-white" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-bold text-surface-500">#{i + 1}</span>
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SEVERITY_COLORS[ann.severity] }} />
                                            <span className="text-[10px] text-surface-400 capitalize">{ann.severity.toLowerCase()}</span>
                                        </div>
                                        <p className={`text-xs leading-relaxed ${ann.is_resolved ? 'line-through text-surface-400' : 'text-surface-700'}`}>{ann.comment}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-surface-200">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-colors ${allResolved
                            ? 'bg-success text-white hover:bg-green-600'
                            : 'bg-brand-600 text-white hover:bg-brand-700'
                            } disabled:opacity-50`}
                    >
                        {saving ? <i className="pi pi-spin pi-spinner" /> : allResolved ? <><CheckCircle2 size={16} /> Complete & Save</> : <><Save size={16} /> Save Progress</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
