const API_BASE = '/api';

async function request(url: string, options?: RequestInit) {
    const res = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers: {
            ...(options?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
            ...options?.headers,
        },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

// Auth
export const authApi = {
    login: (email: string, password: string) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
};

// Users
export const usersApi = {
    getAll: () => request('/users'),
    getReviewers: () => request('/users/reviewers'),
    getDesigners: () => request('/users/designers'),
    getById: (id: string) => request(`/users/${id}`),
    create: (data: any) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/users/${id}`, { method: 'DELETE' }),
};

// Documents
export const documentsApi = {
    upload: (formData: FormData) => fetch(`${API_BASE}/documents/upload`, { method: 'POST', body: formData }).then(r => r.json()),
    getByDesigner: (designerId: string) => request(`/documents/designer/${designerId}`),
    getByReviewer: (reviewerId: string) => request(`/documents/reviewer/${reviewerId}`),
    getById: (id: string) => request(`/documents/${id}`),
    updateStatus: (id: string, status: string) => request(`/documents/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    delete: (id: string) => request(`/documents/${id}`, { method: 'DELETE' }),
    getFileUrl: (id: string) => `${API_BASE}/documents/${id}/file`,
    getFileBase64: (id: string) => request(`/documents/${id}/file/base64`),
};

// Annotations
export const annotationsApi = {
    getByDocument: (docId: string) => request(`/annotations/${docId}`),
    save: (docId: string, annotations: any[]) => request(`/annotations/${docId}`, { method: 'POST', body: JSON.stringify({ annotations }) }),
    resolve: (annotationId: string) => request(`/annotations/${annotationId}/resolve`, { method: 'PUT' }),
};

// Scores
export const scoresApi = {
    submit: (data: any) => request('/scores', { method: 'POST', body: JSON.stringify(data) }),
    getByReviewer: (reviewerId: string, designerId?: string) => {
        const params = designerId ? `?designer_id=${designerId}` : '';
        return request(`/scores/reviewer/${reviewerId}${params}`);
    },
    getByDocument: (docId: string) => request(`/scores/document/${docId}`),
};

// Notifications
export const notificationsApi = {
    getByUser: (userId: string) => request(`/notifications/${userId}`),
    getUnreadCount: (userId: string) => request(`/notifications/${userId}/unread-count`),
    markRead: (id: string) => request(`/notifications/${id}/read`, { method: 'PUT' }),
    markAllRead: (userId: string) => request(`/notifications/${userId}/read-all`, { method: 'PUT' }),
    delete: (id: string) => request(`/notifications/${id}`, { method: 'DELETE' }),
};
