import React, { useState, useEffect } from 'react';
import { usersApi } from '../services/api';
import { User } from '../types';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Tag } from 'primereact/tag';
import { UserPlus, Pencil, Trash2 } from 'lucide-react';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function AdminPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogVisible, setDialogVisible] = useState(false);
    const [editUser, setEditUser] = useState<Partial<User> & { password?: string }>({});
    const [isEditing, setIsEditing] = useState(false);
    const [emailError, setEmailError] = useState<string | null>(null);

    const validateEmail = (email: string) => {
        if (!email.trim()) { setEmailError('Email is required'); return false; }
        if (!EMAIL_REGEX.test(email)) { setEmailError('Please enter a valid email address'); return false; }
        setEmailError(null); return true;
    };

    const isFormValid = !!(editUser.name?.trim() && editUser.email?.trim() && EMAIL_REGEX.test(editUser.email) && editUser.role && (!isEditing || true) && (isEditing || editUser.password?.trim()));

    useEffect(() => { loadUsers(); }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const data = await usersApi.getAll();
            setUsers(data.filter((u: User) => u.role !== 'admin'));
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const openNew = () => {
        setEditUser({ role: 'designer' });
        setIsEditing(false);
        setDialogVisible(true);
    };

    const openEdit = (user: User) => {
        setEditUser({ ...user, password: '' });
        setIsEditing(true);
        setDialogVisible(true);
    };

    const handleSave = async () => {
        if (!editUser.email || !validateEmail(editUser.email)) return;
        if (!isFormValid) return;
        try {
            if (isEditing && editUser.id) {
                const payload: any = { email: editUser.email, name: editUser.name, role: editUser.role, stream: editUser.stream };
                if (editUser.password) payload.password = editUser.password;
                await usersApi.update(editUser.id, payload);
            } else {
                await usersApi.create(editUser);
            }
            setDialogVisible(false);
            setEmailError(null);
            loadUsers();
        } catch (e: any) { alert(e.message); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this user?')) return;
        try {
            await usersApi.delete(id);
            loadUsers();
        } catch (e: any) { alert(e.message); }
    };

    const roleBodyTemplate = (rowData: User) => {
        const severity = rowData.role === 'designer' ? 'info' : 'success';
        return <Tag value={rowData.role} severity={severity} className="capitalize text-xs" />;
    };

    const actionsBodyTemplate = (rowData: User) => (
        <div className="flex gap-2">
            <button onClick={() => openEdit(rowData)} className="p-2 rounded-lg hover:bg-surface-100 text-surface-500 hover:text-brand-600 transition-colors" title="Edit">
                <Pencil size={16} />
            </button>
            <button onClick={() => handleDelete(rowData.id)} className="p-2 rounded-lg hover:bg-danger-light text-surface-500 hover:text-danger transition-colors" title="Delete">
                <Trash2 size={16} />
            </button>
        </div>
    );

    const roles = [
        { label: 'Designer', value: 'designer' },
        { label: 'Reviewer', value: 'reviewer' },
    ];

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-surface-800">User Management</h1>
                    <p className="text-sm text-surface-500 mt-1">Add, edit, or remove designers and reviewers</p>
                </div>
                <button
                    onClick={openNew}
                    className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition-colors shadow-sm"
                >
                    <UserPlus size={18} />
                    <span>Add User</span>
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-card border border-surface-200 overflow-hidden">
                <DataTable value={users} loading={loading} paginator rows={10} emptyMessage="No users found" stripedRows
                    className="text-sm" rowHover>
                    <Column field="name" header="Name" sortable />
                    <Column field="email" header="Email" sortable />
                    <Column field="role" header="Role" body={roleBodyTemplate} sortable />
                    <Column field="stream" header="Stream" sortable />
                    <Column header="Actions" body={actionsBodyTemplate} style={{ width: '120px' }} />
                </DataTable>
            </div>

            <Dialog
                header={isEditing ? 'Edit User' : 'Add New User'}
                visible={dialogVisible}
                onHide={() => setDialogVisible(false)}
                style={{ width: '450px' }}
                className="rounded-2xl"
                modal
            >
                <div className="space-y-4 pt-2">
                    <div>
                        <label className="block text-sm font-medium text-surface-600 mb-1">Name</label>
                        <InputText
                            value={editUser.name || ''}
                            onChange={e => setEditUser({ ...editUser, name: e.target.value })}
                            className="w-full"
                            placeholder="Full name"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-surface-600 mb-1">Email</label>
                        <InputText
                            type="email"
                            value={editUser.email || ''}
                            onChange={e => { setEditUser({ ...editUser, email: e.target.value }); validateEmail(e.target.value); }}
                            onBlur={() => editUser.email && validateEmail(editUser.email)}
                            className={`w-full ${emailError ? 'p-invalid' : ''}`}
                            placeholder="user@example.com"
                        />
                        {emailError && <small className="text-danger text-xs mt-1 block">{emailError}</small>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-surface-600 mb-1">{isEditing ? 'New Password (leave blank to keep)' : 'Password'}</label>
                        <InputText
                            type="password"
                            value={editUser.password || ''}
                            onChange={e => setEditUser({ ...editUser, password: e.target.value })}
                            className="w-full"
                            placeholder="••••••••"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-surface-600 mb-1">Role</label>
                        <Dropdown
                            value={editUser.role}
                            options={roles}
                            onChange={e => setEditUser({ ...editUser, role: e.value })}
                            className="w-full"
                            placeholder="Select role"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-surface-600 mb-1">Stream</label>
                        <Dropdown
                            value={editUser.stream || ''}
                            options={[
                                { label: 'Graphics', value: 'Graphics' },
                                { label: 'Web', value: 'Web' },
                                { label: 'Motion', value: 'Motion' },
                                { label: 'Video', value: 'Video' },
                                { label: 'UI/UX', value: 'UI/UX' },
                                { label: 'Copywriting', value: 'Copywriting' }
                            ]}
                            onChange={e => setEditUser({ ...editUser, stream: e.value })}
                            className="w-full"
                            placeholder="Select a stream"
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-surface-200 mt-4">
                        <button onClick={() => setDialogVisible(false)} className="px-4 py-2 text-sm font-medium text-surface-600 border border-surface-300 rounded-lg hover:bg-surface-50 transition-colors">Cancel</button>
                        <button onClick={handleSave} disabled={!isFormValid} className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-50 transition-colors">
                            {isEditing ? 'Update' : 'Create'}
                        </button>
                    </div>
                </div>
            </Dialog>
        </div>
    );
}
