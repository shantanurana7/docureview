import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { getReviewById, updateAnnotations } from '../services/localStore';
import { Review, Annotation, ShapeType } from '../types';
import { ArrowLeft, Square, Save, FileDown, Trash2, Pencil, Check, X, Info } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import BrandChecklist, { LogoOverlayState } from '../components/review/BrandChecklist';

const HIGHLIGHT_COLOR = '#6366f1';
const LOGO_SRC = '/KPMG_blue_logo.svg';
const LOGO_BASE_W = 120; // px at scale 1

export default function ReviewPage() {
    const { reviewId } = useParams<{ reviewId: string }>();
    const storeData = useStore();
    const navigate = useNavigate();
    const viewerRef = useRef<HTMLDivElement>(null);

    const [review, setReview] = useState<Review | null>(null);
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [loading, setLoading] = useState(true);

    // Drawing
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
    const [currentRect, setCurrentRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

    // Comment modal
    const [commentModalOpen, setCommentModalOpen] = useState(false);
    const [comment, setComment] = useState('');
    const [tempShape, setTempShape] = useState<Partial<Annotation> | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Sidebar inline edit
    const [sidebarEditId, setSidebarEditId] = useState<string | null>(null);
    const [sidebarEditComment, setSidebarEditComment] = useState('');

    // Logo overlay state (owned here so overlay renders inside canvas)
    const [logoOverlay, setLogoOverlay] = useState<LogoOverlayState>({ active: false, pos: { x: 0, y: 0 }, scale: 1, testResult: null, testComment: '' });
    const logoDragging = useRef(false);
    const logoDragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });

    useEffect(() => {
        if (reviewId) {
            const r = getReviewById(reviewId);
            if (r) { setReview(r); setAnnotations(r.annotations || []); }
            setLoading(false);
        }
    }, [reviewId, storeData]);

    // ── Drawing ───────────────────────────────────────────────────────────────
    const getRelativeCoords = (e: React.MouseEvent) => {
        if (!viewerRef.current) return { pctX: 0, pctY: 0 };
        const rect = viewerRef.current.getBoundingClientRect();
        return {
            pctX: ((e.clientX - rect.left) / rect.width) * 100,
            pctY: ((e.clientY - rect.top) / rect.height) * 100,
        };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!review || commentModalOpen || logoOverlay.active) return;
        setIsDrawing(true);
        const c = getRelativeCoords(e);
        setStartPoint({ x: c.pctX, y: c.pctY });
        setCurrentRect({ x: c.pctX, y: c.pctY, w: 0, h: 0 });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDrawing || !startPoint) return;
        const c = getRelativeCoords(e);
        setCurrentRect({
            x: Math.min(c.pctX, startPoint.x),
            y: Math.min(c.pctY, startPoint.y),
            w: Math.abs(c.pctX - startPoint.x),
            h: Math.abs(c.pctY - startPoint.y),
        });
    };

    const handleMouseUp = () => {
        if (!isDrawing || !currentRect) return;
        setIsDrawing(false);
        if (currentRect.w < 1 || currentRect.h < 1) { setCurrentRect(null); return; }
        setTempShape({ type: ShapeType.RECTANGLE, x: currentRect.x, y: currentRect.y, width: currentRect.w, height: currentRect.h });
        setComment('');
        setEditingId(null);
        setCommentModalOpen(true);
    };

    // ── Comments ──────────────────────────────────────────────────────────────
    const handleCommentSave = () => {
        if (!comment.trim()) return;
        if (editingId) {
            setAnnotations(prev => prev.map(a => a.id === editingId ? { ...a, comment } : a));
        } else if (tempShape) {
            const newAnn: Annotation = {
                id: crypto.randomUUID(),
                type: ShapeType.RECTANGLE,
                pageNumber: 1,
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
        setCommentModalOpen(false); setCurrentRect(null);
        setTempShape(null); setEditingId(null); setComment('');
    };

    const handleAnnotationClick = (e: React.MouseEvent, ann: Annotation) => {
        e.stopPropagation();
        setEditingId(ann.id);
        setComment(ann.comment || '');
        setCommentModalOpen(true);
    };

    const removeAnnotation = (id: string) => setAnnotations(prev => prev.filter(a => a.id !== id));

    // ── Logo drag ─────────────────────────────────────────────────────────────
    const handleLogoDragStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        logoDragging.current = true;
        logoDragStart.current = { mx: e.clientX, my: e.clientY, ox: logoOverlay.pos.x, oy: logoOverlay.pos.y };
        const onMove = (ev: MouseEvent) => {
            if (!logoDragging.current || !viewerRef.current) return;
            const canvas = viewerRef.current;
            const canvasW = canvas.offsetWidth;
            const canvasH = canvas.offsetHeight;
            // Logo group dimensions: width=scaledW, height=3*scaledH (3 stacked logos)
            const lw = LOGO_BASE_W * logoOverlay.scale;
            const lh = Math.round(lw / 3);
            const groupH = lh * 3;
            const newX = logoDragStart.current.ox + ev.clientX - logoDragStart.current.mx;
            const newY = logoDragStart.current.oy + ev.clientY - logoDragStart.current.my;
            setLogoOverlay(prev => ({
                ...prev,
                pos: {
                    x: Math.max(0, Math.min(newX, canvasW - lw)),
                    y: Math.max(0, Math.min(newY, canvasH - groupH)),
                },
            }));
        };
        const onUp = () => {
            logoDragging.current = false;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [logoOverlay.pos, logoOverlay.scale]);

    // ── Actions ───────────────────────────────────────────────────────────────
    const handleSaveAnnotations = () => {
        if (!reviewId) return;
        updateAnnotations(reviewId, annotations);
        alert('Annotations saved!');
    };

    const handleSaveAsPdf = async () => {
        if (!viewerRef.current || !review) return;
        try {
            // Capture the canvas area (image + annotation overlays)
            const canvasEl = await html2canvas(viewerRef.current, { scale: 2, useCORS: true, logging: false, backgroundColor: '#fff' });
            const imgData = canvasEl.toDataURL('image/png');
            const imgW = canvasEl.width;
            const imgH = canvasEl.height;

            // Page size = image size in points (pt), 1pt ≈ 1px at 72dpi
            const pdf = new jsPDF({ orientation: imgW > imgH ? 'l' : 'p', unit: 'px', format: [imgW, imgH], compress: true });
            pdf.addImage(imgData, 'PNG', 0, 0, imgW, imgH);

            // ── Comments section on a new page ───────────────────────────
            const hasComments = annotations.length > 0 || (logoOverlay.testResult === 'not_ok' && logoOverlay.testComment);
            if (hasComments) {
                pdf.addPage();
                const margin = 40;
                let y = 50;
                const lineH = 18;
                const pageW = pdf.internal.pageSize.getWidth();

                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(14);
                pdf.text('Review Comments', margin, y);
                y += lineH * 1.5;

                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(9);
                pdf.setTextColor(100);
                pdf.text(`File: ${review.title}   |   Job: ${review.job_id}   |   Designer: ${review.designer_name}`, margin, y);
                y += lineH * 1.5;

                // Annotation comments
                if (annotations.length > 0) {
                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(11);
                    pdf.setTextColor(30);
                    pdf.text('Annotation Comments', margin, y);
                    y += lineH;

                    annotations.forEach((ann, i) => {
                        pdf.setFont('helvetica', 'bold');
                        pdf.setFontSize(9);
                        pdf.setTextColor(99, 102, 241); // brand purple
                        pdf.text(`#${i + 1}`, margin, y);
                        pdf.setFont('helvetica', 'normal');
                        pdf.setTextColor(50);
                        const lines = pdf.splitTextToSize(ann.comment || '(no comment)', pageW - margin * 2 - 16);
                        pdf.text(lines, margin + 16, y);
                        y += lineH * lines.length + 6;
                        if (y > pdf.internal.pageSize.getHeight() - 60) { pdf.addPage(); y = 50; }
                    });
                    y += lineH * 0.5;
                }

                // Logo test comment
                if (logoOverlay.testResult === 'not_ok' && logoOverlay.testComment) {
                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(11);
                    pdf.setTextColor(30);
                    pdf.text('Logo Placement Test — Issue Flagged', margin, y);
                    y += lineH;
                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(9);
                    pdf.setTextColor(200, 50, 50);
                    const lines = pdf.splitTextToSize(logoOverlay.testComment, pageW - margin * 2);
                    pdf.text(lines, margin, y);
                }
            }

            pdf.save(`${review.title}_brand-review.pdf`);
        } catch (err) { console.error(err); alert('PDF export failed'); }
    };

    // ── Logo sizing ───────────────────────────────────────────────────────────
    const scaledW = LOGO_BASE_W * logoOverlay.scale;
    const scaledH = Math.round(scaledW / 3); // ~3:1 ratio for KPMG logo

    // ── Guards ────────────────────────────────────────────────────────────────
    if (loading) return <div className="flex items-center justify-center h-screen"><i className="pi pi-spin pi-spinner text-4xl text-brand-600" /></div>;
    if (!review) return (
        <div className="flex flex-col items-center justify-center h-screen text-surface-500">
            <p>Review not found.</p>
            <button onClick={() => navigate('/')} className="mt-4 text-brand-600 hover:underline">Go to Dashboard</button>
        </div>
    );

    return (
        <div className="flex h-[calc(100vh-57px)]">
            {/* ── Main Viewer ───────────────────────────────────────────────── */}
            <div className="flex-1 relative bg-surface-100 overflow-auto p-6 flex flex-col items-center">
                <div
                    ref={viewerRef}
                    className="relative inline-block bg-white shadow-card select-none"
                    style={{ cursor: logoOverlay.active ? 'default' : 'crosshair', touchAction: 'none' }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={() => isDrawing && setIsDrawing(false)}
                >
                    {review.fileBlobUrl
                        ? <img src={review.fileBlobUrl} alt="Review" className="max-w-full h-auto select-none pointer-events-none" />
                        : <div className="p-8 text-danger">File not available</div>
                    }

                    {/* Annotation overlays */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        {annotations.map((ann) => (
                            <div
                                key={ann.id}
                                onClick={(e) => handleAnnotationClick(e, ann)}
                                className="absolute border-2 cursor-pointer pointer-events-auto group transition-all"
                                style={{
                                    left: `${ann.x}%`, top: `${ann.y}%`,
                                    width: `${ann.width}%`, height: `${ann.height}%`,
                                    borderColor: HIGHLIGHT_COLOR,
                                    backgroundColor: `${HIGHLIGHT_COLOR}22`,
                                    borderRadius: 4,
                                }}
                            >
                                <div className="absolute -top-2 -left-2 w-5 h-5 flex items-center justify-center text-white text-[10px] font-bold rounded-full shadow-sm bg-surface-900">
                                    {annotations.indexOf(ann) + 1}
                                </div>
                                <div className="absolute -top-3 -right-3 hidden group-hover:flex">
                                    <button onClick={e => { e.stopPropagation(); removeAnnotation(ann.id); }} className="p-1 bg-white rounded-full text-danger shadow border border-surface-200"><Trash2 size={12} /></button>
                                </div>
                                <div className="absolute top-full left-0 mt-1 w-48 bg-surface-900 text-white text-xs p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                                    {ann.comment}
                                </div>
                            </div>
                        ))}

                        {currentRect && (
                            <div className="absolute border-2 border-brand-500 bg-brand-500/20" style={{
                                left: `${currentRect.x}%`, top: `${currentRect.y}%`,
                                width: `${currentRect.w}%`, height: `${currentRect.h}%`,
                                borderRadius: 4,
                            }} />
                        )}
                    </div>

                    {/* ── C-Shaped Logo Overlay ──────────────────────────────── */}
                    {logoOverlay.active && (
                        <div
                            onMouseDown={handleLogoDragStart}
                            style={{
                                position: 'absolute',
                                left: logoOverlay.pos.x,
                                top: logoOverlay.pos.y,
                                cursor: 'grab',
                                userSelect: 'none',
                                zIndex: 40,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                width: scaledW,
                                pointerEvents: 'auto',
                            }}
                        >
                            {/* Top logo — horizontal */}
                            <img src={LOGO_SRC} alt="Logo top" draggable={false}
                                style={{ width: scaledW, height: scaledH, objectFit: 'contain', display: 'block', flexShrink: 0 }}
                            />
                            {/* Middle logo — same logo, rotated 90° to sit vertically on the left
                                CSS transform rotates around center but doesn't affect layout.
                                We correct the clipping by using position:absolute in a wrapper
                                sized to the post-rotation visual footprint: scaledH wide × scaledW tall */}
                            <div style={{
                                position: 'relative',
                                width: scaledH,
                                height: scaledW,
                                flexShrink: 0,
                            }}>
                                <img src={LOGO_SRC} alt="Logo left" draggable={false}
                                    style={{
                                        position: 'absolute',
                                        width: scaledW,
                                        height: scaledH,
                                        objectFit: 'contain',
                                        // Center the rotated img inside the wrapper
                                        top: (scaledW - scaledH) / 2,
                                        left: (scaledH - scaledW) / 2,
                                        transform: 'rotate(90deg)',
                                        transformOrigin: 'center center',
                                    }}
                                />
                            </div>
                            {/* Bottom logo — horizontal */}
                            <img src={LOGO_SRC} alt="Logo bottom" draggable={false}
                                style={{ width: scaledW, height: scaledH, objectFit: 'contain', display: 'block', flexShrink: 0 }}
                            />
                            {/* Drag hint */}
                            <div style={{
                                fontSize: 9, color: '#6366f1', whiteSpace: 'nowrap',
                                background: 'rgba(255,255,255,0.9)', padding: '1px 5px',
                                borderRadius: 3, border: '1px solid #c7d2fe', marginTop: 2,
                            }}>✥ drag to move</div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Right Sidebar ─────────────────────────────────────────────── */}
            <div className="w-80 bg-white border-l border-surface-200 flex flex-col h-full shadow-lg overflow-y-auto">
                {/* Header */}
                <div className="p-4 border-b border-surface-100 bg-surface-50 flex-shrink-0">
                    <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 mb-2">
                        <ArrowLeft size={14} /> Back
                    </button>
                    <h2 className="text-base font-bold text-surface-800 truncate">{review.title}</h2>
                    <p className="text-xs text-surface-400 mt-0.5">Job: {review.job_id} · By: {review.designer_name}</p>
                </div>

                {/* Tools */}
                <div className="p-4 border-b border-surface-100 flex-shrink-0">
                    <h3 className="text-xs font-semibold text-surface-600 uppercase mb-2">Tools</h3>
                    <div className="flex gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border bg-brand-50 border-brand-500 text-brand-700">
                            <Square size={14} /> Rectangle Highlighter
                        </div>
                    </div>
                    <div className="text-xs text-surface-400 flex items-start gap-1.5 bg-surface-50 p-2 rounded mt-2">
                        <Info size={12} className="mt-0.5 flex-shrink-0" />
                        {logoOverlay.active ? 'Disable logo test to draw annotations.' : 'Click and drag on the image to annotate.'}
                    </div>
                </div>

                {/* Comments list */}
                <div className="p-4 border-b border-surface-100 flex-shrink-0" style={{ maxHeight: 260, overflowY: 'auto' }}>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-semibold text-surface-600 uppercase">Comments</h3>
                        <span className="bg-surface-100 text-surface-600 px-2 py-0.5 rounded-full text-[10px] font-bold">{annotations.length}</span>
                    </div>
                    {annotations.length === 0 ? (
                        <div className="text-center py-6 text-surface-300 text-sm">No annotations yet</div>
                    ) : (
                        <div className="space-y-2">
                            {annotations.map((ann, i) => (
                                <div key={ann.id} className="p-3 bg-white border border-surface-200 rounded-lg text-sm relative pl-4 group hover:border-surface-300 transition-colors">
                                    <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" style={{ backgroundColor: HIGHLIGHT_COLOR }} />
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
                                        <p className="text-xs text-surface-700 leading-relaxed mt-1">{ann.comment}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Brand Checklist */}
                <BrandChecklist overlayState={logoOverlay} onOverlayChange={setLogoOverlay} />

                {/* Actions */}
                <div className="p-4 border-t border-surface-200 space-y-2 flex-shrink-0 mt-auto">
                    <button onClick={handleSaveAnnotations} className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium border border-surface-300 rounded-lg hover:bg-surface-50 transition-colors">
                        <Save size={16} /> Save Annotations
                    </button>
                    <button onClick={handleSaveAsPdf} className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors">
                        <FileDown size={16} /> Save as PDF
                    </button>
                </div>
            </div>

            {/* ── Comment Modal ──────────────────────────────────────────────── */}
            {commentModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ pointerEvents: 'none' }}>
                    <div className="absolute inset-0 bg-black/20" style={{ pointerEvents: 'auto' }} onClick={closeCommentModal} />
                    <div className="relative bg-white rounded-xl shadow-2xl border border-surface-200 p-5 w-[340px] animate-fade-in" style={{ pointerEvents: 'auto' }}>
                        <h3 className="text-sm font-semibold text-surface-700 mb-3">{editingId ? 'Edit Comment' : 'Add Comment'}</h3>
                        <textarea
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            className="w-full h-24 p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                            placeholder="Describe the issue..."
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleCommentSave(); }}
                        />
                        <p className="text-[10px] text-surface-400 mt-1 mb-3">Ctrl+Enter to save</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={closeCommentModal} className="px-3 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-100 rounded-lg">Cancel</button>
                            <button onClick={handleCommentSave} disabled={!comment.trim()} className="px-3 py-1.5 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-50">
                                {editingId ? 'Update' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
