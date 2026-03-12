import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const storage = multer.diskStorage({
    destination: path.join(__dirname, '..', '..', 'uploads'),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    }
});
const upload = multer({ storage });

const router = Router();

// POST /api/documents/upload — designer uploads a file
router.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { designer_id, reviewer_id, job_id, deliverable_type, complexity, due_date, delivery_date } = req.body;
    if (!designer_id || !reviewer_id || !job_id || !deliverable_type) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const db = getDb();
    const id = uuidv4();
    const title = req.file.originalname;
    const filepath = req.file.filename;

    db.prepare(`INSERT INTO documents (id, designer_id, reviewer_id, title, filepath, original_filename, job_id, deliverable_type, complexity, due_date, delivery_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`)
        .run(id, designer_id, reviewer_id, title, filepath, req.file.originalname, job_id, deliverable_type, complexity || '', due_date || '', delivery_date || '');

    // Create notification for reviewer
    const notifId = uuidv4();
    const designer = db.prepare('SELECT name FROM users WHERE id = ?').get(designer_id);
    db.prepare('INSERT INTO notifications (id, user_id, message, target_url) VALUES (?, ?, ?, ?)')
        .run(notifId, reviewer_id, `${designer?.name || 'A designer'} assigned a file for review: ${title}`, '/reviewer/assigned');

    res.status(201).json({ id, title, filepath, status: 'pending' });
});

// GET /api/documents/designer/:designerId — documents uploaded by a designer
router.get('/designer/:designerId', (req, res) => {
    const db = getDb();
    const docs = db.prepare(`
    SELECT d.*, u.name as reviewer_name 
    FROM documents d 
    LEFT JOIN users u ON d.reviewer_id = u.id 
    WHERE d.designer_id = ? 
    ORDER BY d.created_at DESC`).all(req.params.designerId);
    res.json(docs);
});

// GET /api/documents/reviewer/:reviewerId — documents assigned to a reviewer
router.get('/reviewer/:reviewerId', (req, res) => {
    const db = getDb();
    const docs = db.prepare(`
    SELECT d.*, u.name as designer_name 
    FROM documents d 
    LEFT JOIN users u ON d.designer_id = u.id 
    WHERE d.reviewer_id = ? 
    ORDER BY d.created_at DESC`).all(req.params.reviewerId);
    res.json(docs);
});

// GET /api/documents/:id — single document
router.get('/:id', (req, res) => {
    const db = getDb();
    const doc = db.prepare(`
    SELECT d.*, 
      du.name as designer_name, 
      ru.name as reviewer_name 
    FROM documents d 
    LEFT JOIN users du ON d.designer_id = du.id 
    LEFT JOIN users ru ON d.reviewer_id = ru.id 
    WHERE d.id = ?`).get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(doc);
});

// GET /api/documents/:id/file — serve the actual file (bypasses Vite proxy issues)
router.get('/:id/file', (req, res) => {
    const db = getDb();
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const filePath = path.join(__dirname, '..', '..', 'uploads', doc.filepath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

    const ext = doc.filepath.split('.').pop()?.toLowerCase();
    const mimeTypes = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline');
    res.sendFile(path.resolve(filePath));
});

// GET /api/documents/:id/file/base64 — returns file as base64 string (prevents download manager hijacking)
router.get('/:id/file/base64', (req, res) => {
    const db = getDb();
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const filePath = path.join(__dirname, '..', '..', 'uploads', doc.filepath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

    const fileData = fs.readFileSync(filePath);
    const base64Data = fileData.toString('base64');
    
    res.json({ base64: base64Data });
});

// PUT /api/documents/:id/status — update document status
router.put('/:id/status', (req, res) => {
    const { status } = req.body;
    if (!['pending', 'in_review', 'reviewed', 'completed'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }
    const db = getDb();
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    db.prepare('UPDATE documents SET status = ? WHERE id = ?').run(status, req.params.id);

    // Create notifications based on status change
    if (status === 'reviewed') {
        // Notify designer that review is complete
        const notifId = uuidv4();
        const reviewer = db.prepare('SELECT name FROM users WHERE id = ?').get(doc.reviewer_id);
        db.prepare('INSERT INTO notifications (id, user_id, message, target_url) VALUES (?, ?, ?, ?)')
            .run(notifId, doc.designer_id, `${reviewer?.name || 'Reviewer'} has completed the review for: ${doc.title}`, '/designer/reviewed');
    }

    res.json({ success: true, status });
});

// DELETE /api/documents/:id — designer can rollback/delete a pending document
router.delete('/:id', (req, res) => {
    const db = getDb();
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // Only allow deletion if status is 'pending' (reviewer hasn't started)
    if (doc.status !== 'pending') {
        return res.status(403).json({ error: 'Cannot delete — reviewer has already started the review' });
    }

    // Delete associated data
    db.prepare('DELETE FROM annotations WHERE document_id = ?').run(req.params.id);
    db.prepare('DELETE FROM scores WHERE document_id = ?').run(req.params.id);
    db.prepare("DELETE FROM notifications WHERE target_url LIKE ?").run(`%${req.params.id}%`);

    // Delete the document record
    db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);

    // Try to delete the physical file
    try {
        const filePath = path.join(__dirname, '..', '..', 'uploads', doc.filepath);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) { /* ignore file deletion errors */ }

    res.json({ success: true });
});

export default router;
