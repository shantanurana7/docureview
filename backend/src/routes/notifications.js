import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/schema.js';

const router = Router();

// GET /api/notifications/:userId — get notifications for a user
router.get('/:userId', (req, res) => {
    const db = getDb();
    const notifications = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.params.userId);
    res.json(notifications);
});

// GET /api/notifications/:userId/unread-count
router.get('/:userId/unread-count', (req, res) => {
    const db = getDb();
    const result = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0').get(req.params.userId);
    res.json({ count: result.count });
});

// PUT /api/notifications/:id/read — mark as read
router.put('/:id/read', (req, res) => {
    const db = getDb();
    db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// PUT /api/notifications/:userId/read-all — mark all as read
router.put('/:userId/read-all', (req, res) => {
    const db = getDb();
    db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.params.userId);
    res.json({ success: true });
});

// DELETE /api/notifications/:id — delete a notification
router.delete('/:id', (req, res) => {
    const db = getDb();
    db.prepare('DELETE FROM notifications WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

export default router;
