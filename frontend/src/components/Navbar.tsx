import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notificationsApi } from '../services/api';
import { Notification } from '../types';
import { Bell, User, LogOut, ChevronDown, X } from 'lucide-react';

export default function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showNotifs, setShowNotifs] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const notifRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!user) return;
        loadNotifications();
        const interval = setInterval(loadNotifications, 15000);
        return () => clearInterval(interval);
    }, [user]);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false);
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const loadNotifications = async () => {
        if (!user) return;
        try {
            const [notifs, countData] = await Promise.all([
                notificationsApi.getByUser(user.id),
                notificationsApi.getUnreadCount(user.id)
            ]);
            setNotifications(notifs);
            setUnreadCount(countData.count);
        } catch { /* ignore */ }
    };

    const handleNotifClick = async (notif: Notification) => {
        if (!notif.read) {
            await notificationsApi.markRead(notif.id);
            setUnreadCount(c => Math.max(0, c - 1));
        }
        setShowNotifs(false);
        if (notif.target_url) navigate(notif.target_url);
    };

    const handleDeleteNotif = async (e: React.MouseEvent, notif: Notification) => {
        e.stopPropagation();
        try {
            await notificationsApi.delete(notif.id);
            setNotifications(prev => prev.filter(n => n.id !== notif.id));
            if (!notif.read) setUnreadCount(c => Math.max(0, c - 1));
        } catch { /* ignore */ }
    };

    const handleMarkAllRead = async () => {
        if (!user) return;
        await notificationsApi.markAllRead(user.id);
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, read: 1 })));
    };

    if (!user) return null;

    return (
        <nav className="bg-white border-b border-surface-200 px-6 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
                <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">DR</span>
                </div>
                <span className="text-lg font-bold text-surface-800">DocuReview</span>
            </div>

            <div className="flex items-center gap-2">
                {/* Notifications */}
                <div ref={notifRef} className="relative">
                    <button
                        onClick={() => setShowNotifs(!showNotifs)}
                        className="relative p-2 rounded-lg hover:bg-surface-100 transition-colors"
                    >
                        <Bell size={20} className="text-surface-600" />
                        {unreadCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 bg-danger text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {showNotifs && (
                        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-surface-200 overflow-hidden animate-fade-in z-50">
                            <div className="flex items-center justify-between p-3 border-b border-surface-100 bg-surface-50">
                                <span className="text-sm font-semibold text-surface-800">Notifications</span>
                                {unreadCount > 0 && (
                                    <button onClick={handleMarkAllRead} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                                        Mark all read
                                    </button>
                                )}
                            </div>
                            <div className="max-h-72 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <p className="p-4 text-sm text-surface-400 text-center">No notifications</p>
                                ) : (
                                    notifications.map(n => (
                                        <div
                                            key={n.id}
                                            className={`w-full text-left px-4 py-3 border-b border-surface-50 hover:bg-surface-50 transition-colors flex items-start gap-2 group ${!n.read ? 'bg-brand-50/50' : ''}`}
                                        >
                                            <button onClick={() => handleNotifClick(n)} className="flex-1 text-left min-w-0">
                                                <p className="text-sm text-surface-700">{n.message}</p>
                                                <p className="text-xs text-surface-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                                            </button>
                                            <button
                                                onClick={(e) => handleDeleteNotif(e, n)}
                                                className="mt-0.5 p-1 rounded hover:bg-surface-200 text-surface-400 hover:text-danger opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                                                title="Remove notification"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* User Menu */}
                <div ref={userMenuRef} className="relative">
                    <button
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-100 transition-colors"
                    >
                        <div className="w-8 h-8 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center">
                            <span className="text-sm font-semibold">{user.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <ChevronDown size={14} className="text-surface-400" />
                    </button>

                    {showUserMenu && (
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-surface-200 overflow-hidden animate-fade-in z-50">
                            <div className="p-3 border-b border-surface-100 bg-surface-50">
                                <p className="text-sm font-semibold text-surface-800">{user.name}</p>
                                <p className="text-xs text-surface-400">{user.email}</p>
                                <span className="inline-block mt-1 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-brand-100 text-brand-700">
                                    {user.role}
                                </span>
                            </div>
                            <button
                                onClick={() => { logout(); navigate('/login'); setShowUserMenu(false); }}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-danger hover:bg-danger-light transition-colors"
                            >
                                <LogOut size={16} />
                                <span>Logout</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}
