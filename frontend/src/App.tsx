import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import DesignerDashboard from './pages/DesignerDashboard';
import ReviewerDashboard from './pages/ReviewerDashboard';
import ReviewPage from './pages/ReviewPage';
import ViewReviewedPage from './pages/ViewReviewedPage';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
    const { user, isLoading } = useAuth();
    if (isLoading) return <div className="flex items-center justify-center h-screen"><i className="pi pi-spin pi-spinner text-4xl text-brand-600" /></div>;
    if (!user) return <Navigate to="/login" replace />;
    if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
    return <>{children}</>;
}

export default function App() {
    const { user } = useAuth();

    const getDefaultRoute = () => {
        if (!user) return '/login';
        if (user.role === 'admin') return '/admin';
        if (user.role === 'designer') return '/designer';
        if (user.role === 'reviewer') return '/reviewer';
        return '/login';
    };

    return (
        <div className="min-h-screen bg-surface-50">
            {user && <Navbar />}
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminPage /></ProtectedRoute>} />
                <Route path="/designer/*" element={<ProtectedRoute allowedRoles={['designer']}><DesignerDashboard /></ProtectedRoute>} />
                <Route path="/reviewer" element={<ProtectedRoute allowedRoles={['reviewer']}><ReviewerDashboard /></ProtectedRoute>} />
                <Route path="/reviewer/assigned" element={<ProtectedRoute allowedRoles={['reviewer']}><ReviewerDashboard defaultTab="assigned" /></ProtectedRoute>} />
                <Route path="/reviewer/review/:documentId" element={<ProtectedRoute allowedRoles={['reviewer']}><ReviewPage /></ProtectedRoute>} />
                <Route path="/reviewer/view/:documentId" element={<ProtectedRoute allowedRoles={['reviewer']}><ViewReviewedPage /></ProtectedRoute>} />
                <Route path="/designer/reviewed" element={<ProtectedRoute allowedRoles={['designer']}><DesignerDashboard defaultTab="reviewed" /></ProtectedRoute>} />
                <Route path="/designer/view/:documentId" element={<ProtectedRoute allowedRoles={['designer']}><ViewReviewedPage /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to={getDefaultRoute()} replace />} />
            </Routes>
        </div>
    );
}
