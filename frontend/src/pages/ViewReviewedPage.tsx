import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { getReviewById } from '../services/localStore';
import { Review, Annotation, Severity, ShapeType } from '../types';
import { ArrowLeft, Download, Mail } from 'lucide-react';
import { PDFDocument, rgb, PDFString, PDFName } from 'pdf-lib';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

declare global { interface Window { pdfjsLib: any; } }

const SEVERITY_COLORS: Record<Severity, string> = {
    [Severity.MINOR]: '#9ca3af',
    [Severity.MODERATE]: '#f59e0b',
    [Severity.MAJOR]: '#f97316',
    [Severity.CRITICAL]: '#ef4444',
};

export default function ViewReviewedPage() {
    const { reviewId } = useParams<{ reviewId: string }>();
    const storeData = useStore();
    const navigate = useNavigate();
    const viewerRef = useRef<HTMLDivElement>(null);

    const [review, setReview] = useState<Review | null>(null);
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [loading, setLoading] = useState(true);

    // PDF
    const [pdfImageSrc, setPdfImageSrc] = useState<string | null>(null);
    const [isLoadingPdf, setIsLoadingPdf] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [numPages, setNumPages] = useState<number | null>(null);

    useEffect(() => {
        if (reviewId) {
            const r = getReviewById(reviewId);
            if (r) {
                setReview(r);
                setAnnotations(r.annotations || []);
            }
            setLoading(false);
        }
    }, [reviewId, storeData]);

    useEffect(() => {
        if (!review || !review.fileBlobUrl || review.fileType !== 'pdf') return;
        setIsLoadingPdf(true);
        (async () => {
            try {
                if (!window.pdfjsLib) return;
                const response = await fetch(review.fileBlobUrl!);
                const arrayBuffer = await response.arrayBuffer();
                if (arrayBuffer.byteLength === 0) throw new Error('PDF file is empty');
                const loadingTask = window.pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
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
    }, [review, currentPage]);

    const isPdf = review?.fileType === 'pdf';
    const visibleAnnotations = annotations.filter(a => isPdf ? (a.pageNumber || 1) === currentPage : true);

    const handleSaveAsPdf = async () => {
        if (!viewerRef.current || !review) return;
        try {
            if (isPdf && review.fileBlobUrl) {
                const response = await fetch(review.fileBlobUrl);
                const arrayBuffer = await response.arrayBuffer();
                if (!arrayBuffer || arrayBuffer.byteLength === 0) throw new Error('PDF file is empty');
                const pdfDoc = await PDFDocument.load(new Uint8Array(arrayBuffer));
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
                            const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                            return m ? { r: parseInt(m[1], 16) / 255, g: parseInt(m[2], 16) / 255, b: parseInt(m[3], 16) / 255 } : { r: 1, g: 0, b: 0 };
                        };
                        const c = hexToRgb(SEVERITY_COLORS[ann.severity]);
                        page.drawRectangle({ x: rX, y: rY, width: rW, height: rH, borderColor: rgb(c.r, c.g, c.b), borderWidth: 2, color: rgb(c.r, c.g, c.b), opacity: 0.2, borderOpacity: 1 });
                        const combinedText = [ann.predefined_comment, ann.comment].filter(Boolean).join('\n\n');
                        const fullComment = combinedText ? `${ann.error_category || 'Comment'} - ${combinedText}` : (ann.error_category || 'Comment');
                        const annotObj = pdfDoc.context.obj({ Type: 'Annot', Subtype: 'Text', Rect: [rX, rY, rX + rW, rY + rH], Contents: PDFString.of(fullComment || ''), T: PDFString.of(ann.severity + ' Comment'), Open: false, Name: PDFName.of('Note') });
                        page.node.addAnnot(pdfDoc.context.register(annotObj));
                    }
                });
                const pdfBytes = await pdfDoc.save();
                const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `${review.title}_reviewed.pdf`;
                link.click();
                URL.revokeObjectURL(link.href);
            } else if (review.fileBlobUrl) {
                const canvas = await html2canvas(viewerRef.current, { scale: 2, useCORS: true, logging: false, backgroundColor: '#fff' });
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? 'l' : 'p', unit: 'px', format: [canvas.width, canvas.height] });
                pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
                pdf.save(`${review.title}_reviewed.pdf`);
            }
        } catch (err) { console.error(err); alert('PDF export failed'); }
    };

    const handleEmailDesigner = () => {
        if (!review) return;
        const score = review.score;
        const subject = encodeURIComponent(`DocuReview: ${review.title} — Review Complete`);
        let body = `Hi ${review.designer_name},\n\nThe review for "${review.title}" (Job: ${review.job_id}) has been completed.\n\n`;
        if (score) {
            body += `--- SCORE SUMMARY ---\n`;
            body += `Quality:          ${score.quality}\n`;
            body += `Complexity:       ${score.complexity}x\n`;
            body += `FTP Band:         ${score.ftp}\n`;
            body += `Design:           ${score.design}\n`;
            body += `Repeat Offence:   ${score.repeat_offence}x\n`;
            body += `─────────────────────\n`;
            body += `Composite Score:  ${score.composite_score.toFixed(2)}\n\n`;
        }
        body += `Total Annotations: ${annotations.length}\n\n`;
        body += `Please find the reviewed PDF attached.\n\nBest regards`;
        window.open(`mailto:${review.designer_email || ''}?subject=${subject}&body=${encodeURIComponent(body)}`, '_blank');
    };

    if (loading) return <div className="flex items-center justify-center h-screen"><i className="pi pi-spin pi-spinner text-4xl text-brand-600" /></div>;
    if (!review) return <div className="flex flex-col items-center justify-center h-screen text-surface-500"><p>Review not found.</p><button onClick={() => navigate('/')} className="mt-4 text-brand-600 hover:underline">Go to Dashboard</button></div>;

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
                        review.fileBlobUrl ? <img src={review.fileBlobUrl} alt="Review" className="max-w-full h-auto pointer-events-none" /> : <div className="p-8 text-surface-400">File not available in this session</div>
                    )}

                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        {visibleAnnotations.map((ann, idx) => (
                            <div
                                key={ann.id}
                                className="absolute border-2 shadow-sm"
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
                    <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 mb-2"><ArrowLeft size={14} /> Back</button>
                    <h2 className="text-base font-bold text-surface-800 truncate">{review.title}</h2>
                    <p className="text-xs text-surface-400 mt-0.5">Job: {review.job_id} · By: {review.designer_name}</p>
                    {review.score && (
                        <div className="mt-2 p-2 bg-brand-50 rounded-lg border border-brand-200">
                            <p className="text-xs font-semibold text-brand-700">Score: {review.score.composite_score.toFixed(2)}</p>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {annotations.length === 0 ? (
                        <div className="text-center py-8 text-surface-300 text-sm">No annotations</div>
                    ) : (
                        annotations.map((ann, i) => (
                            <div key={ann.id} className="p-3 rounded-lg border bg-white border-surface-200 text-sm relative pl-4">
                                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" style={{ backgroundColor: SEVERITY_COLORS[ann.severity] }} />
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-bold text-surface-500">#{i + 1}</span>
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SEVERITY_COLORS[ann.severity] }} />
                                    <span className="text-[10px] text-surface-400 capitalize">{ann.severity.toLowerCase()} · {ann.error_category}</span>
                                </div>
                                <>
                                    {ann.predefined_comment && <div className="font-semibold text-brand-700 bg-brand-50 p-1.5 rounded mb-1 border border-brand-100 italic flex text-[11px]">"{ann.predefined_comment}"</div>}
                                    {ann.comment && <p className="text-xs leading-relaxed text-surface-700">{ann.comment}</p>}
                                </>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-surface-200 space-y-2">
                    {review.fileBlobUrl && (
                        <button onClick={handleSaveAsPdf} className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium border border-surface-300 rounded-lg hover:bg-surface-50 transition-colors">
                            <Download size={16} /> Save as PDF
                        </button>
                    )}
                    <div className="relative group">
                        <button onClick={handleEmailDesigner} className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors">
                            <Mail size={16} /> Email to Designer
                        </button>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-surface-900 text-white text-xs p-2.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 text-center">
                            Tip: Download the reviewed PDF first, then attach it to the email manually.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
