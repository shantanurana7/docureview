import React, { useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { parseJsonFile, applyLoadedData, mergeLoadedData, hasExistingData, saveToLocalStorage, downloadJson } from '../services/localStore';
import { DocuReviewData } from '../types';
import { Save, Download, FolderOpen, Plus, AlertTriangle, X } from 'lucide-react';

type ConflictAction = 'replace' | 'merge' | 'cancel';

export default function Navbar() {
    const navigate = useNavigate();
    const location = useLocation();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Conflict resolution modal state
    const [showConflict, setShowConflict] = useState(false);
    const [pendingData, setPendingData] = useState<DocuReviewData | null>(null);
    const [pendingFileName, setPendingFileName] = useState('');

    const handleLoadJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const parsed = await parseJsonFile(file);

            // If we have existing data and the uploaded file also has data, show conflict modal
            if (hasExistingData() && parsed.reviews.length > 0) {
                setPendingData(parsed);
                setPendingFileName(file.name);
                setShowConflict(true);
            } else {
                // No conflict — just load it
                applyLoadedData(parsed);
                alert('Data loaded successfully!');
                navigate('/');
            }
        } catch (err: any) {
            alert('Failed to load JSON: ' + err.message);
        }
        // Reset input so same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleConflictChoice = (action: ConflictAction) => {
        if (!pendingData) return;
        switch (action) {
            case 'replace':
                applyLoadedData(pendingData);
                alert('Loaded file data replaced current data.');
                navigate('/');
                break;
            case 'merge':
                mergeLoadedData(pendingData);
                alert('File data merged with current data. Duplicate reviews were skipped.');
                navigate('/');
                break;
            case 'cancel':
                break;
        }
        setShowConflict(false);
        setPendingData(null);
        setPendingFileName('');
    };

    const handleSaveJson = () => {
        saveToLocalStorage();
        alert('Data saved to browser session!');
    };

    const handleDownloadJson = () => {
        downloadJson();
    };

    const isActive = (path: string) => location.pathname === path;

    return (
        <>
            <nav className="bg-white border-b border-surface-200 px-6 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
                        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-sm">DR</span>
                        </div>
                        <span className="text-lg font-bold text-surface-800">DocuReview</span>
                    </div>

                    {/* Navigation Links */}
                    <div className="flex items-center gap-1 ml-4">
                        <button
                            onClick={() => navigate('/')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${isActive('/') ? 'bg-brand-50 text-brand-700' : 'text-surface-600 hover:text-surface-800 hover:bg-surface-100'}`}
                        >
                            Dashboard
                        </button>
                        <button
                            onClick={() => navigate('/upload')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${isActive('/upload') ? 'bg-brand-50 text-brand-700' : 'text-surface-600 hover:text-surface-800 hover:bg-surface-100'}`}
                        >
                            <Plus size={14} /> New Review
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Load JSON */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleLoadJson}
                        className="hidden"
                        id="load-json-input"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-surface-600 border border-surface-300 rounded-lg hover:bg-surface-50 transition-colors"
                        title="Load a previously saved JSON data file"
                    >
                        <FolderOpen size={15} /> Load JSON
                    </button>

                    {/* Save JSON (to localStorage) */}
                    <button
                        onClick={handleSaveJson}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-surface-600 border border-surface-300 rounded-lg hover:bg-surface-50 transition-colors"
                        title="Save current data to browser session"
                    >
                        <Save size={15} /> Save
                    </button>

                    {/* Download JSON */}
                    <button
                        onClick={handleDownloadJson}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors"
                        title="Download data as JSON file to your computer"
                    >
                        <Download size={15} /> Download JSON
                    </button>
                </div>
            </nav>

            {/* Conflict Resolution Modal */}
            {showConflict && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => handleConflictChoice('cancel')} />
                    <div className="relative bg-white rounded-2xl shadow-2xl border border-surface-200 w-[460px] overflow-hidden animate-fade-in">
                        {/* Header */}
                        <div className="flex items-center gap-3 p-5 border-b border-surface-100 bg-amber-50">
                            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <AlertTriangle size={20} className="text-amber-600" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-surface-800">Existing Data Detected</h3>
                                <p className="text-xs text-surface-500 mt-0.5">You have unsaved review data in the current session.</p>
                            </div>
                            <button onClick={() => handleConflictChoice('cancel')} className="ml-auto p-1 text-surface-400 hover:text-surface-600 rounded">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-5">
                            <p className="text-sm text-surface-600 mb-4">
                                The file <strong className="text-surface-800">"{pendingFileName}"</strong> contains <strong>{pendingData?.reviews.length}</strong> review(s).
                                What would you like to do?
                            </p>

                            <div className="space-y-2">
                                <button
                                    onClick={() => handleConflictChoice('replace')}
                                    className="w-full flex items-start gap-3 p-3 rounded-xl border border-surface-200 hover:border-amber-300 hover:bg-amber-50/50 transition-all text-left group"
                                >
                                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <span className="text-amber-700 font-bold text-xs">1</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-surface-800">Use Uploaded File Only</p>
                                        <p className="text-xs text-surface-500 mt-0.5">Replace all current data with the uploaded file's data.</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => handleConflictChoice('merge')}
                                    className="w-full flex items-start gap-3 p-3 rounded-xl border border-surface-200 hover:border-brand-300 hover:bg-brand-50/50 transition-all text-left group"
                                >
                                    <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <span className="text-brand-700 font-bold text-xs">2</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-surface-800">Merge Both</p>
                                        <p className="text-xs text-surface-500 mt-0.5">Keep current data and add new reviews from the uploaded file. Duplicates are skipped.</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => handleConflictChoice('cancel')}
                                    className="w-full flex items-start gap-3 p-3 rounded-xl border border-surface-200 hover:border-surface-300 hover:bg-surface-50 transition-all text-left group"
                                >
                                    <div className="w-8 h-8 bg-surface-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <span className="text-surface-500 font-bold text-xs">3</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-surface-800">Cancel Upload</p>
                                        <p className="text-xs text-surface-500 mt-0.5">Discard the uploaded file and keep current data unchanged.</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
