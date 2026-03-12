import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { documentsApi, annotationsApi, scoresApi } from '../services/api';
import { Document as DocType, Annotation, ShapeType, Severity, ErrorCategory } from '../types';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { ArrowLeft, Square, Circle, Save, SendHorizontal, Trash2, Download, Info, Pencil, Check, X } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { PDFDocument, rgb, PDFString, PDFName } from 'pdf-lib';

declare global { interface Window { pdfjsLib: any; } }

const SEVERITY_COLORS: Record<Severity, string> = {
    [Severity.MINOR]: '#9ca3af',
    [Severity.MODERATE]: '#f59e0b',
    [Severity.MAJOR]: '#f97316',
    [Severity.CRITICAL]: '#ef4444',
};

export default function ReviewPage() {
    const { documentId } = useParams<{ documentId: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const viewerRef = useRef<HTMLDivElement>(null);

    const [doc, setDoc] = useState<DocType | null>(null);
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [activeTool, setActiveTool] = useState<ShapeType>(ShapeType.RECTANGLE);
    const [loading, setLoading] = useState(true);

    // Drawing state
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
    const [currentRect, setCurrentRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

    // Modal state
    const [commentModalOpen, setCommentModalOpen] = useState(false);
    const [comment, setComment] = useState('');
    const [severity, setSeverity] = useState<Severity>(Severity.MINOR);
    const [errorCat, setErrorCat] = useState<ErrorCategory>(ErrorCategory.DESIGN);
    const [tempShape, setTempShape] = useState<Partial<Annotation> | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);

    // PDF rendering
    const [pdfImageSrc, setPdfImageSrc] = useState<string | null>(null);
    const [isLoadingPdf, setIsLoadingPdf] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [numPages, setNumPages] = useState<number | null>(null);

    // Sidebar edit
    const [sidebarEditId, setSidebarEditId] = useState<string | null>(null);
    const [sidebarEditComment, setSidebarEditComment] = useState('');

    // Scoring modal
    const [showScoring, setShowScoring] = useState(false);
    const [quality, setQuality] = useState<number>(100);
    const [complexityScore, setComplexityScore] = useState<number>(1);
    const [ftpBand, setFtpBand] = useState<number>(100);
    const [designScore, setDesignScore] = useState<number>(100);
    const [repeatOffence, setRepeatOffence] = useState<number>(1);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { if (documentId) loadDocument(); }, [documentId]);

    const loadDocument = async () => {
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

    // PDF rendering — fetch via API endpoint to avoid Vite proxy issues with binary
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
                    // Fetch securely as base64 to avoid browser download managers hijacking the binary stream
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
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    await page.render({ canvasContext: context, viewport }).promise;
                    setPdfImageSrc(canvas.toDataURL('image/png'));
                } catch (err) { console.error('PDF render error:', err); }
                finally { setIsLoadingPdf(false); }
            })();
        }
    }, [doc, documentId, currentPage]);

    const isPdf = doc?.filepath.split('.').pop()?.toLowerCase() === 'pdf';
    const fileUrl = documentId ? documentsApi.getFileUrl(documentId) : '';

    // Drawing handlers
    const getRelativeCoords = (e: React.MouseEvent) => {
        if (!viewerRef.current) return { pctX: 0, pctY: 0 };
        const rect = viewerRef.current.getBoundingClientRect();
        return { pctX: ((e.clientX - rect.left) / rect.width) * 100, pctY: ((e.clientY - rect.top) / rect.height) * 100 };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!doc || commentModalOpen) return;
        setIsDrawing(true);
        const c = getRelativeCoords(e);
        setStartPoint({ x: c.pctX, y: c.pctY });
        setCurrentRect({ x: c.pctX, y: c.pctY, w: 0, h: 0 });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDrawing || !startPoint) return;
        const c = getRelativeCoords(e);
        setCurrentRect({
            x: Math.min(c.pctX, startPoint.x), y: Math.min(c.pctY, startPoint.y),
            w: Math.abs(c.pctX - startPoint.x), h: Math.abs(c.pctY - startPoint.y),
        });
    };

    const handleMouseUp = () => {
        if (!isDrawing || !currentRect) return;
        setIsDrawing(false);
        if (currentRect.w < 1 || currentRect.h < 1) { setCurrentRect(null); return; }
        setTempShape({ type: activeTool, x: currentRect.x, y: currentRect.y, width: currentRect.w, height: currentRect.h });
        setComment('');
        setSeverity(Severity.MINOR);
        setEditingId(null);
        setCommentModalOpen(true);
    };

    const handleCommentSave = () => {
        if (!comment.trim()) return;
        if (editingId) {
            setAnnotations(prev => prev.map(a => a.id === editingId ? { ...a, comment, severity, error_category: errorCat } : a));
        } else if (tempShape) {
            const newAnn: Annotation = {
                id: crypto.randomUUID(),
                type: tempShape.type || ShapeType.RECTANGLE,
                pageNumber: isPdf ? currentPage : 1,
                severity,
                error_category: errorCat,
                x: tempShape.x || 0, y: tempShape.y || 0,
                width: tempShape.width || 0, height: tempShape.height || 0,
                comment,
                timestamp: Date.now(),
            };
            setAnnotations(prev => [...prev, newAnn]);
        }
        closeCommentModal();
    };

    const closeCommentModal = () => {
        setCommentModalOpen(false);
        setCurrentRect(null);
        setTempShape(null);
        setEditingId(null);
    };

    const handleAnnotationClick = (e: React.MouseEvent, ann: Annotation) => {
        e.stopPropagation();
        setEditingId(ann.id);
        setComment(ann.comment);
        setSeverity(ann.severity);
        setErrorCat(ann.error_category || ErrorCategory.DESIGN);
        setCommentModalOpen(true);
    };

    const removeAnnotation = (id: string) => setAnnotations(prev => prev.filter(a => a.id !== id));

    const handleSaveAnnotations = async () => {
        if (!documentId) return;
        try {
            await annotationsApi.save(documentId, annotations);
            alert('Annotations saved!');
        } catch (e: any) { alert(e.message); }
    };

    const handleSaveAsPdf = async () => {
        if (!viewerRef.current || !doc || !documentId) return;
        try {
            if (isPdf) {
                const res = await documentsApi.getFileBase64(documentId);
                if (!res || !res.base64) throw new Error('PDF file is empty');
                
                const binaryString = atob(res.base64);
                const arrayBuffer = new ArrayBuffer(binaryString.length);
                const uint8Array = new Uint8Array(arrayBuffer);
                for (let i = 0; i < binaryString.length; i++) {
                    uint8Array[i] = binaryString.charCodeAt(i);
                }
                
                const pdfDoc = await PDFDocument.load(uint8Array);
                const pages = pdfDoc.getPages();
                annotations.forEach(ann => {
                    const pageIdx = (ann.pageNumber || 1) - 1;
                    if (pageIdx >= 0 && pageIdx < pages.length) {
                        const page = pages[pageIdx];
                        const { width, height } = page.getSize();
                        const rX = (ann.x / 100) * width;
                        const rW = (ann.width / 100) * width;
                        const rH = (ann.height / 100) * height;
                        const rY = height - ((ann.y / 100) * height) - rH;
                        const hexToRgb = (hex: string) => {
                            const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                            return r ? { r: parseInt(r[1], 16) / 255, g: parseInt(r[2], 16) / 255, b: parseInt(r[3], 16) / 255 } : { r: 1, g: 0, b: 0 };
                        };
                        const c = hexToRgb(SEVERITY_COLORS[ann.severity]);
                        page.drawRectangle({ x: rX, y: rY, width: rW, height: rH, borderColor: rgb(c.r, c.g, c.b), borderWidth: 2, color: rgb(c.r, c.g, c.b), opacity: 0.2, borderOpacity: 1 });
                        const annotObj = pdfDoc.context.obj({ Type: 'Annot', Subtype: 'Text', Rect: [rX, rY, rX + rW, rY + rH], Contents: PDFString.of(ann.comment), T: PDFString.of(ann.severity), Open: false, Name: PDFName.of('Note') });
                        const annotRef = pdfDoc.context.register(annotObj);
                        page.node.addAnnot(annotRef);
                    }
                });
                const pdfBytes = await pdfDoc.save();
                const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `${doc.title}_reviewed.pdf`;
                link.click();
                URL.revokeObjectURL(link.href);
            } else {
                const canvas = await html2canvas(viewerRef.current, { scale: 2, useCORS: true, logging: false, backgroundColor: '#fff' });
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? 'l' : 'p', unit: 'px', format: [canvas.width, canvas.height] });
                pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
                pdf.save(`${doc.title}_reviewed.pdf`);
            }
        } catch (err) { console.error(err); alert('PDF export failed'); }
    };

    const handleCompleteReview = () => setShowScoring(true);

    const handleSubmitScore = async () => {
        if (!documentId || !user) return;
        setSubmitting(true);
        try {
            await annotationsApi.save(documentId, annotations);
            await scoresApi.submit({ document_id: documentId, reviewer_id: user.id, quality, complexity: complexityScore, ftp: ftpBand, design: designScore, repeat_offence: repeatOffence });
            await documentsApi.updateStatus(documentId, 'reviewed');
            setShowScoring(false);
            navigate('/reviewer');
        } catch (e: any) { alert(e.message); }
        finally { setSubmitting(false); }
    };

    const compositeScore = ((0.60 * quality + 0.03 * designScore + 0.10 * ftpBand) * complexityScore) / repeatOffence;

    const visibleAnnotations = annotations.filter(a => isPdf ? (a.pageNumber || 1) === currentPage : true);

    const qualityOptions = [{ label: 'Excellent (100)', value: 100 }, { label: 'Good (50)', value: 50 }, { label: 'Needs work (0)', value: 0 }];
    const complexityOptions = [{ label: 'Basic (1x)', value: 1 }, { label: 'Medium (1.05x)', value: 1.05 }, { label: 'Complex (1.10x)', value: 1.10 }];
    const ftpOptions = [{ label: 'On time (100)', value: 100 }, { label: 'Delay/Missed (0)', value: 0 }];
    const designOptions = [{ label: 'Good (100)', value: 100 }, { label: 'Average (50)', value: 50 }, { label: 'Basic (0)', value: 0 }];
    const repeatOptions = [{ label: 'None (1x)', value: 1 }, { label: '2 offences (2x)', value: 2 }, { label: '3+ offences (4x)', value: 4 }];

    if (loading) return <div className="flex items-center justify-center h-screen"><i className="pi pi-spin pi-spinner text-4xl text-brand-600" /></div>;

    return (
        <div className="flex h-[calc(100vh-57px)]">
            {/* Main Viewer */}
            <div className="flex-1 relative bg-surface-100 overflow-auto p-6 flex flex-col items-center">
                <div
                    ref={viewerRef}
                    className="relative inline-block bg-white shadow-card cursor-crosshair select-none"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={() => isDrawing && setIsDrawing(false)}
                    style={{ touchAction: 'none' }}
                >
                    {isPdf ? (
                        isLoadingPdf ? (
                            <div className="flex items-center justify-center h-96 w-96"><i className="pi pi-spin pi-spinner text-2xl text-brand-600" /></div>
                        ) : pdfImageSrc ? (
                            <img src={pdfImageSrc} alt="PDF" className="max-w-full h-auto select-none pointer-events-none" />
                        ) : <div className="p-8 text-danger">Failed to render PDF</div>
                    ) : (
                        <img src={fileUrl} alt="Review" className="max-w-full h-auto select-none pointer-events-none" />
                    )}

                    {/* Annotation overlays */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        {visibleAnnotations.map((ann, idx) => (
                            <div
                                key={ann.id}
                                onClick={(e) => handleAnnotationClick(e, ann)}
                                className="absolute border-2 cursor-pointer pointer-events-auto group transition-all shadow-sm"
                                style={{
                                    left: `${ann.x}%`, top: `${ann.y}%`, width: `${ann.width}%`, height: `${ann.height}%`,
                                    borderRadius: ann.type === ShapeType.CIRCLE ? '50%' : '4px',
                                    borderColor: SEVERITY_COLORS[ann.severity],
                                    backgroundColor: `${SEVERITY_COLORS[ann.severity]}33`,
                                }}
                            >
                                <div className="absolute -top-2 -left-2 w-5 h-5 flex items-center justify-center text-white text-[10px] font-bold rounded-full shadow-sm bg-surface-900">
                                    {annotations.indexOf(ann) + 1}
                                </div>
                                <div className="absolute -top-3 -right-3 hidden group-hover:flex">
                                    <button onClick={e => { e.stopPropagation(); removeAnnotation(ann.id); }} className="p-1 bg-white rounded-full text-danger shadow border border-surface-200 hover:bg-danger-light">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                                <div className="absolute top-full left-0 mt-1 w-48 bg-surface-900 text-white text-xs p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                                    {ann.comment}
                                </div>
                            </div>
                        ))}

                        {currentRect && (
                            <div className="absolute border-2 border-brand-500 bg-brand-500/20" style={{
                                left: `${currentRect.x}%`, top: `${currentRect.y}%`, width: `${currentRect.w}%`, height: `${currentRect.h}%`,
                                borderRadius: activeTool === ShapeType.CIRCLE ? '50%' : '4px',
                            }} />
                        )}
                    </div>
                </div>

                {/* PDF pagination */}
                {isPdf && numPages && numPages > 1 && (
                    <div className="mt-4 bg-white px-4 py-2 rounded-full shadow-md border border-surface-200 flex items-center gap-3 shrink-0">
                        <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="text-sm font-medium hover:bg-surface-100 p-1 rounded disabled:opacity-50">← Prev</button>
                        <span className="text-sm text-surface-600 font-medium">Page {currentPage} of {numPages}</span>
                        <button disabled={currentPage >= numPages} onClick={() => setCurrentPage(p => p + 1)} className="text-sm font-medium hover:bg-surface-100 p-1 rounded disabled:opacity-50">Next →</button>
                    </div>
                )}
            </div>

            {/* Right Sidebar */}
            <div className="w-80 bg-white border-l border-surface-200 flex flex-col h-full shadow-lg">
                {/* Header */}
                <div className="p-4 border-b border-surface-100 bg-surface-50">
                    <button onClick={() => navigate('/reviewer')} className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 mb-2"><ArrowLeft size={14} /> Back</button>
                    <h2 className="text-base font-bold text-surface-800 truncate">{doc?.title}</h2>
                    <p className="text-xs text-surface-400 mt-0.5">Job: {doc?.job_id} · By: {doc?.designer_name}</p>
                </div>

                {/* Tools */}
                <div className="p-4 border-b border-surface-100 space-y-3">
                    <h3 className="text-xs font-semibold text-surface-600 uppercase">Tools</h3>
                    <div className="flex gap-2">
                        <button onClick={() => setActiveTool(ShapeType.RECTANGLE)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${activeTool === ShapeType.RECTANGLE ? 'bg-brand-50 border-brand-500 text-brand-700' : 'border-surface-200 text-surface-600 hover:bg-surface-50'}`}>
                            <Square size={14} /> Rectangle
                        </button>
                        <button onClick={() => setActiveTool(ShapeType.CIRCLE)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${activeTool === ShapeType.CIRCLE ? 'bg-brand-50 border-brand-500 text-brand-700' : 'border-surface-200 text-surface-600 hover:bg-surface-50'}`}>
                            <Circle size={14} /> Circle
                        </button>
                    </div>
                    <div className="text-xs text-surface-400 flex items-start gap-1.5 bg-surface-50 p-2 rounded">
                        <Info size={12} className="mt-0.5 flex-shrink-0" /> Click and drag on document to annotate.
                    </div>
                </div>

                {/* Comments list */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-semibold text-surface-600 uppercase">Comments</h3>
                        <span className="bg-surface-100 text-surface-600 px-2 py-0.5 rounded-full text-[10px] font-bold">{annotations.length}</span>
                    </div>
                    {annotations.length === 0 ? (
                        <div className="text-center py-8 text-surface-300 text-sm">No annotations yet</div>
                    ) : (
                        <div className="space-y-2">
                            {annotations.map((ann, i) => (
                                <div key={ann.id} className="p-3 bg-white border border-surface-200 rounded-lg text-sm relative pl-4 group hover:border-surface-300 transition-colors">
                                    <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" style={{ backgroundColor: SEVERITY_COLORS[ann.severity] }} />
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="inline-flex items-center justify-center w-5 h-5 bg-brand-100 text-brand-700 text-[10px] font-bold rounded-full">{i + 1}</span>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setSidebarEditId(ann.id); setSidebarEditComment(ann.comment); }} className="p-1 text-surface-400 hover:text-brand-600 rounded"><Pencil size={12} /></button>
                                            <button onClick={() => removeAnnotation(ann.id)} className="p-1 text-surface-400 hover:text-danger rounded"><Trash2 size={12} /></button>
                                        </div>
                                    </div>
                                    {sidebarEditId === ann.id ? (
                                        <div className="space-y-2 mt-1">
                                            <textarea value={sidebarEditComment} onChange={e => setSidebarEditComment(e.target.value)} className="w-full p-2 border rounded text-xs focus:ring-1 focus:ring-brand-500 outline-none resize-none" rows={3} autoFocus />
                                            <div className="flex justify-end gap-1">
                                                <button onClick={() => setSidebarEditId(null)} className="p-1 text-surface-500 hover:bg-surface-100 rounded"><X size={14} /></button>
                                                <button onClick={() => { if (sidebarEditComment.trim()) { setAnnotations(prev => prev.map(a => a.id === ann.id ? { ...a, comment: sidebarEditComment } : a)); setSidebarEditId(null); } }} className="p-1 text-white bg-brand-600 hover:bg-brand-700 rounded"><Check size={14} /></button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-surface-700 text-xs leading-relaxed">{ann.comment}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-surface-200 space-y-2">
                    <button onClick={handleSaveAnnotations} className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium border border-surface-300 rounded-lg hover:bg-surface-50 transition-colors">
                        <Save size={16} /> Save Annotations
                    </button>
                    <button onClick={handleSaveAsPdf} className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium border border-surface-300 rounded-lg hover:bg-surface-50 transition-colors">
                        <Download size={16} /> Save as PDF
                    </button>
                    <button onClick={handleCompleteReview} className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors">
                        <SendHorizontal size={16} /> Complete Review & Score
                    </button>
                </div>
            </div>

            {/* Comment Modal */}
            {commentModalOpen && (
                <div className="fixed inset-0 z-50" style={{ pointerEvents: 'none' }}>
                    <div className="absolute inset-0 bg-transparent" style={{ pointerEvents: 'auto' }} onClick={closeCommentModal} />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl border border-surface-200 p-5 w-80 animate-fade-in" style={{ pointerEvents: 'auto' }}>
                        <h3 className="text-sm font-semibold text-surface-700 mb-3">{editingId ? 'Edit Comment' : 'Add Comment'}</h3>
                        <textarea value={comment} onChange={e => setComment(e.target.value)} className="w-full h-24 p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none" placeholder="Describe the issue..." autoFocus />
                        <div className="flex gap-2 mt-2">
                            <select value={severity} onChange={e => setSeverity(e.target.value as Severity)} className="flex-1 p-2 border rounded-lg text-sm bg-surface-50 outline-none focus:ring-2 focus:ring-brand-500">
                                <option value={Severity.MINOR}>Minor</option>
                                <option value={Severity.MODERATE}>Moderate</option>
                                <option value={Severity.MAJOR}>Major</option>
                                <option value={Severity.CRITICAL}>Critical</option>
                            </select>
                            <select value={errorCat} onChange={e => setErrorCat(e.target.value as ErrorCategory)} className="flex-1 p-2 border rounded-lg text-sm bg-surface-50 outline-none focus:ring-2 focus:ring-brand-500">
                                <option value={ErrorCategory.DESIGN}>Design</option>
                                <option value={ErrorCategory.LAYOUT}>Layout</option>
                                <option value={ErrorCategory.EDITORIAL}>Editorial</option>
                                <option value={ErrorCategory.BRAND}>Brand</option>
                            </select>
                        </div>
                        <div className="flex justify-end gap-2 mt-3">
                            <button onClick={closeCommentModal} className="px-3 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-100 rounded-lg">Cancel</button>
                            <button onClick={handleCommentSave} disabled={!comment.trim()} className="px-3 py-1.5 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-50">{editingId ? 'Update' : 'Save'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Scoring Dialog */}
            <Dialog header="Scoring Matrix" visible={showScoring} onHide={() => setShowScoring(false)} style={{ width: '500px' }} modal>
                <p className="text-xs text-surface-500 mb-4">Fill the scoring matrix before sending back to the designer. This data is for reviewer analytics only.</p>
                <div className="space-y-4">
                    <div><label className="block text-sm font-medium text-surface-600 mb-1">Quality</label><Dropdown value={quality} options={qualityOptions} onChange={e => setQuality(e.value)} className="w-full" /></div>
                    <div><label className="block text-sm font-medium text-surface-600 mb-1">Complexity</label><Dropdown value={complexityScore} options={complexityOptions} onChange={e => setComplexityScore(e.value)} className="w-full" /></div>
                    <div><label className="block text-sm font-medium text-surface-600 mb-1">FTP Band</label><Dropdown value={ftpBand} options={ftpOptions} onChange={e => setFtpBand(e.value)} className="w-full" /></div>
                    <div><label className="block text-sm font-medium text-surface-600 mb-1">Design</label><Dropdown value={designScore} options={designOptions} onChange={e => setDesignScore(e.value)} className="w-full" /></div>
                    <div><label className="block text-sm font-medium text-surface-600 mb-1">Repeat Offence</label><Dropdown value={repeatOffence} options={repeatOptions} onChange={e => setRepeatOffence(e.value)} className="w-full" /></div>
                    <div className="p-3 bg-brand-50 rounded-lg border border-brand-200">
                        <p className="text-sm font-semibold text-brand-800">Composite Score: <span className="text-xl">{compositeScore.toFixed(2)}</span></p>
                        <p className="text-[10px] text-brand-600 mt-1">= ((0.60×Quality + 0.03×Design + 0.10×FTP) × Complexity) / Repeat Offence</p>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 mt-4">
                        <button onClick={() => setShowScoring(false)} className="px-4 py-2 text-sm font-medium text-surface-600 border border-surface-300 rounded-lg hover:bg-surface-50 transition-colors">Cancel</button>
                        <button onClick={handleSubmitScore} disabled={submitting} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-50 transition-colors">
                            {submitting ? <i className="pi pi-spin pi-spinner" /> : <i className="pi pi-send" />} {submitting ? 'Submitting...' : 'Submit & Send to Designer'}
                        </button>
                    </div>
                </div>
            </Dialog>
        </div>
    );
}
