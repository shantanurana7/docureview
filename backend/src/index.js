import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db/schema.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import documentsRoutes from './routes/documents.js';
import annotationsRoutes from './routes/annotations.js';
import scoresRoutes from './routes/scores.js';
import notificationsRoutes from './routes/notifications.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded files — ensure PDFs aren't downloaded
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.pdf')) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline');
        }
    }
}));

// Initialize database
getDb();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/annotations', annotationsRoutes);
app.use('/api/scores', scoresRoutes);
app.use('/api/notifications', notificationsRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`DocuReview backend running at http://localhost:${PORT}`);
});
