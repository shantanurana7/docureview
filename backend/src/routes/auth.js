import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db/schema.js';

const router = Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    // Return user info (no JWT for local dev — simple session-like response)
    const { password: _, ...safeUser } = user;
    res.json({ user: safeUser });
});

export default router;
