import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { Toast } from 'primereact/toast';
import { Accordion, AccordionTab } from 'primereact/accordion';
import { getReviewById, updateAnnotations, updateReview } from '../services/localStore';
import { Review, Annotation, ShapeType, StyleOption, SimpleTestKey, Platform, CommittedTestResult, SavedSimpleTests } from '../types';
import { ArrowLeft, Square, Save, FileDown, Trash2, Pencil, Check, X, Info, RotateCcw, Send, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import html2canvas from 'html2canvas';
import { PDFDocument, PDFName, PDFString, PDFHexString, rgb } from 'pdf-lib';
import BrandChecklist, { LogoOverlayState } from '../components/review/BrandChecklist';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
    TYPOGRAPHY_TITLE_TEXT, TYPOGRAPHY_SUBTITLE_TEXT,
    TYPOGRAPHY_TITLE_FONT_FAMILY, TYPOGRAPHY_SUBTITLE_FONT_FAMILY,
    TYPOGRAPHY_TITLE_FONT_SIZE, TYPOGRAPHY_TITLE_FONT_WEIGHT,
    TYPOGRAPHY_SUBTITLE_FONT_SIZE, TYPOGRAPHY_SUBTITLE_FONT_WEIGHT,
    TYPOGRAPHY_COLOR, TYPOGRAPHY_TITLE_FROM_TOP,
} from '../constants/typographyConstants';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

const HIGHLIGHT_COLOR = '#1e49e2';
const LOGO_BLUE_SRC = './assets/KPMG_blue_logo.svg';
// SVG viewBox: 80.58 × 32.08 → aspect ratio ≈ 2.514 : 1
const LOGO_ASPECT = 80.58 / 32.08; // ≈ 2.514
const LOGO_BASE_W = 120; // px at scale 1

// ── Style sample image mapping ────────────────────────────────────────────────
const STYLE_SAMPLE_IMAGES: Partial<Record<StyleOption, string>> = {
    'style1.1': './assets/sample-1.jpg',
    'style1.2': './assets/sample-2.jpg',
    'style2':   './assets/sample-3.jpg',
    'style3.1': './assets/sample-4.jpg',
    'style3.2': './assets/sample-5.jpg',
    'style4':   './assets/sample-6.jpg',
    'style5':   './assets/sample-1.jpg',
};

const PDF_REF_IMAGES: Record<string, string> = {
    'Insights led page': './assets/sample-1.jpg',
    'Hub page': './assets/sample-2.jpg',
    'Contact page': './assets/sample-3.jpg',
    'Infographics': './assets/sample-4.jpg',
    'Video banners': './assets/sample-5.jpg',
};

// ── Simple test human-readable labels (for PDF) ───────────────────────────────
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

// ── Test visibility matrix (mirrors BrandChecklist) ───────────────────────────
const TEST_MATRIX: Record<StyleOption, Record<string, boolean>> = {
    'style1.1': { logo_space:true, typography:true, window_motif:true, text_clear_space:true, gradient:true,  portraits:true,  diversity:true,  body_copy_arial:true, copyright:true, colors:true, window_bg_colors:false, type_in_window:false, bg_3_colors:false, image_breakout:false, neutral_image:false },
    'style1.2': { logo_space:true, typography:true, window_motif:true, text_clear_space:true, gradient:true,  portraits:false, diversity:false, body_copy_arial:true, copyright:true, colors:true, window_bg_colors:false, type_in_window:false, bg_3_colors:false, image_breakout:false, neutral_image:false },
    'style2':   { logo_space:true, typography:true, window_motif:true, text_clear_space:true, gradient:true,  portraits:false, diversity:false, body_copy_arial:true, copyright:true, colors:true, window_bg_colors:true,  type_in_window:true,  bg_3_colors:false, image_breakout:false, neutral_image:false },
    'style3.1': { logo_space:true, typography:true, window_motif:true, text_clear_space:true, gradient:true,  portraits:false, diversity:true,  body_copy_arial:true, copyright:true, colors:true, window_bg_colors:false, type_in_window:false, bg_3_colors:true,  image_breakout:true,  neutral_image:false },
    'style3.2': { logo_space:true, typography:true, window_motif:true, text_clear_space:true, gradient:true,  portraits:false, diversity:false, body_copy_arial:true, copyright:true, colors:true, window_bg_colors:false, type_in_window:false, bg_3_colors:true,  image_breakout:true,  neutral_image:false },
    'style4':   { logo_space:true, typography:true, window_motif:true, text_clear_space:true, gradient:true,  portraits:false, diversity:true,  body_copy_arial:true, copyright:true, colors:true, window_bg_colors:false, type_in_window:false, bg_3_colors:false, image_breakout:false, neutral_image:true  },
    'style5':   { logo_space:true, typography:true, window_motif:false,text_clear_space:true, gradient:false, portraits:false, diversity:false, body_copy_arial:true, copyright:true, colors:true, window_bg_colors:false, type_in_window:false, bg_3_colors:false, image_breakout:false, neutral_image:false },
};

export default function ReviewPage() {
    const { reviewId } = useParams<{ reviewId: string }>();
    const storeData = useStore();
    const navigate = useNavigate();
    const viewerRef = useRef<HTMLDivElement>(null);
    const toastRef = useRef<Toast>(null);

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
    const [logoOverlay, setLogoOverlay] = useState<LogoOverlayState>({
        activeTest: null, pos: { x: 0, y: 0 }, scale: 1, opacity: 1, windowRatio: '7:10', testResult: null, testComment: '',
    });
    // Separately committed test results
    const [savedLogoResult,       setSavedLogoResult]       = useState<CommittedTestResult | null>(null);
    const [savedMotifResult,      setSavedMotifResult]       = useState<CommittedTestResult | null>(null);
    const [savedSizeResult,       setSavedSizeResult]        = useState<CommittedTestResult | null>(null);
    const [savedTypographyResult, setSavedTypographyResult] = useState<CommittedTestResult | null>(null);
    const [savedTextClearResult,  setSavedTextClearResult]  = useState<CommittedTestResult | null>(null);
    const [savedSimpleTests,      setSavedSimpleTests]       = useState<SavedSimpleTests>({});

    // Selected style (for center column sample image)
    const [selectedStyle, setSelectedStyle] = useState<StyleOption | null>(null);
    // Platform selection
    const [platform, setPlatform] = useState<Platform | ''>('');
    // Style reference modal
    const [styleModalOpen, setStyleModalOpen] = useState(false);

    // PDF reference modal
    const [pdfModalOpen, setPdfModalOpen] = useState(false);
    const [selectedPdfRef, setSelectedPdfRef] = useState<string | null>(null);

    // Natural pixel dimensions of the uploaded image
    const [imageDimensions, setImageDimensions] = useState<{ w: number; h: number } | null>(null);
    // When true, logo is hidden so html2canvas excludes it from the PDF capture
    const [logoHiddenForCapture, setLogoHiddenForCapture] = useState(false);
    // Active logo src (blue or white)
    const [logoSrc, setLogoSrc] = useState(LOGO_BLUE_SRC);
    // Incremented on "Reset All" to force BrandChecklist remount
    const [brandChecklistKey, setBrandChecklistKey] = useState(0);
    const logoDragging = useRef(false);
    const logoDragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });

    // ── PDF state ─────────────────────────────────────────────────────────────
    const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [pageImageUrl, setPageImageUrl] = useState<string | null>(null);
    const [pageRendering, setPageRendering] = useState(false);
    const [jumpInput, setJumpInput] = useState('1');

    const isPdf = review?.fileType === 'pdf';

    useEffect(() => {
        if (reviewId) {
            const r = getReviewById(reviewId);
            if (r) {
                setReview(r);
                setAnnotations(r.annotations || []);
                if (r.fileType === 'pdf' && r.totalPages) setTotalPages(r.totalPages);
                if (r.style) setSelectedStyle(r.style as StyleOption);
                if (r.platform) setPlatform(r.platform as Platform);
                
                if (r.savedLogoResult) setSavedLogoResult(r.savedLogoResult);
                if (r.savedMotifResult) setSavedMotifResult(r.savedMotifResult);
                if (r.savedSizeResult) setSavedSizeResult(r.savedSizeResult);
                if (r.savedTypographyResult) setSavedTypographyResult(r.savedTypographyResult);
                if (r.savedTextClearResult) setSavedTextClearResult(r.savedTextClearResult);
                if (r.savedSimpleTests) setSavedSimpleTests(r.savedSimpleTests);
            }
            setLoading(false);
        }
    }, [reviewId, storeData]);

    useEffect(() => {
        if (!review || review.fileType !== 'pdf' || !review.fileBlobUrl) return;
        let cancelled = false;
        (async () => {
            try {
                const resp = await fetch(review.fileBlobUrl!);
                const arrayBuffer = await resp.arrayBuffer();
                const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                if (!cancelled) { setPdfDoc(doc); setTotalPages(doc.numPages); setCurrentPage(1); setJumpInput('1'); }
            } catch (err) { console.error('Failed to load PDF:', err); }
        })();
        return () => { cancelled = true; };
    }, [review?.id, review?.fileBlobUrl]);

    useEffect(() => {
        if (!pdfDoc) return;
        let cancelled = false;
        setPageRendering(true);
        (async () => {
            try {
                const page = await pdfDoc.getPage(currentPage);
                const viewport = page.getViewport({ scale: 1.8 });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width; canvas.height = viewport.height;
                const ctx = canvas.getContext('2d')!;
                await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
                if (!cancelled) {
                    const url = canvas.toDataURL('image/png');
                    setPageImageUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
                    setImageDimensions({ w: canvas.width, h: canvas.height });
                    setPageRendering(false);
                }
            } catch (err) { if (!cancelled) { console.error('Page render error:', err); setPageRendering(false); } }
        })();
        return () => { cancelled = true; };
    }, [pdfDoc, currentPage]);

    useEffect(() => { setJumpInput(String(currentPage)); }, [currentPage]);

    const goToPage = (page: number) => setCurrentPage(Math.max(1, Math.min(totalPages, page)));
    const handleJumpInputChange = (e: React.ChangeEvent<HTMLInputElement>) => setJumpInput(e.target.value);
    const handleJumpCommit = () => {
        const n = parseInt(jumpInput, 10);
        if (!isNaN(n)) goToPage(n); else setJumpInput(String(currentPage));
    };

    // ── Drawing ───────────────────────────────────────────────────────────────
    const getRelativeCoords = (e: React.MouseEvent) => {
        if (!viewerRef.current) return { pctX: 0, pctY: 0 };
        const rect = viewerRef.current.getBoundingClientRect();
        return { pctX: ((e.clientX - rect.left) / rect.width) * 100, pctY: ((e.clientY - rect.top) / rect.height) * 100 };
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
        setCurrentRect({ x: Math.min(c.pctX, startPoint.x), y: Math.min(c.pctY, startPoint.y), w: Math.abs(c.pctX - startPoint.x), h: Math.abs(c.pctY - startPoint.y) });
    };
    const handleMouseUp = () => {
        if (!isDrawing || !currentRect) return;
        setIsDrawing(false);
        if (currentRect.w < 1 || currentRect.h < 1) { setCurrentRect(null); return; }
        setTempShape({ type: ShapeType.RECTANGLE, x: currentRect.x, y: currentRect.y, width: currentRect.w, height: currentRect.h });
        setComment(''); setEditingId(null); setCommentModalOpen(true);
    };

    // ── Comments ──────────────────────────────────────────────────────────────
    const handleCommentSave = () => {
        if (!comment.trim()) return;
        if (editingId) {
            setAnnotations(prev => prev.map(a => a.id === editingId ? { ...a, comment } : a));
        } else if (tempShape) {
            const newAnn: Annotation = {
                id: crypto.randomUUID(), type: ShapeType.RECTANGLE,
                pageNumber: isPdf ? currentPage : 1,
                x: tempShape.x || 0, y: tempShape.y || 0,
                width: tempShape.width || 0, height: tempShape.height || 0,
                comment, timestamp: Date.now(),
            };
            setAnnotations(prev => [...prev, newAnn]);
        }
        closeCommentModal();
    };
    const closeCommentModal = () => {
        setCommentModalOpen(false); setCurrentRect(null); setTempShape(null); setEditingId(null); setComment('');
    };
    const handleAnnotationClick = (e: React.MouseEvent, ann: Annotation) => {
        e.stopPropagation(); setEditingId(ann.id); setComment(ann.comment || ''); setCommentModalOpen(true);
    };
    const removeAnnotation = (id: string) => setAnnotations(prev => prev.filter(a => a.id !== id));
    const visibleAnnotations = isPdf ? annotations.filter(a => a.pageNumber === currentPage) : annotations;

    // ── Logo drag ─────────────────────────────────────────────────────────────
    const handleLogoDragStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        logoDragging.current = true;
        logoDragStart.current = { mx: e.clientX, my: e.clientY, ox: logoOverlay.pos.x, oy: logoOverlay.pos.y };
        const onMove = (ev: MouseEvent) => {
            if (!logoDragging.current || !viewerRef.current) return;
            const canvas = viewerRef.current;
            const canvasW = canvas.offsetWidth; const canvasH = canvas.offsetHeight;
            let groupW = LOGO_BASE_W * logoOverlay.scale; let groupH = 0;
            if (logoOverlay.activeTest === 'logo') {
                const scaledH = Math.round(groupW / LOGO_ASPECT);
                groupH = scaledH * 3;
            } else if (logoOverlay.activeTest === 'window_motif') {
                groupH = logoOverlay.windowRatio === '7:10' ? groupW * (10/7) : groupW * (7/10);
            }
            const newX = logoDragStart.current.ox + ev.clientX - logoDragStart.current.mx;
            const newY = logoDragStart.current.oy + ev.clientY - logoDragStart.current.my;
            setLogoOverlay(prev => ({
                ...prev, pos: {
                    x: Math.max(0, Math.min(newX, canvasW - groupW)),
                    y: Math.max(0, Math.min(newY, canvasH - groupH)),
                },
            }));
        };
        const onUp = () => { logoDragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [logoOverlay.pos, logoOverlay.scale]);

    // ── Actions ───────────────────────────────────────────────────────────────
    const handleSaveAndComplete = () => {
        if (!reviewId || !review) return;

        let testScore = "NA";

        if (!isPdf && selectedStyle) {
            const allTestRows = buildAllTestResults();
            const validRows = allTestRows.filter(r => r.result !== null);
            const total = validRows.length;
            const okCount = validRows.filter(r => r.result?.result === 'ok').length;
            testScore = total > 0 ? `${okCount}/${total}` : "0/0";
        }

        updateReview(reviewId, {
            ...review,
            annotations,
            testScore,
            style: selectedStyle,
            platform,
            status: 'reviewed',
            savedLogoResult,
            savedMotifResult,
            savedSizeResult,
            savedTypographyResult,
            savedTextClearResult,
            savedSimpleTests,
        });

        toastRef.current?.show({ severity: 'success', summary: 'Success', detail: 'Progress saved and marked as complete!', life: 3000 });
    };

    const handleResetAll = () => {
        setAnnotations([]);
        setSavedLogoResult(null); setSavedMotifResult(null); setSavedSizeResult(null);
        setSavedTypographyResult(null); setSavedTextClearResult(null); setSavedSimpleTests({});
        setSelectedStyle(null);
        setLogoOverlay({ activeTest: null, pos: { x: 0, y: 0 }, scale: 1, opacity: 1, windowRatio: '7:10', testResult: null, testComment: '' });
        setBrandChecklistKey(k => k + 1);
    };

    // ── Computed logo/motif dimensions ────────────────────────────────────────
    const scaledW = LOGO_BASE_W * logoOverlay.scale;
    const scaledH = Math.round(scaledW / LOGO_ASPECT); // logo height at current scale
    const motifH = logoOverlay.windowRatio === '7:10' ? scaledW * (10/7) : scaledW * (7/10);

    // One logo space = logo height (shorter dimension) = scaledH at scale 1
    const logoSpace = Math.round(LOGO_BASE_W / LOGO_ASPECT); // ≈ 48px at base scale

    // Text Clear Space margin = one logo-HEIGHT (shorter dim) × scale → keeps lines close to image border
    const textClearMargin = logoSpace * logoOverlay.scale;

    // Display src
    const displaySrc = isPdf ? pageImageUrl : review?.fileBlobUrl;

    // ── Build all test results for PDF/email ──────────────────────────────────
    const buildAllTestResults = () => {
        if (!selectedStyle) return [];
        const matrix = TEST_MATRIX[selectedStyle];
        const rows: { label: string; result: CommittedTestResult | null }[] = [];

        // Always include Image Size test if it exists
        rows.push({ label: 'Image Size Test', result: savedSizeResult });

        if (matrix.logo_space)       rows.push({ label: 'Logo Space Test',         result: savedLogoResult });
        if (matrix.typography)       rows.push({ label: 'Typography Test',          result: savedTypographyResult });
        if (matrix.window_motif)     rows.push({ label: 'Window Motif Test',        result: savedMotifResult });
        if (matrix.text_clear_space) rows.push({ label: 'Text Clear Space Test',    result: savedTextClearResult });

        // Simple tests
        const simpleKeys = Object.keys(SIMPLE_TEST_LABELS) as (keyof typeof SIMPLE_TEST_LABELS)[];
        for (const k of simpleKeys) {
            if (matrix[k]) {
                rows.push({ label: SIMPLE_TEST_LABELS[k], result: savedSimpleTests[k as SimpleTestKey] ?? null });
            }
        }
        return rows;
    };

    // ── PDF export ────────────────────────────────────────────────────────────
    const handleSaveAsPdf = async () => {
        if (!viewerRef.current || !review) return;
        try {
            const { StandardFonts } = await import('pdf-lib');
            let pdfDocLib: PDFDocument;
            let imgPage: any = null;
            let canvasW = 0;
            let canvasH = 0;

            if (isPdf && review.fileBlobUrl) {
                const resp = await fetch(review.fileBlobUrl);
                const arrayBuffer = await resp.arrayBuffer();
                pdfDocLib = await PDFDocument.load(arrayBuffer);
            } else {
                setLogoHiddenForCapture(true);
                await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                const canvasEl = await html2canvas(viewerRef.current, { scale: 2, useCORS: true, logging: false, backgroundColor: '#fff' });
                setLogoHiddenForCapture(false);
    
                const imgDataUrl = canvasEl.toDataURL('image/png');
                const base64 = imgDataUrl.split(',')[1];
                const imgBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
                canvasW = canvasEl.width;
                canvasH = canvasEl.height;
    
                pdfDocLib = await PDFDocument.create();
                
                // ── Page 1: Annotated image ───────────────────────────────────
                imgPage = pdfDocLib.addPage([canvasW, canvasH]);
                const pngImage = await pdfDocLib.embedPng(imgBytes);
                imgPage.drawImage(pngImage, { x: 0, y: 0, width: canvasW, height: canvasH });
            }

            const regFont  = await pdfDocLib.embedFont(StandardFonts.Helvetica);
            const boldFont = await pdfDocLib.embedFont(StandardFonts.HelveticaBold);

            const hexToRgb = (hex: string) => {
                const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return m ? { r: parseInt(m[1], 16) / 255, g: parseInt(m[2], 16) / 255, b: parseInt(m[3], 16) / 255 } : { r: 0.4, g: 0.4, b: 1 };
            };
            const annColor = hexToRgb(HIGHLIGHT_COLOR);

            const annList = isPdf ? annotations : visibleAnnotations;

            annList.forEach((ann, i) => {
                let targetPage: any;
                let pw = canvasW;
                let ph = canvasH;

                if (isPdf) {
                    const pageIndex = ann.pageNumber - 1;
                    if (pageIndex < 0 || pageIndex >= pdfDocLib.getPageCount()) return;
                    targetPage = pdfDocLib.getPage(pageIndex);
                    const size = targetPage.getSize();
                    pw = size.width;
                    ph = size.height;
                } else {
                    if (!imgPage) return;
                    targetPage = imgPage;
                }

                const ax = (ann.x / 100) * pw;
                const aw = (ann.width / 100) * pw;
                const ah = (ann.height / 100) * ph;
                // PDF coordinate system is bottom-up; convert top-down percentage
                const ay = ph - ((ann.y / 100) * ph) - ah;

                // ── 1. Visual rectangle drawn as PDF vector ───────
                targetPage.drawRectangle({
                    x: ax, y: ay, width: aw, height: ah,
                    borderColor: rgb(annColor.r, annColor.g, annColor.b),
                    borderWidth: 4,
                    color: rgb(annColor.r, annColor.g, annColor.b),
                    opacity: 0.12,
                    borderOpacity: 1,
                });

                // ── 2. Numbered badge (filled circle + white digit) ──────────
                const badgeR = 14;
                const badgeCx = ax + badgeR + 2;
                const badgeCy = ay + ah - badgeR - 2;
                targetPage.drawCircle({ x: badgeCx, y: badgeCy, size: badgeR, color: rgb(0.12, 0.27, 0.89) });
                const numStr = String(i + 1);
                targetPage.drawText(numStr, {
                    x: badgeCx - (numStr.length > 1 ? 7 : 4),
                    y: badgeCy - 5,
                    size: 10, font: boldFont, color: rgb(1, 1, 1),
                });

                // ── 3. Native PDF sticky-note annotation ─────────────────────
                const annotRef = pdfDocLib.context.register(
                    pdfDocLib.context.obj({
                        Type:     PDFName.of('Annot'),
                        Subtype:  PDFName.of('Text'),
                        Name:     PDFName.of('Comment'), // Standard Acrobat icon
                        Rect:     [badgeCx - badgeR, badgeCy - badgeR, badgeCx + badgeR, badgeCy + badgeR],
                        Contents: PDFString.of(`#${i + 1}: ${ann.comment || '(no comment)'}`),
                        T:        PDFString.of('Brand Reviewer'),
                        Subj:     PDFString.of('Comment'),
                        Open:     false,
                        F:        28, // Print | NoZoom | NoRotate
                        C:        [annColor.r, annColor.g, annColor.b],
                        P:        targetPage.ref,
                    })
                );
                targetPage.node.addAnnot(annotRef);
            });

            // Tell Acrobat to generate appearance streams for the annotations
            if (!pdfDocLib.catalog.get(PDFName.of('AcroForm'))) {
                const acroForm = pdfDocLib.context.obj({
                    NeedAppearances: true,
                });
                pdfDocLib.catalog.set(PDFName.of('AcroForm'), pdfDocLib.context.register(acroForm));
            }

            // ── 4. Native sticky notes for ALL brand test results (OK and NOT OK) ──
            if (!isPdf && selectedStyle) {
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

            // ── Page 2+: Summary (auto-paginates) ────────────────────────
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

            // Mutable page reference so new pages can be added when space runs out
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

            // Draw header banner on first summary page
            activePage.drawRectangle({ x: 0, y: A4H - 130, width: A4W, height: 130, color: rgb(0.12, 0.27, 0.89) });
            activePage.drawText('BRAND REVIEW SUMMARY', { x: M, y: A4H - 52, size: 36, font: boldFont, color: rgb(1, 1, 1) });
            activePage.drawText(review.title, { x: M, y: A4H - 90, size: 22, font: regFont, color: rgb(0.78, 0.87, 1) });
            activePage.drawText(`Job: ${review.job_id}   Designer: ${review.designer_name}`,
                { x: M, y: A4H - 118, size: 17, font: regFont, color: rgb(0.6, 0.75, 1) });
            sy = A4H - 158;

            if (selectedStyle) {
                dt(`Style: ${selectedStyle}`, { sz: 16, col: [0.4, 0.5, 0.9] });
            }
            sy -= 10;

            // ── Annotation Comments ───────────────────────────────────────
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

            // ── Brand Test Results (all test cases, every style) ──────────
            if (!isPdf && selectedStyle) {
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
            setLogoHiddenForCapture(false);
            console.error(err);
            alert('PDF export failed: ' + String(err));
        }
    };

    // ── Email body ────────────────────────────────────────────────────────────
    const buildMailtoBody = () => {
        const annotationLines = annotations.length > 0
            ? annotations.map((ann, i) => {
                const prefix = isPdf ? `  p${ann.pageNumber} · ${i + 1}.` : `  ${i + 1}.`;
                return `${prefix} ${ann.comment || '(no comment)'}`;
              })
            : ['  (none)'];

        const testLines = (!isPdf && selectedStyle)
            ? buildAllTestResults().map(({ label, result }) => {
                if (!result) return `  ${label}: Not Tested`;
                const status = result.result === 'ok' ? 'YES / OK' : 'NO / NOT OK';
                const c = result.comment ? ` -- ${result.comment}` : '';
                return `  ${label}: ${status}${c}`;
            })
            : [];

        const bodyLines = [
            `Brand Review Report: ${review?.title ?? 'Untitled'}`,
            `Job: ${review?.job_id ?? '-'} | Designer: ${review?.designer_name ?? '-'}`,
            selectedStyle ? `Style: ${selectedStyle}` : '',
            '',
            '--- ANNOTATION COMMENTS ---',
            ...annotationLines,
            ...(!isPdf && selectedStyle ? ['', '--- BRAND TEST RESULTS ---', ...testLines] : []),
        ].filter(l => l !== undefined);

        return encodeURIComponent(bodyLines.join('\n'));
    };

    const handleSendToDesigner = () => {
        if (!review) return;
        const subject = encodeURIComponent(`Brand Review: ${review.title}`);
        const body = buildMailtoBody();
        window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    };

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
            <Toast ref={toastRef} />

            {/* ── LEFT COLUMN: Image/PDF viewer (50%) ───────────────────────── */}
            <div className="flex-1 relative bg-surface-100 overflow-auto p-6 flex flex-col items-center" style={{ minWidth: 0 }}>
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
                        ? <img src={displaySrc} alt="Review" className="max-w-full h-auto select-none pointer-events-none"
                            onLoad={(e) => { const img = e.currentTarget as HTMLImageElement; if (!isPdf) setImageDimensions({ w: img.naturalWidth, h: img.naturalHeight }); }} />
                        : <div className="p-8 text-danger">{isPdf ? 'Rendering page…' : 'File not available'}</div>
                    }

                    {/* Annotation overlays */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        {visibleAnnotations.map((ann) => (
                            <div key={ann.id} onClick={(e) => handleAnnotationClick(e, ann)}
                                className="absolute border-2 cursor-pointer pointer-events-auto group transition-all"
                                style={{ left: `${ann.x}%`, top: `${ann.y}%`, width: `${ann.width}%`, height: `${ann.height}%`, borderColor: HIGHLIGHT_COLOR, backgroundColor: `${HIGHLIGHT_COLOR}22`, borderRadius: 4 }}
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
                            <div className="absolute border-2 border-brand-500 bg-brand-500/20" style={{ left: `${currentRect.x}%`, top: `${currentRect.y}%`, width: `${currentRect.w}%`, height: `${currentRect.h}%`, borderRadius: 4 }} />
                        )}
                    </div>

                    {/* ── Logo / Motif Overlays (draggable) ─────────────────── */}
                    {!isPdf && (logoOverlay.activeTest === 'logo' || logoOverlay.activeTest === 'window_motif') && !logoHiddenForCapture && (() => {
                        if (logoOverlay.activeTest === 'logo') {
                            return (
                                <div onMouseDown={handleLogoDragStart} style={{ position: 'absolute', left: logoOverlay.pos.x, top: logoOverlay.pos.y, cursor: 'grab', userSelect: 'none', zIndex: 40, width: scaledW, pointerEvents: 'auto', opacity: logoOverlay.opacity ?? 1 }}>
                                    <img src={logoSrc} alt="Logo top" draggable={false} style={{ width: scaledW, height: scaledH, objectFit: 'contain', display: 'block', marginLeft: scaledH }} />
                                    <div style={{ width: scaledW, height: scaledH, position: 'relative' }}>
                                        <img src={logoSrc} alt="Logo left" draggable={false} style={{ position: 'absolute', width: scaledW, height: scaledH, objectFit: 'contain', display: 'block', transform: 'rotate(90deg)', transformOrigin: 'center center', left: -(scaledW - scaledH) / 2, top: (scaledW / 2) - (1.5 * scaledH) }} />
                                    </div>
                                    <img src={logoSrc} alt="Logo bottom" draggable={false} style={{ width: scaledW, height: scaledH, objectFit: 'contain', display: 'block', marginLeft: scaledH }} />
                                    <div style={{ fontSize: 9, color: '#1e49e2', whiteSpace: 'nowrap', background: 'rgba(255,255,255,0.85)', padding: '1px 5px', borderRadius: 3, border: '1px solid #99acd4', marginTop: 2 }}>✥ drag to move</div>
                                </div>
                            );
                        } else {
                            return (
                                <div onMouseDown={handleLogoDragStart} style={{ position: 'absolute', left: logoOverlay.pos.x, top: logoOverlay.pos.y, cursor: 'grab', userSelect: 'none', zIndex: 40, width: scaledW, height: motifH, pointerEvents: 'auto', opacity: logoOverlay.opacity ?? 1, border: '2px solid #1e49e2', backgroundColor: 'rgba(30, 73, 226, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div style={{ position: 'absolute', bottom: -20, left: 0, fontSize: 9, color: '#1e49e2', whiteSpace: 'nowrap', background: 'rgba(255,255,255,0.85)', padding: '1px 5px', borderRadius: 3, border: '1px solid #99acd4' }}>✥ drag to move</div>
                                </div>
                            );
                        }
                    })()}

                    {/* ── Typography Overlay ─────────────────────────────────── */}
                    {!isPdf && logoOverlay.activeTest === 'typography' && !logoHiddenForCapture && (
                        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 40, opacity: logoOverlay.opacity ?? 1 }}>
                            {/* Title — "Condensed bold" */}
                            <div style={{
                                position: 'absolute',
                                left: logoSpace,
                                top: TYPOGRAPHY_TITLE_FROM_TOP,
                                fontFamily: TYPOGRAPHY_TITLE_FONT_FAMILY,
                                fontSize: TYPOGRAPHY_TITLE_FONT_SIZE,
                                fontWeight: TYPOGRAPHY_TITLE_FONT_WEIGHT,
                                color: TYPOGRAPHY_COLOR,
                                whiteSpace: 'nowrap',
                                lineHeight: 1.2,
                                textShadow: '0 1px 3px rgba(0,0,0,0.3)',
                            }}>
                                {TYPOGRAPHY_TITLE_TEXT}
                            </div>
                            {/* Subtitle — "Arial regular" — one logo space below title */}
                            <div style={{
                                position: 'absolute',
                                left: logoSpace,
                                top: TYPOGRAPHY_TITLE_FROM_TOP + TYPOGRAPHY_TITLE_FONT_SIZE + logoSpace,
                                fontFamily: TYPOGRAPHY_SUBTITLE_FONT_FAMILY,
                                fontSize: TYPOGRAPHY_SUBTITLE_FONT_SIZE,
                                fontWeight: TYPOGRAPHY_SUBTITLE_FONT_WEIGHT,
                                color: TYPOGRAPHY_COLOR,
                                whiteSpace: 'nowrap',
                                lineHeight: 1.4,
                                textShadow: '0 1px 3px rgba(0,0,0,0.3)',
                            }}>
                                {TYPOGRAPHY_SUBTITLE_TEXT}
                            </div>
                        </div>
                    )}

                    {/* ── Text Clear Space Overlay — single dashed rectangle bordering the image ── */}
                    {!isPdf && logoOverlay.activeTest === 'text_clear_space' && !logoHiddenForCapture && (
                        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 40, opacity: logoOverlay.opacity ?? 1 }}>
                            {/* Dashed rectangle that borders/frames the image at the logo-space margin */}
                            <div style={{
                                position: 'absolute',
                                top: textClearMargin,
                                bottom: textClearMargin,
                                left: textClearMargin,
                                right: textClearMargin,
                                border: `2px dashed ${TYPOGRAPHY_COLOR}`,
                                borderRadius: 2,
                                boxSizing: 'border-box',
                            }}>
                                {/* Label in top-left corner of the rectangle */}
                                <div style={{ position: 'absolute', left: 6, top: 6, fontSize: 9, color: TYPOGRAPHY_COLOR, background: 'rgba(255,255,255,0.9)', padding: '1px 6px', borderRadius: 3, border: `1px solid ${TYPOGRAPHY_COLOR}`, whiteSpace: 'nowrap', fontWeight: 600 }}>
                                    Clear space · {Math.round(textClearMargin)}px from edge
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* PDF Pagination Bar */}
                {isPdf && (
                    <div className="mt-4 flex items-center gap-2 bg-white rounded-xl shadow-card border border-surface-200 px-4 py-2.5">
                        <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1 || pageRendering}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-surface-600 hover:bg-surface-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                            <ChevronLeft size={16} /> Prev
                        </button>
                        <div className="w-px h-5 bg-surface-200 mx-1" />
                        <div className="flex items-center gap-1.5 text-sm text-surface-600">
                            <span className="text-surface-400 text-xs">Page</span>
                            <input type="number" min={1} max={totalPages} value={jumpInput}
                                onChange={handleJumpInputChange} onBlur={handleJumpCommit}
                                onKeyDown={e => { if (e.key === 'Enter') handleJumpCommit(); }}
                                className="w-12 text-center border border-surface-300 rounded-lg py-1 text-sm font-semibold text-surface-800 focus:ring-2 focus:ring-brand-500 outline-none" />
                            <span className="text-surface-400 text-xs">of</span>
                            <span className="font-semibold text-surface-700">{totalPages}</span>
                        </div>
                        <div className="w-px h-5 bg-surface-200 mx-1" />
                        <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages || pageRendering}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-surface-600 hover:bg-surface-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                            Next <ChevronRight size={16} />
                        </button>
                        <div className="ml-2 px-2.5 py-0.5 bg-brand-50 border border-brand-200 rounded-full text-[11px] font-semibold text-brand-700">
                            {annotations.filter(a => a.pageNumber === currentPage).length} annotation{annotations.filter(a => a.pageNumber === currentPage).length !== 1 ? 's' : ''} on this page
                        </div>
                    </div>
                )}
            </div>

            {/* ── CENTER COLUMN: Style sample reference (20%) ────────────────── */}
            <div className="w-[20%] min-w-[160px] max-w-[240px] bg-surface-50 border-l border-surface-200 flex flex-col items-center justify-start p-3 overflow-y-auto overflow-x-hidden custom-scrollbar">
                {isPdf ? (
                    <div className="w-full">
                        <p className="text-[10px] font-semibold text-surface-500 uppercase tracking-wide mb-2 text-center">Reference Pages</p>
                        <Accordion multiple className="text-xs w-full">
                            <AccordionTab header="Insights led page">
                                <div className="flex flex-col items-center p-2">
                                    <p className="text-surface-600 mb-4 text-center text-[10px] leading-tight">Dummy text data for Insights led page content goes here.</p>
                                    <img 
                                        src={PDF_REF_IMAGES['Insights led page']} 
                                        alt="Insights led page reference"
                                        className="w-full h-32 rounded-lg shadow-md border border-surface-200 object-cover cursor-pointer hover:opacity-90 transition-all duration-200"
                                        onClick={() => {
                                            setSelectedPdfRef('Insights led page');
                                            setPdfModalOpen(true);
                                        }}
                                    />
                                </div>
                            </AccordionTab>
                            <AccordionTab header="Hub page">
                                <div className="flex flex-col items-center p-2">
                                    <p className="text-surface-600 mb-4 text-center text-[10px] leading-tight">Dummy text data for Hub page content goes here.</p>
                                    <img 
                                        src={PDF_REF_IMAGES['Hub page']} 
                                        alt="Hub page reference"
                                        className="w-full h-32 rounded-lg shadow-md border border-surface-200 object-cover cursor-pointer hover:opacity-90 transition-all duration-200"
                                        onClick={() => {
                                            setSelectedPdfRef('Hub page');
                                            setPdfModalOpen(true);
                                        }}
                                    />
                                </div>
                            </AccordionTab>
                            <AccordionTab header="Contact page">
                                <div className="flex flex-col items-center p-2">
                                    <p className="text-surface-600 mb-4 text-center text-[10px] leading-tight">Dummy text data for Contact page content goes here.</p>
                                    <img 
                                        src={PDF_REF_IMAGES['Contact page']} 
                                        alt="Contact page reference"
                                        className="w-full h-32 rounded-lg shadow-md border border-surface-200 object-cover cursor-pointer hover:opacity-90 transition-all duration-200"
                                        onClick={() => {
                                            setSelectedPdfRef('Contact page');
                                            setPdfModalOpen(true);
                                        }}
                                    />
                                </div>
                            </AccordionTab>
                            <AccordionTab header="Infographics">
                                <div className="flex flex-col items-center p-2">
                                    <p className="text-surface-600 mb-4 text-center text-[10px] leading-tight">Dummy text data for Infographics content goes here.</p>
                                    <img 
                                        src={PDF_REF_IMAGES['Infographics']} 
                                        alt="Infographics reference"
                                        className="w-full h-32 rounded-lg shadow-md border border-surface-200 object-cover cursor-pointer hover:opacity-90 transition-all duration-200"
                                        onClick={() => {
                                            setSelectedPdfRef('Infographics');
                                            setPdfModalOpen(true);
                                        }}
                                    />
                                </div>
                            </AccordionTab>
                            <AccordionTab header="Video banners">
                                <div className="flex flex-col items-center p-2">
                                    <p className="text-surface-600 mb-4 text-center text-[10px] leading-tight">Dummy text data for Video banners content goes here.</p>
                                    <img 
                                        src={PDF_REF_IMAGES['Video banners']} 
                                        alt="Video banners reference"
                                        className="w-full h-32 rounded-lg shadow-md border border-surface-200 object-cover cursor-pointer hover:opacity-90 transition-all duration-200"
                                        onClick={() => {
                                            setSelectedPdfRef('Video banners');
                                            setPdfModalOpen(true);
                                        }}
                                    />
                                </div>
                            </AccordionTab>
                        </Accordion>
                    </div>
                ) : selectedStyle && STYLE_SAMPLE_IMAGES[selectedStyle] ? (
                    <div className="w-full">
                        <p className="text-[10px] font-semibold text-surface-500 uppercase tracking-wide mb-2 text-center">Style Reference</p>
                        <p className="text-[9px] text-surface-400 text-center mb-3 leading-relaxed">Click to enlarge</p>
                        <div className="flex justify-center">
                            <img
                                src={STYLE_SAMPLE_IMAGES[selectedStyle]}
                                alt={`Style reference ${selectedStyle}`}
                                onClick={() => setStyleModalOpen(true)}
                                className="w-full rounded-lg shadow-md border border-surface-200 object-cover cursor-pointer hover:opacity-90 hover:shadow-lg transition-all duration-200"
                            />
                        </div>
                        <p className="text-[9px] text-surface-400 text-center mt-3 font-medium leading-snug">
                            {(() => {
                                const styleLabels: Record<StyleOption, string> = {
                                    'style1.1': 'Human', 'style1.2': 'Object', 'style2': 'Only text - no image',
                                    'style3.1': 'Action oriented', 'style3.2': 'Architectural/Abstract',
                                    'style4': 'Action + gradient', 'style5': 'Abstract w/o gradient',
                                };
                                return styleLabels[selectedStyle] ?? selectedStyle;
                            })()}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
                        <div className="w-12 h-12 rounded-full bg-surface-200 flex items-center justify-center mb-3">
                            <Square size={20} className="text-surface-400" />
                        </div>
                        <p className="text-[10px] text-surface-400 font-medium leading-relaxed">Select a style<br/>to see reference</p>
                    </div>
                )}
            </div>

            {/* ── RIGHT SIDEBAR: Editor + Brand Checklist (30%) ─────────────── */}
            <div className="w-[30%] min-w-[280px] max-w-[360px] bg-white border-l border-surface-200 flex flex-col h-full shadow-lg overflow-y-auto">
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
                    onSaveTypographyResult={setSavedTypographyResult}
                    onSaveTextClearResult={setSavedTextClearResult}
                    onSaveSimpleTests={setSavedSimpleTests}
                    imageDimensions={imageDimensions}
                    logoSrc={logoSrc}
                    onLogoSrcChange={setLogoSrc}
                    onStyleChange={setSelectedStyle}
                    onPlatformChange={setPlatform}
                    isPdf={isPdf}
                    initialPlatform={review?.platform as Platform | undefined}
                    initialStyle={review?.style as StyleOption | undefined}
                    initialLogoResult={review?.savedLogoResult}
                    initialMotifResult={review?.savedMotifResult}
                    initialSizeResult={review?.savedSizeResult}
                    initialTypographyResult={review?.savedTypographyResult}
                    initialTextClearResult={review?.savedTextClearResult}
                    initialSimpleTests={review?.savedSimpleTests}
                />

                {/* Actions */}
                <div className="p-4 border-t border-surface-200 space-y-2 flex-shrink-0 mt-auto">
                    <button onClick={handleResetAll}
                        className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                        <RotateCcw size={14} /> Reset All
                    </button>
                    <button onClick={handleSaveAndComplete}
                        className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors">
                        <Save size={16} /> Save and Mark Complete
                    </button>
                    <button onClick={handleSaveAsPdf}
                        className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold border border-brand-600 text-brand-600 rounded-lg hover:bg-brand-50 transition-colors">
                        <FileDown size={16} /> Save as PDF
                    </button>
                    <button onClick={handleSendToDesigner}
                        className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold bg-indigo-700 text-white rounded-lg hover:bg-indigo-800 transition-colors">
                        <Send size={15} /> Send to Designer
                    </button>
                </div>
            </div>

            {/* ── Comment Modal ──────────────────────────────────────────────── */}
            {commentModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ pointerEvents: 'none' }}>
                    <div className="absolute inset-0 bg-black/20" style={{ pointerEvents: 'auto' }} onClick={closeCommentModal} />
                    <div className="relative bg-white rounded-xl shadow-2xl border border-surface-200 p-5 w-[360px] animate-fade-in" style={{ pointerEvents: 'auto' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: '#1e49e2' }}>
                                {editingId ? '✎' : '+'}
                            </div>
                            <h3 className="text-sm font-semibold text-surface-700">
                                {editingId ? 'Edit Comment' : `Add Comment${isPdf ? ` — Page ${currentPage}` : ''}`}
                            </h3>
                        </div>
                        <div className="relative">
                            <textarea
                                value={comment} onChange={e => setComment(e.target.value)}
                                className="w-full h-28 p-2.5 border border-surface-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none pr-[72px]"
                                placeholder="Describe the issue…" autoFocus
                                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleCommentSave(); }}
                            />
                            <button onClick={handleCommentSave} disabled={!comment.trim()}
                                className="absolute bottom-2 right-2 flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-white rounded-md transition-colors disabled:opacity-40"
                                style={{ backgroundColor: comment.trim() ? '#1e49e2' : undefined }} title="Save comment (Ctrl+Enter)">
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

            {/* ── Style Reference Modal ──────────────────────────────────────── */}
            {styleModalOpen && selectedStyle && STYLE_SAMPLE_IMAGES[selectedStyle] && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center p-6"
                    onClick={() => setStyleModalOpen(false)}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/75" style={{ backdropFilter: 'blur(4px)' }} />
                    {/* Modal card */}
                    <div
                        className="relative z-10 max-w-3xl w-full rounded-2xl overflow-hidden shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header bar */}
                        <div className="flex items-center justify-between px-5 py-3 bg-surface-900">
                            <div>
                                <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide">Style Reference</p>
                                <p className="text-sm font-bold text-white">
                                    {{
                                        'style1.1': 'Style 1.1 — Human',
                                        'style1.2': 'Style 1.2 — Object',
                                        'style2':   'Style 2 — Only text',
                                        'style3.1': 'Style 3.1 — Action oriented',
                                        'style3.2': 'Style 3.2 — Architectural / Abstract',
                                        'style4':   'Style 4 — Action + gradient',
                                        'style5':   'Style 5 — Abstract without gradient',
                                    }[selectedStyle] ?? selectedStyle}
                                </p>
                            </div>
                            <button
                                onClick={() => setStyleModalOpen(false)}
                                className="p-2 rounded-full text-surface-400 hover:text-white hover:bg-surface-700 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        {/* Image */}
                        <img
                            src={STYLE_SAMPLE_IMAGES[selectedStyle]}
                            alt={`Style reference ${selectedStyle}`}
                            className="w-full block"
                            style={{ maxHeight: '70vh', objectFit: 'contain', background: '#111' }}
                        />
                        <div className="py-2 px-5 bg-surface-900 text-center">
                            <p className="text-[11px] text-surface-500">Click anywhere outside to close</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── PDF Reference Modal ──────────────────────────────────────── */}
            {pdfModalOpen && selectedPdfRef && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center p-6"
                    onClick={() => setPdfModalOpen(false)}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/75" style={{ backdropFilter: 'blur(4px)' }} />
                    {/* Modal card */}
                    <div
                        className="relative z-10 max-w-3xl w-full rounded-2xl overflow-hidden shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header bar */}
                        <div className="flex items-center justify-between px-5 py-3 bg-surface-900">
                            <div>
                                <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide">Reference Page</p>
                                <p className="text-sm font-bold text-white">
                                    {selectedPdfRef}
                                </p>
                            </div>
                            <button
                                onClick={() => setPdfModalOpen(false)}
                                className="p-2 rounded-full text-surface-400 hover:text-white hover:bg-surface-700 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        {/* Image */}
                        <img
                            src={PDF_REF_IMAGES[selectedPdfRef]}
                            alt={`Reference ${selectedPdfRef}`}
                            className="w-full block"
                            style={{ maxHeight: '70vh', objectFit: 'contain', background: '#111' }}
                        />
                        <div className="py-2 px-5 bg-surface-900 text-center">
                            <p className="text-[11px] text-surface-500">Click anywhere outside to close</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
