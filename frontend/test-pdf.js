import { PDFDocument, PDFName, PDFString, PDFHexString, rgb, PDFArray, PDFDict } from 'pdf-lib';
import fs from 'fs';

async function run() {
    const pdfDocLib = await PDFDocument.create();
    const imgPage = pdfDocLib.addPage([600, 800]);

    const badgeCx = 100;
    const badgeCy = 700;
    const badgeR = 14;
    const annColor = { r: 1, g: 0, b: 0 };

    const annotRef1 = pdfDocLib.context.register(
        pdfDocLib.context.obj({
            Type:     PDFName.of('Annot'),
            Subtype:  PDFName.of('Text'),
            Name:     PDFName.of('Comment'),
            Rect:     [badgeCx - badgeR, badgeCy - badgeR, badgeCx + badgeR, badgeCy + badgeR],
            Contents: PDFString.of(`Comment 1 text`),
            T:        PDFString.of('Brand Reviewer'),
            Open:     false,
            F:        4,
            C:        [annColor.r, annColor.g, annColor.b],
        })
    );
    imgPage.node.addAnnot(annotRef1);

    const pdfBytes = await pdfDocLib.save();
    
    // Inspect the generated PDF structure
    console.log('--- PAGE DICTIONARY ---');
    console.log(imgPage.node.toString());
    
    console.log('--- ANNOTS ARRAY ---');
    const annots = imgPage.node.lookup(PDFName.of('Annots'));
    console.log(annots ? annots.toString() : 'NONE');

    if (annots instanceof PDFArray) {
        for (let i = 0; i < annots.size(); i++) {
            const ref = annots.get(i);
            console.log(`--- ANNOT ${i} (${ref}) ---`);
            const annotDict = pdfDocLib.context.lookup(ref);
            console.log(annotDict.toString());
        }
    }
}

run().catch(console.error);
