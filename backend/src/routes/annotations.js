import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/schema.js';

const router = Router();

// GET /api/annotations/:documentId — get all annotations for a document
router.get('/:documentId', (req, res) => {
    const db = getDb();
    const annotations = db.prepare('SELECT * FROM annotations WHERE document_id = ? ORDER BY created_at ASC').all(req.params.documentId);
    res.json(annotations);
});

// POST /api/annotations/:documentId — save/replace all annotations for a document
router.post('/:documentId', (req, res) => {
    const { annotations } = req.body;
    if (!Array.isArray(annotations)) return res.status(400).json({ error: 'annotations must be an array' });

    const db = getDb();
    const deleteStmt = db.prepare('DELETE FROM annotations WHERE document_id = ?');
    const insertStmt = db.prepare(`INSERT INTO annotations (id, document_id, type, page_number, severity, error_category, x, y, width, height, comment, is_resolved) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    const transaction = db.transaction(() => {
        deleteStmt.run(req.params.documentId);
        for (const ann of annotations) {
            insertStmt.run(
                ann.id || uuidv4(),
                req.params.documentId,
                ann.type,
                ann.pageNumber || ann.page_number || 1,
                ann.severity,
                ann.error_category || 'Design',
                ann.x,
                ann.y,
                ann.width,
                ann.height,
                ann.comment,
                ann.is_resolved || 0
            );
        }
    });

    transaction();
    res.json({ success: true, count: annotations.length });
});

// PUT /api/annotations/:annotationId/resolve — mark annotation as resolved
router.put('/:annotationId/resolve', (req, res) => {
    const db = getDb();
    const result = db.prepare('UPDATE annotations SET is_resolved = 1 WHERE id = ?').run(req.params.annotationId);
    if (result.changes === 0) return res.status(404).json({ error: 'Annotation not found' });
    res.json({ success: true });
});

export default router;
