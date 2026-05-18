import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { addReview, fileToBase64 } from '../services/localStore';
import { Review } from '../types';
import { Upload, Image, Play } from 'lucide-react';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

export default function UploadPage() {
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [file, setFile] = useState<File | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);

    // Metadata fields
    const [title, setTitle] = useState('');
    const [jobId, setJobId] = useState('');
    const [designerName, setDesignerName] = useState('');
    const [designerEmail, setDesignerEmail] = useState('');
    const [emailTouched, setEmailTouched] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const isEmailValid = EMAIL_REGEX.test(designerEmail.trim());

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (!selected) return;

        const ext = selected.name.split('.').pop()?.toLowerCase();
        if (!['png', 'jpg', 'jpeg'].includes(ext || '')) {
            alert('Unsupported file type. Please upload a PNG, JPG, or JPEG image.');
            e.target.value = '';
            return;
        }

        setFile(selected);
        setFilePreview(URL.createObjectURL(selected));
        if (!title) {
            setTitle(selected.name.replace(/\.[^.]+$/, ''));
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const dropped = e.dataTransfer.files?.[0];
        if (!dropped) return;
        const ext = dropped.name.split('.').pop()?.toLowerCase();
        if (!['png', 'jpg', 'jpeg'].includes(ext || '')) {
            alert('Unsupported file type. Please upload a PNG, JPG, or JPEG image.');
            return;
        }
        setFile(dropped);
        setFilePreview(URL.createObjectURL(dropped));
        if (!title) setTitle(dropped.name.replace(/\.[^.]+$/, ''));
    };

    const handleStartReview = async () => {
        if (!file || !title.trim() || !jobId.trim() || !designerName.trim()) {
            alert('Please fill in all required fields and upload an image.');
            return;
        }
        if (!isEmailValid) {
            setEmailTouched(true);
            alert('Please enter a valid email address for the designer.');
            return;
        }

        setSubmitting(true);
        try {
            const reviewId = crypto.randomUUID();
            const blobUrl = URL.createObjectURL(file);
            const base64 = await fileToBase64(file);

            const review: Review = {
                id: reviewId,
                title: title.trim(),
                job_id: jobId.trim(),
                designer_name: designerName.trim(),
                designer_email: designerEmail.trim(),
                status: 'in_progress',
                created_at: new Date().toISOString(),
                annotations: [],
                score: null,
                fileBase64: base64,
                fileBlob: file,
                fileBlobUrl: blobUrl,
                fileType: 'image',
                original_filename: file.name,
            };

            addReview(review);
            navigate(`/review/${reviewId}`);
        } catch (err: any) {
            alert('Error starting review: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const canSubmit = file && title.trim() && jobId.trim() && designerName.trim() && isEmailValid && !submitting;

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-surface-800">New Brand Review</h1>
                <p className="text-sm text-surface-500 mt-1">Upload an image to start your brand compliance review</p>
            </div>

            <div className="bg-white rounded-2xl shadow-card border border-surface-200 overflow-hidden">
                {/* File Upload Area */}
                <div className="p-6 border-b border-surface-100">
                    <h3 className="text-sm font-semibold text-surface-700 mb-3">Upload Image</h3>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".png,.jpg,.jpeg"
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    {!file ? (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            onDrop={handleDrop}
                            onDragOver={(e) => e.preventDefault()}
                            className="border-2 border-dashed border-surface-300 rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-all"
                        >
                            <Upload size={40} className="text-surface-400 mb-3" />
                            <p className="text-sm font-medium text-surface-600">Click or drag & drop to upload</p>
                            <p className="text-xs text-surface-400 mt-1">Supported formats: PNG, JPG, JPEG</p>
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-center gap-4 p-4 bg-surface-50 rounded-xl border border-surface-200 mb-3">
                                <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Image size={20} className="text-brand-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-surface-700 truncate">{file.name}</p>
                                    <p className="text-xs text-surface-400">{(file.size / 1024).toFixed(1)} KB · {file.name.split('.').pop()?.toUpperCase()}</p>
                                </div>
                                <button
                                    onClick={() => { setFile(null); setFilePreview(null); }}
                                    className="text-xs text-surface-500 hover:text-danger font-medium px-2 py-1 rounded hover:bg-surface-100"
                                >
                                    Remove
                                </button>
                            </div>
                            {filePreview && (
                                <img src={filePreview} alt="Preview" className="rounded-lg max-h-48 object-contain border border-surface-200 w-full" />
                            )}
                        </div>
                    )}
                </div>

                {/* Metadata Form */}
                <div className="p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-surface-700 mb-1">Review Details</h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-surface-600 mb-1">File Name <span className="text-danger">*</span></label>
                            <input
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="w-full p-2.5 border border-surface-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                                placeholder="e.g. LinkedIn Banner v2"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-surface-600 mb-1">Job ID <span className="text-danger">*</span></label>
                            <input
                                value={jobId}
                                onChange={e => setJobId(e.target.value)}
                                className="w-full p-2.5 border border-surface-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                                placeholder="e.g. JOB-001"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-surface-600 mb-1">Designer Name <span className="text-danger">*</span></label>
                            <input
                                value={designerName}
                                onChange={e => setDesignerName(e.target.value)}
                                className="w-full p-2.5 border border-surface-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                                placeholder="e.g. Jane Doe"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-surface-600 mb-1">Designer Email <span className="text-danger">*</span></label>
                            <input
                                value={designerEmail}
                                onChange={e => setDesignerEmail(e.target.value)}
                                onBlur={() => setEmailTouched(true)}
                                type="email"
                                className={`w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-colors ${
                                    emailTouched && !isEmailValid
                                        ? 'border-red-400 bg-red-50/50 focus:ring-red-400'
                                        : 'border-surface-300'
                                }`}
                                placeholder="e.g. jane@company.com"
                            />
                            {emailTouched && !isEmailValid && (
                                <p className="text-[11px] text-red-500 mt-1">Please enter a valid email address</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-6 border-t border-surface-100 bg-surface-50 flex justify-end">
                    <button
                        onClick={handleStartReview}
                        disabled={!canSubmit}
                        className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? <i className="pi pi-spin pi-spinner" /> : <Play size={16} />}
                        {submitting ? 'Preparing...' : 'Start Review'}
                    </button>
                </div>
            </div>
        </div>
    );
}
