import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/schema.js';

const router = Router();

// GET /api/users — list all users
router.get('/', (req, res) => {
    const db = getDb();
    const users = db.prepare('SELECT id, email, name, role, stream, created_at FROM users').all();
    res.json(users);
});

// GET /api/users/reviewers — list reviewers only
router.get('/reviewers', (req, res) => {
    const db = getDb();
    const reviewers = db.prepare('SELECT id, email, name, role, stream FROM users WHERE role = ?').all('reviewer');
    res.json(reviewers);
});

// GET /api/users/designers — list designers only
router.get('/designers', (req, res) => {
    const db = getDb();
    const designers = db.prepare('SELECT id, email, name, role, stream FROM users WHERE role = ?').all('designer');
    res.json(designers);
});

// GET /api/users/:id — single user
router.get('/:id', (req, res) => {
    const db = getDb();
    const user = db.prepare('SELECT id, email, name, role, stream, created_at FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
});

// POST /api/users — create user (admin)
router.post('/', (req, res) => {
    const { email, password, name, role, stream } = req.body;
    if (!email || !password || !name || !role) return res.status(400).json({ error: 'Missing required fields' });
    if (!['designer', 'reviewer'].includes(role)) return res.status(400).json({ error: 'Role must be designer or reviewer' });

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    const id = uuidv4();
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (id, email, password, name, role, stream) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, email, hash, name, role, stream || '');

    res.status(201).json({ id, email, name, role, stream: stream || '' });
});

// PUT /api/users/:id — update user (admin)
router.put('/:id', (req, res) => {
    const { email, password, name, role, stream } = req.body;
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updates = {
        email: email || user.email,
        name: name || user.name,
        role: role || user.role,
        stream: stream !== undefined ? stream : user.stream,
        password: password ? bcrypt.hashSync(password, 10) : user.password,
    };

    db.prepare('UPDATE users SET email = ?, password = ?, name = ?, role = ?, stream = ? WHERE id = ?')
        .run(updates.email, updates.password, updates.name, updates.role, updates.stream, req.params.id);

    res.json({ id: req.params.id, email: updates.email, name: updates.name, role: updates.role, stream: updates.stream });
});

// DELETE /api/users/:id — delete user (admin)
router.delete('/:id', (req, res) => {
    const db = getDb();
    const result = db.prepare('DELETE FROM users WHERE id = ? AND role != ?').run(req.params.id, 'admin');
    if (result.changes === 0) return res.status(404).json({ error: 'User not found or cannot delete admin' });
    res.json({ success: true });
});

export default router;
