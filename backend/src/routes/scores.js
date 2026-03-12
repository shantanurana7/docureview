import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/schema.js';

const router = Router();

// POST /api/scores — submit scoring matrix
router.post('/', (req, res) => {
    const { document_id, reviewer_id, quality, complexity, ftp, design, repeat_offence } = req.body;
    if (document_id === undefined || reviewer_id === undefined) {
        return res.status(400).json({ error: 'document_id and reviewer_id required' });
    }

    // Calculate composite score: ((0.60*Quality + 0.03*Design + 0.10*FTP)*Complexity)/Repeat Offence
    const composite_score = ((0.60 * quality + 0.03 * design + 0.10 * ftp) * complexity) / repeat_offence;

    const db = getDb();
    const id = uuidv4();

    // Upsert — replace if score for this document already exists
    const existing = db.prepare('SELECT id FROM scores WHERE document_id = ?').get(document_id);
    if (existing) {
        db.prepare(`UPDATE scores SET quality = ?, complexity = ?, ftp = ?, design = ?, repeat_offence = ?, composite_score = ? WHERE document_id = ?`)
            .run(quality, complexity, ftp, design, repeat_offence, composite_score, document_id);
        res.json({ id: existing.id, composite_score });
    } else {
        db.prepare(`INSERT INTO scores (id, document_id, reviewer_id, quality, complexity, ftp, design, repeat_offence, composite_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(id, document_id, reviewer_id, quality, complexity, ftp, design, repeat_offence, composite_score);
        res.status(201).json({ id, composite_score });
    }
});

// GET /api/scores/reviewer/:reviewerId — all scores by reviewer (with filters)
router.get('/reviewer/:reviewerId', (req, res) => {
    const db = getDb();
    let query = `
    SELECT s.*, d.title, d.job_id, d.deliverable_type, d.created_at as doc_created_at, 
      du.name as designer_name, du.id as designer_id
    FROM scores s
    JOIN documents d ON s.document_id = d.id
    LEFT JOIN users du ON d.designer_id = du.id
    WHERE s.reviewer_id = ?
  `;
    const params = [req.params.reviewerId];

    // Optional designer filter
    if (req.query.designer_id) {
        query += ' AND d.designer_id = ?';
        params.push(req.query.designer_id);
    }

    query += ' ORDER BY s.created_at DESC';
    const scores = db.prepare(query).all(...params);
    res.json(scores);
});

// GET /api/scores/document/:documentId — score for a specific document
router.get('/document/:documentId', (req, res) => {
    const db = getDb();
    const score = db.prepare('SELECT * FROM scores WHERE document_id = ?').get(req.params.documentId);
    if (!score) return res.status(404).json({ error: 'Score not found' });
    res.json(score);
});

export default router;
