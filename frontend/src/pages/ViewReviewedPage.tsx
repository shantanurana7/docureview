import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { getReviewById } from '../services/localStore';
import { Review, Annotation, SimpleTestKey, StyleOption, CommittedTestResult } from '../types';
import { ArrowLeft, Download, Mail, Send, FileDown } from 'lucide-react';
import html2canvas from 'html2canvas';
import { PDFDocument, rgb, PDFName, PDFString } from 'pdf-lib';

const HIGHLIGHT_COLOR = '#1e49e2';

const SIMPLE_TEST_LABELS: Record<SimpleTestKey, string> = {
    gradient:         'Gradient',
    portraits:        'Portraits',
    diversity:        'Diversity',
    body_copy_arial:  'Body copy text Arial',
    copyright:        'Copyright',
    colors:           'Colors',
    window_bg_colors: 'Available window and background colors',
    type_in_window:   'Type and messages placed within the window',
    bg_3_colors:      'Background – 3 colors to appear',
    image_breakout:   'Image breaking out of the window (12 ways)',
    neutral_image:    'The window always has a neutral-toned image with pops of color',
};

const TEST_MATRIX: Record<StyleOption, Record<string, boolean>> = {
    'style1.1': { logo_space:true, typography:true, window_motif:true, text_clear_space:true, gradient:true,  portraits:true,  diversity:true,  body_copy_arial:true, copyright:true, colors:true, window_bg_colors:false, type_in_window:false, bg_3_colors:false, image_breakout:false, neutral_image:false },
    'style1.2': { logo_space:true, typography:true, window_motif:true, text_clear_space:true, gradient:true,  portraits:false, diversity:false, body_copy_arial:true, copyright:true, colors:true, window_bg_colors:false, type_in_window:false, bg_3_colors:false, image_breakout:false, neutral_image:false },
    'style2':   { logo_space:true, typography:true, window_motif:true, text_clear_space:true, gradient:true,  portraits:false, diversity:false, body_copy_arial:true, copyright:true, colors:true, window_bg_colors:true,  type_in_window:true,  bg_3_colors:false, image_breakout:false, neutral_image:false },
    'style3.1': { logo_space:true, typography:true, window_motif:true, text_clear_space:true, gradient:true,  portraits:false, diversity:true,  body_copy_arial:true, copyright:true, colors:true, window_bg_colors:false, type_in_window:false, bg_3_colors:true,  image_breakout:true,  neutral_image:false },
    'style3.2': { logo_space:true, typography:true, window_motif:true, text_clear_space:true, gradient:true,  portraits:false, diversity:false, body_copy_arial:true, copyright:true, colors:true, window_bg_colors:false, type_in_window:false, bg_3_colors:true,  image_breakout:true,  neutral_image:false },
    'style4':   { logo_space:true, typography:true, window_motif:true, text_clear_space:true, gradient:true,  portraits:false, diversity:true,  body_copy_arial:true, copyright:true, colors:true, window_bg_colors:false, type_in_window:false, bg_3_colors:false, image_breakout:false, neutral_image:true  },
    'style5':   { logo_space:true, typography:true, window_motif:false,text_clear_space:true, gradient:false, portraits:false, diversity:false, body_copy_arial:true, copyright:true, colors:true, window_bg_colors:false, type_in_window:false, bg_3_colors:false, image_breakout:false, neutral_image:false },
};

export default function ViewReviewedPage() {
    const { reviewId } = useParams<{ reviewId: string }>();
    const storeData = useStore();
    const navigate = useNavigate();
    const viewerRef = useRef<HTMLDivElement>(null);

    const [review, setReview] = useState<Review | null>(null);
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [loading, setLoading] = useState(true);

    const isPdf = review?.fileType === 'pdf';

    useEffect(() => {
        if (reviewId) {
            const r = getReviewById(reviewId);
            if (r) { setReview(r); setAnnotations(r.annotations || []); }
            setLoading(false);
        }
    }, [reviewId, storeData]);

    const buildAllTestResults = () => {
        if (!review) return [];
        const rows: { label: string; result: CommittedTestResult | null }[] = [];
        rows.push({ label: 'Logo size and safe zone', result: review.savedLogoResult || null });
        rows.push({ label: 'Window motif size and ratio', result: review.savedMotifResult || null });
        rows.push({ label: 'Dimensions for selected platform', result: review.savedSizeResult || null });
        rows.push({ label: 'Typography rules', result: review.savedTypographyResult || null });
        rows.push({ label: 'Text clear space margin', result: review.savedTextClearResult || null });

        const simpleKeys = Object.keys(SIMPLE_TEST_LABELS) as (keyof typeof SIMPLE_TEST_LABELS)[];
        for (const k of simpleKeys) {
            if (review.style && TEST_MATRIX[review.style as StyleOption]?.[k]) {
                rows.push({ label: SIMPLE_TEST_LABELS[k], result: review.savedSimpleTests?.[k as SimpleTestKey] ?? null });
            }
        }
        return rows;
    };

    const handleSaveAsPdf = async () => {
        if (!viewerRef.current || !review) return;
        try {
            const canvasEl = await html2canvas(viewerRef.current, { scale: 2, useCORS: true, logging: false, backgroundColor: '#fff' });

            const imgDataUrl = canvasEl.toDataURL('image/png');
            const base64 = imgDataUrl.split(',')[1];
            const imgBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
            const canvasW = canvasEl.width; const canvasH = canvasEl.height;

            const pdfDocLib = await PDFDocument.create();
            const { StandardFonts } = await import('pdf-lib');
            const regFont  = await pdfDocLib.embedFont(StandardFonts.Helvetica);
            const boldFont = await pdfDocLib.embedFont(StandardFonts.HelveticaBold);

            // Page 1: Annotated image
            const imgPage = pdfDocLib.addPage([canvasW, canvasH]);
            const pngImage = await pdfDocLib.embedPng(imgBytes);
            imgPage.drawImage(pngImage, { x: 0, y: 0, width: canvasW, height: canvasH });

            const hexToRgb = (hex: string) => {
                const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return m ? { r: parseInt(m[1], 16) / 255, g: parseInt(m[2], 16) / 255, b: parseInt(m[3], 16) / 255 } : { r: 0.4, g: 0.4, b: 1 };
            };
            const annColor = hexToRgb(HIGHLIGHT_COLOR);

            annotations.forEach((ann, i) => {
                const ax = (ann.x / 100) * canvasW;
                const aw = (ann.width / 100) * canvasW;
                const ah = (ann.height / 100) * canvasH;
                const ay = canvasH - ((ann.y / 100) * canvasH) - ah;

                imgPage.drawRectangle({
                    x: ax, y: ay, width: aw, height: ah,
                    borderColor: rgb(annColor.r, annColor.g, annColor.b),
                    borderWidth: 4,
                    color: rgb(annColor.r, annColor.g, annColor.b),
                    opacity: 0.12,
                    borderOpacity: 1,
                });

                const badgeR = 14;
                const badgeCx = ax + badgeR + 2;
                const badgeCy = ay + ah - badgeR - 2;
                imgPage.drawCircle({ x: badgeCx, y: badgeCy, size: badgeR, color: rgb(0.12, 0.27, 0.89) });
                const numStr = String(i + 1);
                imgPage.drawText(numStr, {
                    x: badgeCx - (numStr.length > 1 ? 7 : 4),
                    y: badgeCy - 5,
                    size: 10, font: boldFont, color: rgb(1, 1, 1),
                });

                const annotRef = pdfDocLib.context.register(
                    pdfDocLib.context.obj({
                        Type:     PDFName.of('Annot'),
                        Subtype:  PDFName.of('Text'),
                        Name:     PDFName.of('Comment'),
                        Rect:     [badgeCx - badgeR, badgeCy - badgeR, badgeCx + badgeR, badgeCy + badgeR],
                        Contents: PDFString.of(`#${i + 1}: ${ann.comment || '(no comment)'}`),
                        T:        PDFString.of('Brand Reviewer'),
                        Subj:     PDFString.of('Comment'),
                        Open:     false,
                        F:        28,
                        C:        [annColor.r, annColor.g, annColor.b],
                        P:        imgPage.ref,
                    })
                );
                imgPage.node.addAnnot(annotRef);
            });

            const acroForm = pdfDocLib.context.obj({ NeedAppearances: true });
            pdfDocLib.catalog.set(PDFName.of('AcroForm'), pdfDocLib.context.register(acroForm));

            if (!isPdf && review.style) {
                const allTestRows = buildAllTestResults();
                let noteIndex = 0;
                allTestRows.forEach(({ label, result }) => {
                    if (!result) return;
                    const status = result.result === 'ok' ? 'OK' : 'NOT OK';
                    const body = result.comment ? `${label} — ${status}:\n${result.comment}` : `${label} — ${status}`;
                    const noteY = canvasH - 40 - noteIndex * 35;
                    const noteColor = result.result === 'ok' ? { r: 0.1, g: 0.65, b: 0.2 } : { r: 0.88, g: 0.18, b: 0.18 };
                    
                    const ref = pdfDocLib.context.register(pdfDocLib.context.obj({
                        Type:     PDFName.of('Annot'),
                        Subtype:  PDFName.of('Text'),
                        Name:     PDFName.of('Comment'),
                        Rect:     [20, noteY, 50, noteY + 30],
                        Contents: PDFString.of(body),
                        T:        PDFString.of('Brand Test Result'),
                        Open:     false,
                        F:        28,
                        C:        [noteColor.r, noteColor.g, noteColor.b],
                        P:        imgPage.ref,
                    }));
                    imgPage.node.addAnnot(ref);
                    noteIndex++;
                });
            }

            // Page 2+: Summary
            const A4W = 1190; const A4H = 1684; const M = 80; const IW = A4W - 2 * M;

            const wrapText = (text: string, maxPx: number, ptSize: number): string[] => {
                const charsPerLine = Math.floor(maxPx / (ptSize * 0.55));
                const words = text.split(' '); const lines: string[] = []; let cur = '';
                for (const w of words) {
                    const candidate = cur ? `${cur} ${w}` : w;
                    if (candidate.length > charsPerLine && cur) { lines.push(cur); cur = w; } else cur = candidate;
                }
                if (cur) lines.push(cur);
                return lines.length ? lines : [''];
            };

            let activePage = pdfDocLib.addPage([A4W, A4H]);
            let sy = A4H - M;

            const ensureSpace = (needed: number) => {
                if (sy < M + needed) {
                    activePage = pdfDocLib.addPage([A4W, A4H]);
                    sy = A4H - M;
                }
            };

            const dt = (text: string, opts: { sz?: number; bold?: boolean; col?: [number, number, number]; indent?: number } = {}) => {
                const { sz = 20, bold = false, col = [0.12, 0.12, 0.12], indent = 0 } = opts;
                ensureSpace(sz + 14);
                const safeText = (text || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
                if (!safeText.trim()) { sy -= sz + 8; return; }
                activePage.drawText(safeText, { x: M + indent, y: sy, size: sz, font: bold ? boldFont : regFont, color: rgb(col[0], col[1], col[2]) });
                sy -= sz + 10;
            };

            const drawHRule = () => {
                ensureSpace(28);
                activePage.drawLine({ start: { x: M, y: sy + 4 }, end: { x: A4W - M, y: sy + 4 }, thickness: 2, color: rgb(0.82, 0.82, 0.82) });
                sy -= 18;
            };

            activePage.drawRectangle({ x: 0, y: A4H - 160, width: A4W, height: 160, color: rgb(0.12, 0.27, 0.89) });
            activePage.drawText('BRAND REVIEW SUMMARY', { x: M, y: A4H - 52, size: 36, font: boldFont, color: rgb(1, 1, 1) });
            activePage.drawText(review.title, { x: M, y: A4H - 90, size: 22, font: regFont, color: rgb(0.78, 0.87, 1) });
            activePage.drawText(`Job: ${review.job_id}   Requester: ${review.requester_name}`, { x: M, y: A4H - 118, size: 17, font: regFont, color: rgb(0.6, 0.75, 1) });
            const metaLine2Parts = [
                review.reviewed_by ? `Reviewed by: ${review.reviewed_by}` : '',
                review.asset_produced_by ? `Asset produced by: ${review.asset_produced_by}` : '',
                review.number_of_pages != null ? `Pages: ${review.number_of_pages}` : '',
            ].filter(Boolean).join('   ');
            if (metaLine2Parts) {
                activePage.drawText(metaLine2Parts, { x: M, y: A4H - 146, size: 15, font: regFont, color: rgb(0.55, 0.7, 1) });
            }
            sy = A4H - 190;

            if (review.style) {
                dt(`Style: ${review.style}`, { sz: 16, col: [0.4, 0.5, 0.9] });
            }
            sy -= 10;

            dt('ANNOTATION COMMENTS', { sz: 24, bold: true, col: [0.12, 0.27, 0.89] });
            drawHRule();
            if (annotations.length === 0) {
                dt('No annotation comments added.', { sz: 18, col: [0.55, 0.55, 0.55] });
            } else {
                annotations.forEach((ann, i) => {
                    const prefix = isPdf ? `p${ann.pageNumber} · ${i + 1}.  ` : `${i + 1}.  `;
                    const lines  = wrapText(ann.comment || '(no comment)', IW - 32, 18);
                    dt(`${prefix}${lines[0]}`, { sz: 18 });
                    for (let l = 1; l < lines.length; l++) dt(lines[l], { sz: 18, indent: 32 });
                    sy -= 4;
                });
            }
            sy -= 20;

            if (!isPdf && review.style) {
                dt('BRAND TEST RESULTS', { sz: 24, bold: true, col: [0.12, 0.27, 0.89] });
                drawHRule();
                const allTestRows = buildAllTestResults();
                for (const row of allTestRows) {
                    if (!row.result) {
                        dt(`${row.label}:  Not Tested`, { sz: 18, col: [0.55, 0.55, 0.55] });
                    } else {
                        if (row.result.result === 'ok') {
                            dt(`${row.label}:  YES / OK`, { sz: 18, bold: true, col: [0.07, 0.52, 0.2] });
                        } else {
                            dt(`${row.label}:  NO / NOT OK`, { sz: 18, bold: true, col: [0.78, 0.1, 0.1] });
                        }
                        if (row.result.comment) {
                            const lines = wrapText(row.result.comment, IW - 50, 16);
                            for (const line of lines) dt(line, { sz: 16, indent: 32, col: [0.48, 0.08, 0.08] });
                        }
                    }
                    sy -= 4;
                }
            }

            const pdfBytes = await pdfDocLib.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${review.title}_brand-review.pdf`;
            link.click();
            URL.revokeObjectURL(link.href);
        } catch (err) {
            console.error(err);
            alert('PDF export failed: ' + String(err));
        }
    };

    const buildMailtoBody = () => {
        if (!review) return '';
        let b = `Hi ${review.requester_name},\n\nThe brand review for "${review.title}" (Job: ${review.job_id}) has been completed.\n\n`;
        b += `Total Annotations: ${annotations.length}\n`;
        if (review.reviewed_by) b += `Reviewed by: ${review.reviewed_by}\n`;
        if (review.asset_produced_by) b += `Asset produced by: ${review.asset_produced_by}\n`;
        if (review.number_of_pages != null) b += `Number of pages: ${review.number_of_pages}\n`;
        if (review.testScore && review.testScore !== 'NA') b += `Brand Test Score: ${review.testScore}\n`;
        b += `\nPlease find the reviewed PDF attached (save it using the "Save PDF" button).\n\nBest regards`;
        return encodeURIComponent(b);
    };

    const handleEmailRequester = () => {
        if (!review) return;
        const subject = encodeURIComponent(`Brand Review: ${review.title} — Review Complete`);
        const body = buildMailtoBody();
        window.open(`mailto:${review.requester_email || ''}?subject=${subject}&body=${body}`, '_blank');
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
                    <p className="text-xs text-surface-400 mt-0.5">Job: {review.job_id} · By: {review.requester_name}</p>
                    {review.reviewed_by && <p className="text-xs text-surface-400">Reviewed by: {review.reviewed_by}</p>}
                    <span className="mt-1 inline-block text-[10px] font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Reviewed</span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Annotations Section */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-semibold text-surface-600 uppercase">Annotations</h3>
                            <span className="bg-surface-100 text-surface-600 px-2 py-0.5 rounded-full text-[10px] font-bold">{annotations.length}</span>
                        </div>
                        {annotations.length === 0 ? (
                            <div className="text-center py-4 text-surface-400 text-sm italic border rounded-lg bg-surface-50 border-surface-200">No annotations</div>
                        ) : (
                            <div className="space-y-2">
                                {annotations.map((ann, i) => (
                                    <div key={ann.id} className="p-3 rounded-lg border bg-white border-surface-200 text-sm relative pl-4">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" style={{ backgroundColor: HIGHLIGHT_COLOR }} />
                                        <span className="text-[10px] font-bold text-surface-500 block mb-1">#{i + 1}</span>
                                        {ann.comment && <p className="text-xs leading-relaxed text-surface-700">{ann.comment}</p>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Brand Test Results Section */}
                    {!isPdf && review.style && (
                        <div>
                            <div className="flex items-center justify-between mb-2 mt-4 pt-4 border-t border-surface-200">
                                <h3 className="text-xs font-semibold text-surface-600 uppercase">Test Scenarios</h3>
                                {review.testScore && <span className="bg-surface-100 text-surface-600 px-2 py-0.5 rounded-full text-[10px] font-bold">{review.testScore}</span>}
                            </div>
                            <div className="space-y-2">
                                {buildAllTestResults().map((row, i) => (
                                    <div key={i} className="p-2.5 rounded border border-surface-200 bg-surface-50">
                                        <div className="flex justify-between items-start gap-2">
                                            <span className="text-xs text-surface-700 leading-tight flex-1">{row.label}</span>
                                            {row.result?.result === 'ok' ? (
                                                <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">YES</span>
                                            ) : row.result?.result === 'not_ok' ? (
                                                <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">NO</span>
                                            ) : (
                                                <span className="text-[10px] font-semibold text-surface-500 italic px-1.5 py-0.5">N/A</span>
                                            )}
                                        </div>
                                        {row.result?.comment && (
                                            <p className="mt-1.5 pt-1.5 border-t border-surface-200 text-[10px] text-red-700 leading-relaxed italic bg-white p-1 rounded">
                                                {row.result.comment}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-surface-200 space-y-2">
                    {review.fileBlobUrl && (
                        <button onClick={handleSaveAsPdf} className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium border border-surface-300 rounded-lg hover:bg-surface-50 transition-colors">
                            <FileDown size={16} /> Save PDF
                        </button>
                    )}
                    <div className="relative group">
                        <button onClick={handleEmailRequester} className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors">
                            <Send size={16} /> Send to Requester
                        </button>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-surface-900 text-white text-xs p-2.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 text-center">
                            Tip: Generate the PDF first, then attach it to the email manually.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
