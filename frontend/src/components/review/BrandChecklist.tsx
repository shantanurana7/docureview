import React, { useEffect, useState } from 'react';
import { Platform, StyleOption, LogoTestResult } from '../../types';
import { ChevronDown, CheckCircle, Save, Ruler } from 'lucide-react';

// ── Platform required dimensions ──────────────────────────────────────────────
const PLATFORM_DIMS: Record<Platform, { w: number; h: number }> = {
    linkedin: { w: 1200, h: 700 },
    twitter:  { w: 1024, h: 1024 },
    ecomms:   { w: 600,  h: 400 },
};

const PLATFORM_OPTIONS: { label: string; value: Platform }[] = [
    { label: 'LinkedIn',  value: 'linkedin' },
    { label: 'Twitter',   value: 'twitter'  },
    { label: 'Ecomms',    value: 'ecomms'   },
];

const STYLE_OPTIONS: { label: string; value: StyleOption; desc: string }[] = [
    { label: 'Style 1.1', value: 'style1.1', desc: 'Human'                   },
    { label: 'Style 1.2', value: 'style1.2', desc: 'Object'                  },
    { label: 'Style 2',   value: 'style2',   desc: 'Only Text'               },
    { label: 'Style 3.1', value: 'style3.1', desc: 'Action Oriented'         },
    { label: 'Style 3.2', value: 'style3.2', desc: 'Architecture / Abstract' },
];

const NOT_OK_COMMENT =
    'Logo placement does not meet brand guidelines. Top-left logo clearance is insufficient. ' +
    'Please ensure the logo is placed within the safe zone with adequate clear space on all sides.';

const NOT_OK_MOTIF_COMMENT =
    'Window motif placement or ratio does not meet brand guidelines. ' +
    'Please ensure it covers the required safe zone and follows the correct aspect ratio.';

export interface LogoOverlayState {
    activeTest: 'logo' | 'window_motif' | null;
    pos: { x: number; y: number };
    scale: number;
    opacity: number;
    windowRatio: '7:10' | '10:7';
    testResult: 'ok' | 'not_ok' | null;
    testComment: string;
}

/** A committed (saved) result for one test — used for PDF export. */
export interface CommittedTestResult {
    result: 'ok' | 'not_ok';
    comment: string;
}

interface Props {
    overlayState: LogoOverlayState;
    onOverlayChange: (s: LogoOverlayState) => void;
    onSaveLogoResult:  (r: CommittedTestResult | null) => void;
    onSaveMotifResult: (r: CommittedTestResult | null) => void;
    onSaveSizeResult:  (r: CommittedTestResult | null) => void;
    /** Natural pixel dimensions of the uploaded image */
    imageDimensions: { w: number; h: number } | null;
}

// ── Reusable "Saved to PDF" badge ─────────────────────────────────────────────
function SavedBadge() {
    return (
        <div className="flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
            <CheckCircle size={10} /> Saved to PDF
        </div>
    );
}

export default function BrandChecklist({
    overlayState, onOverlayChange,
    onSaveLogoResult, onSaveMotifResult, onSaveSizeResult,
    imageDimensions,
}: Props) {
    const [platform, setPlatform] = useState<Platform | ''>('');
    const [style,    setStyle]    = useState<StyleOption | null>(null);

    // ── Size test ─────────────────────────────────────────────────────────────
    const [sizeComment, setSizeComment] = useState('');
    const [sizeSaved,   setSizeSaved]   = useState(false);
    // Computed once per platform+dimension combo
    const sizeCheck = (() => {
        if (!platform || !imageDimensions) return null;
        const req = PLATFORM_DIMS[platform as Platform];
        if (!req) return null;
        const pass = imageDimensions.w === req.w && imageDimensions.h === req.h;
        return { pass, req, actual: imageDimensions };
    })();

    // Auto-fill the default comment when the size check fails
    useEffect(() => {
        if (!sizeCheck) { setSizeComment(''); setSizeSaved(false); return; }
        setSizeSaved(false);
        if (!sizeCheck.pass) {
            const platformLabel = PLATFORM_OPTIONS.find(p => p.value === platform)?.label ?? platform;
            setSizeComment(
                `Image dimensions do not meet ${platformLabel} requirements. ` +
                `Expected ${sizeCheck.req.w}×${sizeCheck.req.h}px but the image is ` +
                `${sizeCheck.actual.w}×${sizeCheck.actual.h}px. ` +
                `Please resize the artwork before publishing.`
            );
            onSaveSizeResult(null); // clear any previous commit
        } else {
            setSizeComment('');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [platform, imageDimensions]);

    const handleSaveSize = () => {
        if (!sizeCheck) return;
        setSizeSaved(true);
        onSaveSizeResult({
            result:  sizeCheck.pass ? 'ok' : 'not_ok',
            comment: sizeCheck.pass ? '' : sizeComment,
        });
    };

    // ── Logo test ─────────────────────────────────────────────────────────────
    const [logoResult,  setLogoResult]  = useState<LogoTestResult>(null);
    const [logoComment, setLogoComment] = useState('');
    const [logoSaved,   setLogoSaved]   = useState(false);

    // ── Motif test ────────────────────────────────────────────────────────────
    const [motifResult,  setMotifResult]  = useState<LogoTestResult>(null);
    const [motifComment, setMotifComment] = useState('');
    const [motifSaved,   setMotifSaved]   = useState(false);

    // ── Reset helpers ─────────────────────────────────────────────────────────
    const resetAll = () => {
        setLogoResult(null);  setLogoComment('');  setLogoSaved(false);  onSaveLogoResult(null);
        setMotifResult(null); setMotifComment(''); setMotifSaved(false); onSaveMotifResult(null);
        setSizeSaved(false); onSaveSizeResult(null);
        onOverlayChange({ ...overlayState, activeTest: null, testResult: null, testComment: '' });
    };

    const handlePlatformChange = (val: Platform | '') => {
        setPlatform(val);
        setStyle(null);
        resetAll();
    };

    const handleStyleChange = (val: StyleOption) => {
        setStyle(val);
        // Don't reset size test — dimensions don't change with style
        setLogoResult(null);  setLogoComment('');  setLogoSaved(false);  onSaveLogoResult(null);
        setMotifResult(null); setMotifComment(''); setMotifSaved(false); onSaveMotifResult(null);
        onOverlayChange({ ...overlayState, activeTest: null, testResult: null, testComment: '' });
    };

    // ── Start overlay test ────────────────────────────────────────────────────
    const handleStartTest = (testType: 'logo' | 'window_motif') => {
        if (testType === 'logo') {
            setLogoResult(null); setLogoComment(''); setLogoSaved(false);
        } else {
            setMotifResult(null); setMotifComment(''); setMotifSaved(false);
        }
        onOverlayChange({
            activeTest:  testType,
            pos:         { x: 0, y: 0 },
            scale:       1,
            opacity:     1,
            windowRatio: '7:10',
            testResult:  null,
            testComment: '',
        });
    };

    // ── Logo result selection ─────────────────────────────────────────────────
    const handleLogoResultChange = (val: LogoTestResult) => {
        setLogoResult(val); setLogoSaved(false);
        const c = val === 'not_ok' ? NOT_OK_COMMENT : '';
        setLogoComment(c);
        onOverlayChange({ ...overlayState, testResult: val, testComment: c });
    };

    // ── Motif result selection ────────────────────────────────────────────────
    const handleMotifResultChange = (val: LogoTestResult) => {
        setMotifResult(val); setMotifSaved(false);
        const c = val === 'not_ok' ? NOT_OK_MOTIF_COMMENT : '';
        setMotifComment(c);
        onOverlayChange({ ...overlayState, testResult: val, testComment: c });
    };

    // ── Save handlers ─────────────────────────────────────────────────────────
    const handleSaveLogo = () => {
        if (!logoResult) return;
        setLogoSaved(true);
        onSaveLogoResult({ result: logoResult, comment: logoComment });
    };
    const handleSaveMotif = () => {
        if (!motifResult) return;
        setMotifSaved(true);
        onSaveMotifResult({ result: motifResult, comment: motifComment });
    };

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="border-t border-surface-100 flex-shrink-0">
            <div className="px-4 py-3 bg-surface-50 border-b border-surface-100">
                <h3 className="text-xs font-semibold text-surface-600 uppercase tracking-wide">Brand Checklist</h3>
            </div>

            <div className="p-4 space-y-4">
                {/* ── Platform Dropdown ──────────────────────────────────── */}
                <div>
                    <label className="block text-xs font-medium text-surface-600 mb-1.5">Platform</label>
                    <div className="relative">
                        <select
                            value={platform}
                            onChange={e => handlePlatformChange(e.target.value as Platform | '')}
                            className="w-full appearance-none p-2.5 pr-8 border border-surface-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                        >
                            <option value="">-- Select Platform --</option>
                            {PLATFORM_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
                    </div>
                </div>

                {/* ── Size Test (auto-runs on platform select) ───────────── */}
                {platform && (
                    <div className={`rounded-xl border overflow-hidden ${
                        sizeCheck === null
                            ? 'border-surface-200'
                            : sizeCheck.pass
                                ? 'border-green-200 bg-green-50/40'
                                : 'border-red-200 bg-red-50/30'
                    }`}>
                        {/* Header row */}
                        <div className={`flex items-center justify-between px-3 py-2 border-b ${
                            sizeCheck === null
                                ? 'bg-surface-50 border-surface-100'
                                : sizeCheck.pass
                                    ? 'bg-green-50 border-green-100'
                                    : 'bg-red-50/60 border-red-100'
                        }`}>
                            <div className="flex items-center gap-1.5">
                                <Ruler size={12} className={sizeCheck?.pass === false ? 'text-red-500' : 'text-surface-500'} />
                                <p className="text-[11px] font-semibold text-surface-600 uppercase tracking-wide">Image Size</p>
                            </div>
                            {sizeSaved && <SavedBadge />}
                        </div>

                        <div className="p-3 space-y-2">
                            {/* Loading state */}
                            {!imageDimensions && (
                                <p className="text-[11px] text-surface-400 italic">Waiting for image to load…</p>
                            )}

                            {/* Result */}
                            {sizeCheck && (
                                <>
                                    {/* Dimension comparison pills */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] text-surface-500 font-medium">Required:</span>
                                        <span className="text-[10px] font-bold bg-surface-100 text-surface-700 px-2 py-0.5 rounded-full">
                                            {sizeCheck.req.w} × {sizeCheck.req.h} px
                                        </span>
                                        <span className="text-[10px] text-surface-400">vs</span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{
                                            background: sizeCheck.pass ? '#dcfce7' : '#fee2e2',
                                            color:      sizeCheck.pass ? '#166534' : '#991b1b',
                                        }}>
                                            {sizeCheck.actual.w} × {sizeCheck.actual.h} px
                                        </span>
                                    </div>

                                    {/* Pass */}
                                    {sizeCheck.pass && (
                                        <div className="space-y-1.5">
                                            <p className="text-[11px] text-green-700 font-semibold">
                                                ✅ Image dimensions are correct for {PLATFORM_OPTIONS.find(p => p.value === platform)?.label}.
                                            </p>
                                            <button
                                                onClick={handleSaveSize}
                                                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
                                            >
                                                <Save size={11} /> Save Size Test Result
                                            </button>
                                        </div>
                                    )}

                                    {/* Fail */}
                                    {!sizeCheck.pass && (
                                        <div className="space-y-1.5">
                                            <p className="text-[11px] text-red-600 font-semibold">
                                                ❌ Size mismatch — image does not meet {PLATFORM_OPTIONS.find(p => p.value === platform)?.label} requirements.
                                            </p>
                                            <p className="text-[10px] text-red-500 font-medium">Edit comment if needed:</p>
                                            <textarea
                                                value={sizeComment}
                                                onChange={e => { setSizeComment(e.target.value); setSizeSaved(false); }}
                                                className="w-full p-2 border border-red-300 rounded-lg text-[11px] resize-none focus:ring-2 focus:ring-red-400 outline-none leading-relaxed bg-white"
                                                rows={4}
                                            />
                                            <button
                                                onClick={handleSaveSize}
                                                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
                                            >
                                                <Save size={11} /> Save Size Test Result
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Style Toggles ─────────────────────────────────────────── */}
                {platform && (
                    <div>
                        <label className="block text-xs font-medium text-surface-600 mb-2">Style</label>
                        <div className="flex flex-wrap gap-1.5">
                            {STYLE_OPTIONS.map(s => (
                                <button
                                    key={s.value}
                                    onClick={() => handleStyleChange(s.value)}
                                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all leading-tight text-center ${
                                        style === s.value
                                            ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                                            : 'border-surface-300 text-surface-600 hover:border-brand-400 hover:bg-brand-50'
                                    }`}
                                >
                                    <div>{s.label}</div>
                                    <div className={`text-[9px] font-normal mt-0.5 ${style === s.value ? 'text-brand-100' : 'text-surface-400'}`}>{s.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Overlay Tests Panel ───────────────────────────────────── */}
                {platform && style && (
                    <div className="border border-surface-200 rounded-xl overflow-hidden">
                        <div className="px-3 py-2 bg-surface-50 border-b border-surface-100">
                            <p className="text-[11px] font-semibold text-surface-500 uppercase tracking-wide">Overlay Tests</p>
                        </div>
                        <div className="p-3 space-y-3">

                            {/* ── Logo Top Left ──────────────────────────────── */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-surface-700">Logo — Top Left</p>
                                        <p className="text-[10px] text-surface-400">Test logo clearance &amp; placement</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {logoSaved && <SavedBadge />}
                                        <button
                                            onClick={() => handleStartTest('logo')}
                                            className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${
                                                overlayState.activeTest === 'logo'
                                                    ? 'bg-brand-700 text-white shadow-inner'
                                                    : 'bg-brand-600 text-white hover:bg-brand-700'
                                            }`}
                                        >
                                            {overlayState.activeTest === 'logo' ? 'Testing…' : logoSaved ? 'Re-test' : 'Test'}
                                        </button>
                                    </div>
                                </div>

                                {overlayState.activeTest === 'logo' && (
                                    <>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-[10px] text-surface-500 w-10">Scale</span>
                                            <input type="range" min={0.5} max={2.5} step={0.05}
                                                value={overlayState.scale}
                                                onChange={e => onOverlayChange({ ...overlayState, scale: parseFloat(e.target.value) })}
                                                className="flex-1 h-1.5 accent-brand-600"
                                            />
                                            <span className="text-[10px] text-surface-500 w-8 text-right">{overlayState.scale.toFixed(1)}x</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-surface-500 w-10">Opacity</span>
                                            <input type="range" min={0.1} max={1} step={0.05}
                                                value={overlayState.opacity ?? 1}
                                                onChange={e => onOverlayChange({ ...overlayState, opacity: parseFloat(e.target.value) })}
                                                className="flex-1 h-1.5 accent-brand-600"
                                            />
                                            <span className="text-[10px] text-surface-500 w-8 text-right">{Math.round((overlayState.opacity ?? 1) * 100)}%</span>
                                        </div>
                                        <div className="relative">
                                            <select
                                                value={logoResult ?? ''}
                                                onChange={e => handleLogoResultChange((e.target.value || null) as LogoTestResult)}
                                                className="w-full appearance-none p-2 pr-7 border border-surface-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                                            >
                                                <option value="">-- Logo placement result --</option>
                                                <option value="ok">✅  Ok — placement is correct</option>
                                                <option value="not_ok">❌  Not Ok — needs adjustment</option>
                                            </select>
                                            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
                                        </div>
                                        {logoResult === 'not_ok' && (
                                            <div className="space-y-1.5">
                                                <p className="text-[10px] text-red-500 font-medium">Issue flagged — edit comment if needed:</p>
                                                <textarea
                                                    value={logoComment}
                                                    onChange={e => { setLogoComment(e.target.value); setLogoSaved(false); onOverlayChange({ ...overlayState, testResult: 'not_ok', testComment: e.target.value }); }}
                                                    className="w-full p-2 border border-red-300 rounded-lg text-[11px] resize-none focus:ring-2 focus:ring-red-400 outline-none leading-relaxed bg-red-50/40"
                                                    rows={4}
                                                />
                                                <button onClick={handleSaveLogo} className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors">
                                                    <Save size={11} /> Save Logo Test Result
                                                </button>
                                            </div>
                                        )}
                                        {logoResult === 'ok' && (
                                            <div className="space-y-1.5">
                                                <p className="text-[11px] text-green-600 font-medium">✅ Logo placement looks good.</p>
                                                <button onClick={handleSaveLogo} className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors">
                                                    <Save size={11} /> Save Logo Test Result
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* ── Window Motif ───────────────────────────────── */}
                            <div className="space-y-2 pt-2 border-t border-surface-100">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-surface-700">Window Motif</p>
                                        <p className="text-[10px] text-surface-400">Test window motif coverage</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {motifSaved && <SavedBadge />}
                                        <button
                                            onClick={() => handleStartTest('window_motif')}
                                            className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${
                                                overlayState.activeTest === 'window_motif'
                                                    ? 'bg-brand-700 text-white shadow-inner'
                                                    : 'bg-brand-600 text-white hover:bg-brand-700'
                                            }`}
                                        >
                                            {overlayState.activeTest === 'window_motif' ? 'Testing…' : motifSaved ? 'Re-test' : 'Test'}
                                        </button>
                                    </div>
                                </div>

                                {overlayState.activeTest === 'window_motif' && (
                                    <>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-[10px] text-surface-500 w-10">Scale</span>
                                            <input type="range" min={0.5} max={5} step={0.1}
                                                value={overlayState.scale}
                                                onChange={e => onOverlayChange({ ...overlayState, scale: parseFloat(e.target.value) })}
                                                className="flex-1 h-1.5 accent-brand-600"
                                            />
                                            <span className="text-[10px] text-surface-500 w-8 text-right">{overlayState.scale.toFixed(1)}x</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-surface-500 w-10">Opacity</span>
                                            <input type="range" min={0.1} max={1} step={0.05}
                                                value={overlayState.opacity ?? 1}
                                                onChange={e => onOverlayChange({ ...overlayState, opacity: parseFloat(e.target.value) })}
                                                className="flex-1 h-1.5 accent-brand-600"
                                            />
                                            <span className="text-[10px] text-surface-500 w-8 text-right">{Math.round((overlayState.opacity ?? 1) * 100)}%</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-surface-500 w-10">Ratio</span>
                                            <div className="flex-1 flex bg-surface-100 p-0.5 rounded-md">
                                                <button
                                                    onClick={() => onOverlayChange({ ...overlayState, windowRatio: '7:10' })}
                                                    className={`flex-1 text-[10px] py-1 rounded-sm text-center font-medium transition-colors ${overlayState.windowRatio === '7:10' ? 'bg-white text-brand-700 shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}
                                                >7:10</button>
                                                <button
                                                    onClick={() => onOverlayChange({ ...overlayState, windowRatio: '10:7' })}
                                                    className={`flex-1 text-[10px] py-1 rounded-sm text-center font-medium transition-colors ${overlayState.windowRatio === '10:7' ? 'bg-white text-brand-700 shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}
                                                >10:7</button>
                                            </div>
                                        </div>
                                        <div className="relative mt-2">
                                            <select
                                                value={motifResult ?? ''}
                                                onChange={e => handleMotifResultChange((e.target.value || null) as LogoTestResult)}
                                                className="w-full appearance-none p-2 pr-7 border border-surface-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                                            >
                                                <option value="">-- Motif placement result --</option>
                                                <option value="ok">✅  Ok — placement is correct</option>
                                                <option value="not_ok">❌  Not Ok — needs adjustment</option>
                                            </select>
                                            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
                                        </div>
                                        {motifResult === 'not_ok' && (
                                            <div className="space-y-1.5">
                                                <p className="text-[10px] text-red-500 font-medium">Issue flagged — edit comment if needed:</p>
                                                <textarea
                                                    value={motifComment}
                                                    onChange={e => { setMotifComment(e.target.value); setMotifSaved(false); onOverlayChange({ ...overlayState, testResult: 'not_ok', testComment: e.target.value }); }}
                                                    className="w-full p-2 border border-red-300 rounded-lg text-[11px] resize-none focus:ring-2 focus:ring-red-400 outline-none leading-relaxed bg-red-50/40"
                                                    rows={4}
                                                />
                                                <button onClick={handleSaveMotif} className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors">
                                                    <Save size={11} /> Save Motif Test Result
                                                </button>
                                            </div>
                                        )}
                                        {motifResult === 'ok' && (
                                            <div className="space-y-1.5">
                                                <p className="text-[11px] text-green-600 font-medium">✅ Motif placement looks good.</p>
                                                <button onClick={handleSaveMotif} className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors">
                                                    <Save size={11} /> Save Motif Test Result
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
