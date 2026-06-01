import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { getReviewById, updateAnnotations } from '../services/localStore';
import { Review, Annotation, ShapeType } from '../types';
import { ArrowLeft, Square, Save, FileDown, Trash2, Pencil, Check, X, Info, RotateCcw, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import html2canvas from 'html2canvas';
import { PDFDocument, PDFName, PDFString, rgb } from 'pdf-lib';
import BrandChecklist, { LogoOverlayState, CommittedTestResult } from '../components/review/BrandChecklist';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

const HIGHLIGHT_COLOR = '#1e49e2';
const LOGO_BLUE_SRC = '/KPMG_blue_logo.svg';
// SVG viewBox: 80.58 × 32.08 → aspect ratio ≈ 2.514 : 1
const LOGO_ASPECT = 80.58 / 32.08; // ≈ 2.514
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
    const [logoOverlay, setLogoOverlay] = useState<LogoOverlayState>({ activeTest: null, pos: { x: 0, y: 0 }, scale: 1, opacity: 1, windowRatio: '7:10', testResult: null, testComment: '' });
    // Separately committed test results — only populated after the user clicks "Save Result"
    const [savedLogoResult, setSavedLogoResult] = useState<CommittedTestResult | null>(null);
    const [savedMotifResult, setSavedMotifResult] = useState<CommittedTestResult | null>(null);
    const [savedSizeResult, setSavedSizeResult] = useState<CommittedTestResult | null>(null);
    // Natural pixel dimensions of the uploaded image (set on img onLoad)
    const [imageDimensions, setImageDimensions] = useState<{ w: number; h: number } | null>(null);
    // When true, logo is hidden so html2canvas excludes it from the PDF capture
    const [logoHiddenForCapture, setLogoHiddenForCapture] = useState(false);
    // Active logo src (blue or white)
    const [logoSrc, setLogoSrc] = useState(LOGO_BLUE_SRC);
    // Incremented on "Reset All" to force BrandChecklist remount (clears its internal state)
    const [brandChecklistKey, setBrandChecklistKey] = useState(0);
    const logoDragging = useRef(false);
    const logoDragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });

    // ── PDF state ─────────────────────────────────────────────────────────────
    const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [pageImageUrl, setPageImageUrl] = useState<string | null>(null);
    const [pageRendering, setPageRendering] = useState(false);
    // Jump-to-page input value
    const [jumpInput, setJumpInput] = useState('1');

    const isPdf = review?.fileType === 'pdf';

    useEffect(() => {
        if (reviewId) {
            const r = getReviewById(reviewId);
            if (r) {
                setReview(r);
                setAnnotations(r.annotations || []);
                if (r.fileType === 'pdf' && r.totalPages) {
                    setTotalPages(r.totalPages);
                }
            }
            setLoading(false);
        }
    }, [reviewId, storeData]);

    // ── Load pdfjs document once when review is ready ─────────────────────────
    useEffect(() => {
        if (!review || review.fileType !== 'pdf' || !review.fileBlobUrl) return;

        let cancelled = false;
        (async () => {
            try {
                const resp = await fetch(review.fileBlobUrl!);
                const arrayBuffer = await resp.arrayBuffer();
                const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                if (!cancelled) {
                    setPdfDoc(doc);
                    setTotalPages(doc.numPages);
                    setCurrentPage(1);
                    setJumpInput('1');
                }
            } catch (err) {
                console.error('Failed to load PDF:', err);
            }
        })();
        return () => { cancelled = true; };
    }, [review?.id, review?.fileBlobUrl]);

    // ── Render a specific PDF page to an image URL ────────────────────────────
    useEffect(() => {
        if (!pdfDoc) return;

        let cancelled = false;
        setPageRendering(true);

        (async () => {
            try {
                const page = await pdfDoc.getPage(currentPage);
                const viewport = page.getViewport({ scale: 1.8 });
                const canvas = document.createElement('canvas');
                canvas.width  = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d')!;
                await page.render({ canvasContext: ctx, viewport }).promise;
                if (!cancelled) {
                    const url = canvas.toDataURL('image/png');
                    setPageImageUrl(prev => {
                        if (prev) URL.revokeObjectURL(prev);
                        return url;
                    });
                    setImageDimensions({ w: canvas.width, h: canvas.height });
                    setPageRendering(false);
                }
            } catch (err) {
                if (!cancelled) { console.error('Page render error:', err); setPageRendering(false); }
            }
        })();

        return () => { cancelled = true; };
    }, [pdfDoc, currentPage]);

    // Sync jump input when page changes via buttons
    useEffect(() => { setJumpInput(String(currentPage)); }, [currentPage]);

    const goToPage = (page: number) => {
        const clamped = Math.max(1, Math.min(totalPages, page));
        setCurrentPage(clamped);
    };

    const handleJumpInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setJumpInput(e.target.value);
    };

    const handleJumpCommit = () => {
        const n = parseInt(jumpInput, 10);
        if (!isNaN(n)) goToPage(n);
        else setJumpInput(String(currentPage));
    };

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
        if (!review || commentModalOpen || logoOverlay.activeTest !== null) return;
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
                pageNumber: isPdf ? currentPage : 1,
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

    // Annotations visible on the current page/view
    const visibleAnnotations = isPdf
        ? annotations.filter(a => a.pageNumber === currentPage)
        : annotations;

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
            let groupW = LOGO_BASE_W * logoOverlay.scale;
            let groupH = 0;
            if (logoOverlay.activeTest === 'logo') {
                const scaledH = Math.round(groupW / LOGO_ASPECT);
                groupH = scaledH * 3;
            } else {
                groupH = logoOverlay.windowRatio === '7:10' ? groupW * (10/7) : groupW * (7/10);
            }
            const newX = logoDragStart.current.ox + ev.clientX - logoDragStart.current.mx;
            const newY = logoDragStart.current.oy + ev.clientY - logoDragStart.current.my;
            setLogoOverlay(prev => ({
                ...prev,
                pos: {
                    x: Math.max(0, Math.min(newX, canvasW - groupW)),
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

    // Reset ALL — clears annotations, test results, and remounts BrandChecklist
    const handleResetAll = () => {
        setAnnotations([]);
        setSavedLogoResult(null);
        setSavedMotifResult(null);
        setSavedSizeResult(null);
        setLogoOverlay({ activeTest: null, pos: { x: 0, y: 0 }, scale: 1, opacity: 1, windowRatio: '7:10', testResult: null, testComment: '' });
        setBrandChecklistKey(k => k + 1);
    };

    const handleSaveAsPdf = async () => {
        if (!viewerRef.current || !review) return;
        try {
            // ── Step 1: Capture image WITHOUT logo overlay ─────────────────
            setLogoHiddenForCapture(true);
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            const canvasEl = await html2canvas(viewerRef.current, {
                scale: 2, useCORS: true, logging: false, backgroundColor: '#fff',
            });
            setLogoHiddenForCapture(false);

            const imgDataUrl = canvasEl.toDataURL('image/png');
            const base64 = imgDataUrl.split(',')[1];
            const imgBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
            const canvasW = canvasEl.width;
            const canvasH = canvasEl.height;

            // ── Step 2: Build PDF ─────────────────────────────────────────
            const pdfDoc = await PDFDocument.create();

            const { StandardFonts } = await import('pdf-lib');
            const regFont  = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

            // ── Page 1: Annotated image ───────────────────────────────────
            const imgPage = pdfDoc.addPage([canvasW, canvasH]);
            const pngImage = await pdfDoc.embedPng(imgBytes);
            imgPage.drawImage(pngImage, { x: 0, y: 0, width: canvasW, height: canvasH });

            const hexToRgb = (hex: string) => {
                const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return m
                    ? { r: parseInt(m[1], 16) / 255, g: parseInt(m[2], 16) / 255, b: parseInt(m[3], 16) / 255 }
                    : { r: 0.4, g: 0.4, b: 1 };
            };
            const annColor = hexToRgb(HIGHLIGHT_COLOR);

            // Draw annotation rectangles + sticky notes (custom comments)
            visibleAnnotations.forEach((ann, i) => {
                const ax = (ann.x / 100) * canvasW;
                const aw = (ann.width / 100) * canvasW;
                const ah = (ann.height / 100) * canvasH;
                const ay = canvasH - ((ann.y / 100) * canvasH) - ah;

                imgPage.drawRectangle({
                    x: ax, y: ay, width: aw, height: ah,
                    borderColor: rgb(annColor.r, annColor.g, annColor.b),
                    borderWidth: 3,
                    color:       rgb(annColor.r, annColor.g, annColor.b),
                    opacity: 0.15, borderOpacity: 0.9,
                });
                imgPage.drawCircle({ x: ax + 10, y: ay + ah - 10, size: 10, color: rgb(0.1, 0.1, 0.1) });

                const annotRef = pdfDoc.context.register(pdfDoc.context.obj({
                    Type: 'Annot', Subtype: 'Text', Name: PDFName.of('Comment'),
                    Rect: [ax, ay, ax + aw, ay + ah],
                    Contents: PDFString.of(`#${i + 1}: ${ann.comment || '(no comment)'}`),
                    T: PDFString.of('Brand Reviewer'), Open: false,
                    C: [annColor.r, annColor.g, annColor.b],
                }));
                imgPage.node.addAnnot(annotRef);
            });

            // Native sticky notes for ALL brand test results (OK and NOT OK)
            const brandTestNotes: { label: string; result: CommittedTestResult | null }[] = [
                { label: 'LOGO PLACEMENT', result: savedLogoResult },
                { label: 'WINDOW MOTIF',   result: savedMotifResult },
                { label: 'IMAGE SIZE',     result: savedSizeResult  },
            ];
            brandTestNotes.forEach(({ label, result }, idx) => {
                if (!result) return;
                const status   = result.result === 'ok' ? 'OK' : 'NOT OK';
                const body     = result.comment ? `${label} — ${status}:\n${result.comment}` : `${label} — ${status}`;
                const noteY    = canvasH - 90 - idx * 80;
                const noteColor = result.result === 'ok' ? [0.1, 0.65, 0.2] : [0.88, 0.18, 0.18];
                const ref = pdfDoc.context.register(pdfDoc.context.obj({
                    Type: 'Annot', Subtype: 'Text', Name: PDFName.of('Note'),
                    Rect: [20, noteY, 260, noteY + 70],
                    Contents: PDFString.of(body),
                    T: PDFString.of('Brand Reviewer'), Open: false,
                    C: noteColor,
                }));
                imgPage.node.addAnnot(ref);
            });

            // ── Page 2: Drawn Summary ─────────────────────────────────────
            const A4W = 1190;
            const A4H = 1684;
            const M   = 80;
            const IW  = A4W - 2 * M;

            const wrapText = (text: string, maxPx: number, ptSize: number): string[] => {
                const charsPerLine = Math.floor(maxPx / (ptSize * 0.55));
                const words = text.split(' ');
                const lines: string[] = [];
                let cur = '';
                for (const w of words) {
                    const candidate = cur ? `${cur} ${w}` : w;
                    if (candidate.length > charsPerLine && cur) { lines.push(cur); cur = w; }
                    else cur = candidate;
                }
                if (cur) lines.push(cur);
                return lines.length ? lines : [''];
            };

            const summaryPage = pdfDoc.addPage([A4W, A4H]);
            let sy = A4H - M;

            const dt = (text: string, opts: {
                sz?: number; bold?: boolean;
                col?: [number, number, number]; indent?: number;
            } = {}) => {
                const { sz = 20, bold = false, col = [0.12, 0.12, 0.12], indent = 0 } = opts;
                const safeText = (text || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
                if (!safeText.trim()) { sy -= sz + 8; return; }
                summaryPage.drawText(safeText, {
                    x: M + indent, y: sy,
                    size: sz,
                    font: bold ? boldFont : regFont,
                    color: rgb(col[0], col[1], col[2]),
                });
                sy -= sz + 10;
            };

            const drawHRule = () => {
                summaryPage.drawLine({
                    start: { x: M, y: sy + 4 }, end: { x: A4W - M, y: sy + 4 },
                    thickness: 2, color: rgb(0.82, 0.82, 0.82),
                });
                sy -= 18;
            };

            summaryPage.drawRectangle({ x: 0, y: A4H - 130, width: A4W, height: 130, color: rgb(0.12, 0.27, 0.89) });
            summaryPage.drawText('BRAND REVIEW SUMMARY', { x: M, y: A4H - 52, size: 36, font: boldFont, color: rgb(1, 1, 1) });
            summaryPage.drawText(review.title,  { x: M, y: A4H - 90,  size: 22, font: regFont, color: rgb(0.78, 0.87, 1) });
            summaryPage.drawText(`Job: ${review.job_id}   Designer: ${review.designer_name}`,
                { x: M, y: A4H - 118, size: 17, font: regFont, color: rgb(0.6, 0.75, 1) });
            sy = A4H - 158;

            // ── Annotation Comments ───────────────────────────────────────
            dt('ANNOTATION COMMENTS', { sz: 24, bold: true, col: [0.12, 0.27, 0.89] });
            drawHRule();

            if (annotations.length === 0) {
                dt('No annotation comments added.', { sz: 18, col: [0.55, 0.55, 0.55] });
            } else {
                annotations.forEach((ann, i) => {
                    const commentText = ann.comment || '(no comment)';
                    const prefix  = isPdf ? `p${ann.pageNumber} · ${i + 1}.  ` : `${i + 1}.  `;
                    const lines   = wrapText(commentText, IW - 32, 18);
                    dt(`${prefix}${lines[0]}`, { sz: 18 });
                    for (let l = 1; l < lines.length; l++) {
                        dt(lines[l], { sz: 18, indent: 32 });
                    }
                    sy -= 6;
                });
            }

            sy -= 20;

            // ── Brand Test Results (only for image reviews) ───────────────
            if (!isPdf) {
                dt('BRAND TEST RESULTS', { sz: 24, bold: true, col: [0.12, 0.27, 0.89] });
                drawHRule();

                const resultRows: { label: string; result: CommittedTestResult | null }[] = [
                    { label: 'Logo Placement', result: savedLogoResult },
                    { label: 'Window Motif',   result: savedMotifResult },
                    { label: 'Image Size',     result: savedSizeResult  },
                ];

                for (const row of resultRows) {
                    if (!row.result) {
                        dt(`${row.label}:  Not Tested`, { sz: 20, col: [0.55, 0.55, 0.55] });
                    } else if (row.result.result === 'ok') {
                        dt(`${row.label}:  OK`, { sz: 20, bold: true, col: [0.07, 0.52, 0.2] });
                    } else {
                        dt(`${row.label}:  NOT OK`, { sz: 20, bold: true, col: [0.78, 0.1, 0.1] });
                        if (row.result.comment) {
                            const lines = wrapText(row.result.comment, IW - 50, 17);
                            for (const line of lines) {
                                dt(line, { sz: 17, indent: 32, col: [0.48, 0.08, 0.08] });
                            }
                        }
                    }
                    sy -= 8;
                }
            }

            // ── Step 3: Save ───────────────────────────────────────────────
            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${review.title}_brand-review.pdf`;
            link.click();
            URL.revokeObjectURL(link.href);
        } catch (err) {
            setLogoHiddenForCapture(false);
            console.error(err);
            alert('PDF export failed: ' + String(err));
        }
    };

    // ── Build mailto body with test results ──────────────────────────────────
    const buildMailtoBody = () => {
        const annotationLines = annotations.length > 0
            ? annotations.map((ann, i) => {
                const prefix = isPdf ? `  p${ann.pageNumber} · ${i + 1}.` : `  ${i + 1}.`;
                return `${prefix} ${ann.comment || '(no comment)'}`;
              })
            : ['  (none)'];

        const resultRows: { label: string; result: CommittedTestResult | null }[] = [
            { label: 'Logo Placement', result: savedLogoResult },
            { label: 'Window Motif',   result: savedMotifResult },
            { label: 'Image Size',     result: savedSizeResult  },
        ];

        const testLines = resultRows.map(({ label, result }) => {
            if (!result)                       return `  ${label}: Not Tested`;
            if (result.result === 'ok')        return `  ${label}: OK`;
            const c = result.comment ? ` -- ${result.comment}` : '';
            return `  ${label}: NOT OK${c}`;
        });

        const bodyLines = [
            `Brand Review Report: ${review?.title ?? 'Untitled'}`,
            `Job: ${review?.job_id ?? '-'} | Designer: ${review?.designer_name ?? '-'}`,
            '',
            '--- ANNOTATION COMMENTS ---',
            ...annotationLines,
            ...(!isPdf ? ['', '--- BRAND TEST RESULTS ---', ...testLines] : []),
        ];

        return encodeURIComponent(bodyLines.join('\n'));
    };

    const handleSavePdfAndSend = async () => {
        await handleSaveAsPdf();
        if (!review) return;
        const subject = encodeURIComponent(`Brand Review: ${review.title}`);
        const body = buildMailtoBody();
        window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    };

    // ── Logo sizing (SVG aspect 2.514:1) ─────────────────────────────────────
    const scaledW = LOGO_BASE_W * logoOverlay.scale;
    const scaledH = Math.round(scaledW / LOGO_ASPECT);

    // Window Motif Sizing
    const motifH = logoOverlay.windowRatio === '7:10' ? scaledW * (10/7) : scaledW * (7/10);

    // The image src to display — either the blob url for images, or the rendered page data URL for PDFs
    const displaySrc = isPdf ? pageImageUrl : review?.fileBlobUrl;

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
                    style={{ cursor: logoOverlay.activeTest !== null ? 'default' : 'crosshair', touchAction: 'none' }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={() => isDrawing && setIsDrawing(false)}
                >
                    {/* PDF page rendering spinner */}
                    {isPdf && pageRendering && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white z-50 min-w-[400px] min-h-[300px]">
                            <i className="pi pi-spin pi-spinner text-3xl text-brand-600" />
                        </div>
                    )}

                    {displaySrc
                        ? <img
                            src={displaySrc}
                            alt="Review"
                            className="max-w-full h-auto select-none pointer-events-none"
                            onLoad={(e) => {
                                const img = e.currentTarget as HTMLImageElement;
                                if (!isPdf) setImageDimensions({ w: img.naturalWidth, h: img.naturalHeight });
                            }}
                          />
                        : <div className="p-8 text-danger">{isPdf ? 'Rendering page…' : 'File not available'}</div>
                    }

                    {/* Annotation overlays */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        {visibleAnnotations.map((ann) => (
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
                                    {visibleAnnotations.indexOf(ann) + 1}
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

                    {/* ── Logo Overlays (image-only) ──────────────────── */}
                    {!isPdf && logoOverlay.activeTest !== null && !logoHiddenForCapture && (() => {
                        if (logoOverlay.activeTest === 'logo') {
                            return (
                                <div
                                    onMouseDown={handleLogoDragStart}
                                    style={{
                                        position: 'absolute',
                                        left: logoOverlay.pos.x,
                                        top: logoOverlay.pos.y,
                                        cursor: 'grab',
                                        userSelect: 'none',
                                        zIndex: 40,
                                        width: scaledW,
                                        pointerEvents: 'auto',
                                        opacity: logoOverlay.opacity ?? 1,
                                    }}
                                >
                                    {/* Top logo — horizontal */}
                                    <img src={logoSrc} alt="Logo top" draggable={false}
                                        style={{ width: scaledW, height: scaledH, objectFit: 'contain', display: 'block', marginLeft: scaledH }}
                                    />

                                    {/* Left logo — takes exactly one logo space vertically */}
                                    <div style={{ width: scaledW, height: scaledH, position: 'relative' }}>
                                        <img src={logoSrc} alt="Logo left" draggable={false}
                                            style={{
                                                position: 'absolute',
                                                width: scaledW,
                                                height: scaledH,
                                                objectFit: 'contain',
                                                display: 'block',
                                                transform: 'rotate(90deg)',
                                                transformOrigin: 'center center',
                                                left: -(scaledW - scaledH) / 2,
                                                top: (scaledW / 2) - (1.5 * scaledH),
                                            }}
                                        />
                                    </div>

                                    {/* Bottom logo — horizontal */}
                                    <img src={logoSrc} alt="Logo bottom" draggable={false}
                                        style={{ width: scaledW, height: scaledH, objectFit: 'contain', display: 'block', marginLeft: scaledH }}
                                    />

                                    {/* Drag hint */}
                                    <div style={{
                                        fontSize: 9, color: '#1e49e2', whiteSpace: 'nowrap',
                                        background: 'rgba(255,255,255,0.85)', padding: '1px 5px',
                                        borderRadius: 3, border: '1px solid #99acd4', marginTop: 2,
                                    }}>✥ drag to move</div>
                                </div>
                            );
                        } else if (logoOverlay.activeTest === 'window_motif') {
                            return (
                                <div
                                    onMouseDown={handleLogoDragStart}
                                    style={{
                                        position: 'absolute',
                                        left: logoOverlay.pos.x,
                                        top: logoOverlay.pos.y,
                                        cursor: 'grab',
                                        userSelect: 'none',
                                        zIndex: 40,
                                        width: scaledW,
                                        height: motifH,
                                        pointerEvents: 'auto',
                                        opacity: logoOverlay.opacity ?? 1,
                                        border: '2px solid #1e49e2',
                                        backgroundColor: 'rgba(30, 73, 226, 0.15)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <div style={{
                                        position: 'absolute',
                                        bottom: -20,
                                        left: 0,
                                        fontSize: 9, color: '#1e49e2', whiteSpace: 'nowrap',
                                        background: 'rgba(255,255,255,0.85)', padding: '1px 5px',
                                        borderRadius: 3, border: '1px solid #99acd4'
                                    }}>✥ drag to move</div>
                                </div>
                            );
                        }
                        return null;
                    })()}
                </div>

                {/* ── PDF Pagination Bar ─────────────────────────────────────── */}
                {isPdf && (
                    <div className="mt-4 flex items-center gap-2 bg-white rounded-xl shadow-card border border-surface-200 px-4 py-2.5">
                        {/* Prev button */}
                        <button
                            onClick={() => goToPage(currentPage - 1)}
                            disabled={currentPage <= 1 || pageRendering}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-surface-600 hover:bg-surface-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft size={16} /> Prev
                        </button>

                        <div className="w-px h-5 bg-surface-200 mx-1" />

                        {/* Page input + total */}
                        <div className="flex items-center gap-1.5 text-sm text-surface-600">
                            <span className="text-surface-400 text-xs">Page</span>
                            <input
                                type="number"
                                min={1}
                                max={totalPages}
                                value={jumpInput}
                                onChange={handleJumpInputChange}
                                onBlur={handleJumpCommit}
                                onKeyDown={e => { if (e.key === 'Enter') handleJumpCommit(); }}
                                className="w-12 text-center border border-surface-300 rounded-lg py-1 text-sm font-semibold text-surface-800 focus:ring-2 focus:ring-brand-500 outline-none"
                            />
                            <span className="text-surface-400 text-xs">of</span>
                            <span className="font-semibold text-surface-700">{totalPages}</span>
                        </div>

                        <div className="w-px h-5 bg-surface-200 mx-1" />

                        {/* Next button */}
                        <button
                            onClick={() => goToPage(currentPage + 1)}
                            disabled={currentPage >= totalPages || pageRendering}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-surface-600 hover:bg-surface-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Next <ChevronRight size={16} />
                        </button>

                        {/* Page indicator pill */}
                        <div className="ml-2 px-2.5 py-0.5 bg-brand-50 border border-brand-200 rounded-full text-[11px] font-semibold text-brand-700">
                            {annotations.filter(a => a.pageNumber === currentPage).length} annotation{annotations.filter(a => a.pageNumber === currentPage).length !== 1 ? 's' : ''} on this page
                        </div>
                    </div>
                )}
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
                    {isPdf && (
                        <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-semibold">
                            PDF · {totalPages} pages
                        </div>
                    )}
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
                        {logoOverlay.activeTest !== null ? 'Disable test overlay to draw annotations.' : 'Click and drag on the image to annotate.'}
                    </div>
                </div>

                {/* Comments list */}
                <div className="p-4 border-b border-surface-100 flex-shrink-0" style={{ maxHeight: 260, overflowY: 'auto' }}>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-semibold text-surface-600 uppercase">
                            Comments {isPdf && <span className="normal-case font-normal text-surface-400">(p{currentPage})</span>}
                        </h3>
                        <span className="bg-surface-100 text-surface-600 px-2 py-0.5 rounded-full text-[10px] font-bold">{visibleAnnotations.length}</span>
                    </div>
                    {visibleAnnotations.length === 0 ? (
                        <div className="text-center py-6 text-surface-300 text-sm">
                            {isPdf ? `No annotations on page ${currentPage}` : 'No annotations yet'}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {visibleAnnotations.map((ann, i) => (
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
                <BrandChecklist
                    key={brandChecklistKey}
                    overlayState={logoOverlay}
                    onOverlayChange={setLogoOverlay}
                    onSaveLogoResult={setSavedLogoResult}
                    onSaveMotifResult={setSavedMotifResult}
                    onSaveSizeResult={setSavedSizeResult}
                    imageDimensions={imageDimensions}
                    logoSrc={logoSrc}
                    onLogoSrcChange={setLogoSrc}
                    isPdf={isPdf}
                />

                {/* Actions */}
                <div className="p-4 border-t border-surface-200 space-y-2 flex-shrink-0 mt-auto">
                    {/* Reset button */}
                    <button
                        onClick={handleResetAll}
                        className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                    >
                        <RotateCcw size={14} /> Reset All
                    </button>
                    <button onClick={handleSaveAnnotations} className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium border border-surface-300 rounded-lg hover:bg-surface-50 transition-colors">
                        <Save size={16} /> Save Annotations
                    </button>
                    <button onClick={handleSaveAsPdf} className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors">
                        <FileDown size={16} /> Save as PDF
                    </button>
                    <button onClick={handleSavePdfAndSend} className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold bg-indigo-700 text-white rounded-lg hover:bg-indigo-800 transition-colors">
                        <Send size={15} /> Save PDF &amp; Send to Designer
                    </button>
                </div>
            </div>

            {/* ── Comment Modal ──────────────────────────────────────────────── */}
            {commentModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ pointerEvents: 'none' }}>
                    <div className="absolute inset-0 bg-black/20" style={{ pointerEvents: 'auto' }} onClick={closeCommentModal} />
                    <div className="relative bg-white rounded-xl shadow-2xl border border-surface-200 p-5 w-[360px] animate-fade-in" style={{ pointerEvents: 'auto' }}>
                        {/* Modal header */}
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: '#1e49e2' }}>
                                {editingId ? '✎' : '+'}
                            </div>
                            <h3 className="text-sm font-semibold text-surface-700">
                                {editingId ? 'Edit Comment' : `Add Comment${isPdf ? ` — Page ${currentPage}` : ''}`}
                            </h3>
                        </div>

                        {/* Textarea */}
                        <div className="relative">
                            <textarea
                                value={comment}
                                onChange={e => setComment(e.target.value)}
                                className="w-full h-28 p-2.5 border border-surface-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none pr-[72px]"
                                placeholder="Describe the issue…"
                                autoFocus
                                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleCommentSave(); }}
                            />
                            {/* Inline Save button inside textarea */}
                            <button
                                onClick={handleCommentSave}
                                disabled={!comment.trim()}
                                className="absolute bottom-2 right-2 flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-white rounded-md transition-colors disabled:opacity-40"
                                style={{ backgroundColor: comment.trim() ? '#1e49e2' : undefined }}
                                title="Save comment (Ctrl+Enter)"
                            >
                                <Save size={11} /> {editingId ? 'Update' : 'Save'}
                            </button>
                        </div>

                        <div className="flex items-center justify-between mt-2">
                            <p className="text-[10px] text-surface-400">Ctrl+Enter to save quickly</p>
                            <button onClick={closeCommentModal} className="text-xs text-surface-500 hover:text-surface-700 font-medium">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
