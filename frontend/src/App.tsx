import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import ReviewerDashboard from './pages/ReviewerDashboard';
import UploadPage from './pages/UploadPage';
import ReviewPage from './pages/ReviewPage';
import ViewReviewedPage from './pages/ViewReviewedPage';

export default function App() {
    return (
        <div className="min-h-screen bg-surface-50">
            <Navbar />
            <Routes>
                <Route path="/" element={<ReviewerDashboard />} />
                <Route path="/upload" element={<UploadPage />} />
                <Route path="/review/:reviewId" element={<ReviewPage />} />
                <Route path="/view/:reviewId" element={<ViewReviewedPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </div>
    );
}
