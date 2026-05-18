import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { getReviewById } from '../services/localStore';
import { Review, Annotation } from '../types';
import { ArrowLeft, Download, Mail } from 'lucide-react';
import html2canvas from 'html2canvas';

const HIGHLIGHT_COLOR = '#6366f1';

export default function ViewReviewedPage() {
    const { reviewId } = useParams<{ reviewId: string }>();
    const storeData = useStore();
    const navigate = useNavigate();
    const viewerRef = useRef<HTMLDivElement>(null);

    const [review, setReview] = useState<Review | null>(null);
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (reviewId) {
            const r = getReviewById(reviewId);
            if (r) { setReview(r); setAnnotations(r.annotations || []); }
            setLoading(false);
        }
    }, [reviewId, storeData]);

    const handleDownloadImage = async () => {
        if (!viewerRef.current || !review) return;
        try {
            const canvas = await html2canvas(viewerRef.current, { scale: 2, useCORS: true, logging: false, backgroundColor: '#fff' });
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = `${review.title}_reviewed.png`;
            link.click();
        } catch (err) { console.error(err); alert('Export failed'); }
    };

    const handleEmailDesigner = () => {
        if (!review) return;
        const subject = encodeURIComponent(`Brand Review: ${review.title} — Review Complete`);
        const body = `Hi ${review.designer_name},\n\nThe brand review for "${review.title}" (Job: ${review.job_id}) has been completed.\n\nTotal Annotations: ${annotations.length}\n\nPlease find the reviewed image attached.\n\nBest regards`;
        window.open(`mailto:${review.designer_email || ''}?subject=${subject}&body=${encodeURIComponent(body)}`, '_blank');
    };

    if (loading) return <div className="flex items-center justify-center h-screen"><i className="pi pi-spin pi-spinner text-4xl text-brand-600" /></div>;
    if (!review) return (
        <div className="flex flex-col items-center justify-center h-screen text-surface-500">
            <p>Review not found.</p>
            <button onClick={() => navigate('/')} className="mt-4 text-brand-600 hover:underline">Go to Dashboard</button>
        </div>
    );

    return (
        <div className="flex h-[calc(100vh-57px)]">
            {/* Viewer */}
            <div className="flex-1 relative bg-surface-100 overflow-auto p-6 flex items-start justify-center">
                <div ref={viewerRef} className="relative inline-block bg-white shadow-card select-none">
                    {review.fileBlobUrl
                        ? <img src={review.fileBlobUrl} alt="Review" className="max-w-full h-auto pointer-events-none" />
                        : <div className="p-8 text-surface-400">File not available in this session</div>
                    }
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        {annotations.map((ann, idx) => (
                            <div
                                key={ann.id}
                                className="absolute border-2"
                                style={{
                                    left: `${ann.x}%`, top: `${ann.y}%`,
                                    width: `${ann.width}%`, height: `${ann.height}%`,
                                    borderRadius: 4,
                                    borderColor: HIGHLIGHT_COLOR,
                                    backgroundColor: `${HIGHLIGHT_COLOR}22`,
                                }}
                            >
                                <div className="absolute -top-2 -left-2 w-5 h-5 flex items-center justify-center text-white text-[10px] font-bold rounded-full shadow-sm bg-surface-900">
                                    {idx + 1}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Sidebar */}
            <div className="w-80 bg-white border-l border-surface-200 flex flex-col h-full shadow-lg">
                <div className="p-4 border-b border-surface-100 bg-surface-50">
                    <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 mb-2">
                        <ArrowLeft size={14} /> Back
                    </button>
                    <h2 className="text-base font-bold text-surface-800 truncate">{review.title}</h2>
                    <p className="text-xs text-surface-400 mt-0.5">Job: {review.job_id} · By: {review.designer_name}</p>
                    <span className="mt-1 inline-block text-[10px] font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Reviewed</span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-semibold text-surface-600 uppercase">Annotations</h3>
                        <span className="bg-surface-100 text-surface-600 px-2 py-0.5 rounded-full text-[10px] font-bold">{annotations.length}</span>
                    </div>
                    {annotations.length === 0 ? (
                        <div className="text-center py-8 text-surface-300 text-sm">No annotations</div>
                    ) : (
                        annotations.map((ann, i) => (
                            <div key={ann.id} className="p-3 rounded-lg border bg-white border-surface-200 text-sm relative pl-4">
                                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" style={{ backgroundColor: HIGHLIGHT_COLOR }} />
                                <span className="text-[10px] font-bold text-surface-500 block mb-1">#{i + 1}</span>
                                {ann.comment && <p className="text-xs leading-relaxed text-surface-700">{ann.comment}</p>}
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-surface-200 space-y-2">
                    {review.fileBlobUrl && (
                        <button onClick={handleDownloadImage} className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium border border-surface-300 rounded-lg hover:bg-surface-50 transition-colors">
                            <Download size={16} /> Download Image
                        </button>
                    )}
                    <div className="relative group">
                        <button onClick={handleEmailDesigner} className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors">
                            <Mail size={16} /> Email to Designer
                        </button>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-surface-900 text-white text-xs p-2.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 text-center">
                            Tip: Download the reviewed image first, then attach it to the email manually.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
