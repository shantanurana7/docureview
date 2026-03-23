import { PDFDocument, rgb, PDFString, PDFName } from 'pdf-lib';
import { jsPDF } from 'jspdf';
import { documentsApi, annotationsApi } from '../services/api';
import { Annotation, Document, Severity, ShapeType } from '../types';

const SEVERITY_COLORS: Record<Severity, string> = {
    [Severity.MINOR]: '#9ca3af',
    [Severity.MODERATE]: '#f59e0b',
    [Severity.MAJOR]: '#f97316',
    [Severity.CRITICAL]: '#ef4444',
};

const exportImageToPdf = async (doc: Document, annotations: Annotation[]) => {
    const url = documentsApi.getFileUrl(doc.id);
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2d context');

    ctx.drawImage(img, 0, 0);

    // Draw annotations
    annotations.forEach((ann, i) => {
        const x = (ann.x / 100) * canvas.width;
        const y = (ann.y / 100) * canvas.height;
        const w = (ann.width / 100) * canvas.width;
        const h = (ann.height / 100) * canvas.height;

        const hex = SEVERITY_COLORS[ann.severity];
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);

        ctx.fillStyle = `rgba(${r},${g},${b},0.2)`;
        ctx.strokeStyle = `rgba(${r},${g},${b},1)`;
        ctx.lineWidth = Math.max(2, canvas.width / 400);

        if (ann.type === ShapeType.CIRCLE) {
            ctx.beginPath();
            ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
        } else {
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
        }

        // Draw badge
        const scale = Math.max(1, canvas.width / 800);
        const br = 12 * scale;
        ctx.fillStyle = '#0f172a'; // surface-900
        ctx.beginPath();
        ctx.arc(x, y, br, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.font = `bold ${10 * scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((i + 1).toString(), x, y);
    });

    const imgData = canvas.toDataURL('image/png', 1.0);
    const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? 'l' : 'p', unit: 'px', format: [canvas.width, canvas.height] });
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(`${doc.title}_reviewed.pdf`);
};

export const downloadDocumentPdf = async (doc: Document) => {
    const annotations: Annotation[] = await annotationsApi.getByDocument(doc.id);
    const isPdf = doc.filepath.toLowerCase().endsWith('.pdf');

    if (isPdf) {
        const res = await documentsApi.getFileBase64(doc.id);
        if (!res || !res.base64) throw new Error('PDF file is empty');

        const binaryString = atob(res.base64);
        const uint8Array = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) uint8Array[i] = binaryString.charCodeAt(i);

        const pdfDoc = await PDFDocument.load(uint8Array);
        const pages = pdfDoc.getPages();

        annotations.forEach(ann => {
            const pageIdx = (ann.page_number || ann.pageNumber || 1) - 1;
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
        link.download = `${doc.title}_reviewed.pdf`;
        link.click();
    } else {
        await exportImageToPdf(doc, annotations);
    }
};
