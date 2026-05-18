import React, { useState, useRef, useCallback } from 'react';
import { Platform, StyleOption, LogoTestResult } from '../../types';
import { ChevronDown } from 'lucide-react';

const LOGO_WIDTH = 120;

const PLATFORM_OPTIONS: { label: string; value: Platform }[] = [
    { label: 'LinkedIn', value: 'linkedin' },
    { label: 'Twitter', value: 'twitter' },
    { label: 'Ecomms', value: 'ecomms' },
];

const STYLE_OPTIONS: { label: string; value: StyleOption; desc: string }[] = [
    { label: 'Style 1.1', value: 'style1.1', desc: 'Human' },
    { label: 'Style 1.2', value: 'style1.2', desc: 'Object' },
    { label: 'Style 2',   value: 'style2',   desc: 'Only Text' },
    { label: 'Style 3.1', value: 'style3.1', desc: 'Action Oriented' },
    { label: 'Style 3.2', value: 'style3.2', desc: 'Architecture / Abstract' },
];

const NOT_OK_COMMENT =
    'Logo placement does not meet brand guidelines. Top-left logo clearance is insufficient. ' +
    'Please ensure the logo is placed within the safe zone with adequate clear space on all sides.';

export interface LogoOverlayState {
    active: boolean;
    pos: { x: number; y: number };
    scale: number;
    opacity: number;
    testResult: 'ok' | 'not_ok' | null;
    testComment: string;
}

interface Props {
    overlayState: LogoOverlayState;
    onOverlayChange: (s: LogoOverlayState) => void;
}

export default function BrandChecklist({ overlayState, onOverlayChange }: Props) {
    const [platform, setPlatform] = useState<Platform | ''>('');
    const [style, setStyle] = useState<StyleOption | null>(null);
    const [logoTestResult, setLogoTestResult] = useState<LogoTestResult>(null);
    const [logoComment, setLogoComment] = useState('');

    const resetTest = () => {
        setLogoTestResult(null);
        setLogoComment('');
        onOverlayChange({ ...overlayState, active: false, testResult: null, testComment: '' });
    };

    const handlePlatformChange = (val: Platform | '') => {
        setPlatform(val);
        setStyle(null);
        resetTest();
    };

    const handleStyleChange = (val: StyleOption) => {
        setStyle(val);
        resetTest();
    };

    const handleStartTest = () => {
        setLogoTestResult(null);
        setLogoComment('');
        onOverlayChange({ active: true, pos: { x: 0, y: 0 }, scale: 1, opacity: 1, testResult: null, testComment: '' });
    };

    const handleLogoResultChange = (val: LogoTestResult) => {
        setLogoTestResult(val);
        const comment = val === 'not_ok' ? NOT_OK_COMMENT : '';
        setLogoComment(comment);
        onOverlayChange({ ...overlayState, testResult: val, testComment: comment });
    };

    return (
        <div className="border-t border-surface-100 flex-shrink-0">
            <div className="px-4 py-3 bg-surface-50 border-b border-surface-100">
                <h3 className="text-xs font-semibold text-surface-600 uppercase tracking-wide">Brand Checklist</h3>
            </div>

            <div className="p-4 space-y-4">
                {/* Platform Dropdown */}
                <div>
                    <label className="block text-xs font-medium text-surface-600 mb-1.5">Platform</label>
                    <div className="relative">
                        <select
                            value={platform}
                            onChange={e => handlePlatformChange(e.target.value as Platform | '')}
                            className="w-full appearance-none p-2.5 pr-8 border border-surface-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                        >
                            <option value="">-- Select Platform --</option>
                            {PLATFORM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
                    </div>
                </div>

                {/* Style Toggles */}
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

                {/* Test Panel */}
                {platform && style && (
                    <div className="border border-surface-200 rounded-xl overflow-hidden">
                        <div className="px-3 py-2 bg-surface-50 border-b border-surface-100">
                            <p className="text-[11px] font-semibold text-surface-500 uppercase tracking-wide">Tests</p>
                        </div>
                        <div className="p-3 space-y-3">
                            {/* Logo Top Left */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-semibold text-surface-700">Logo — Top Left</p>
                                        <p className="text-[10px] text-surface-400">Test logo clearance &amp; placement</p>
                                    </div>
                                    <button
                                        onClick={handleStartTest}
                                        className="px-3 py-1.5 text-[11px] font-semibold bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors flex-shrink-0"
                                    >
                                        Test
                                    </button>
                                </div>

                                {overlayState.active && (
                                    <>
                                        {/* Scale slider */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-surface-500 w-10">Scale</span>
                                            <input
                                                type="range" min={0.5} max={2.5} step={0.05}
                                                value={overlayState.scale}
                                                onChange={e => onOverlayChange({ ...overlayState, scale: parseFloat(e.target.value) })}
                                                className="flex-1 h-1.5 accent-brand-600"
                                            />
                                            <span className="text-[10px] text-surface-500 w-8 text-right">{overlayState.scale.toFixed(1)}x</span>
                                        </div>

                                        {/* Opacity slider */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-surface-500 w-10">Opacity</span>
                                            <input
                                                type="range" min={0.1} max={1} step={0.05}
                                                value={overlayState.opacity ?? 1}
                                                onChange={e => onOverlayChange({ ...overlayState, opacity: parseFloat(e.target.value) })}
                                                className="flex-1 h-1.5 accent-brand-600"
                                            />
                                            <span className="text-[10px] text-surface-500 w-8 text-right">{Math.round((overlayState.opacity ?? 1) * 100)}%</span>
                                        </div>

                                        {/* Result dropdown */}
                                        <div className="relative">
                                            <select
                                                value={logoTestResult ?? ''}
                                                onChange={e => handleLogoResultChange((e.target.value || null) as LogoTestResult)}
                                                className="w-full appearance-none p-2 pr-7 border border-surface-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                                            >
                                                <option value="">-- Logo placement result --</option>
                                                <option value="ok">✅  Ok — placement is correct</option>
                                                <option value="not_ok">❌  Not Ok — needs adjustment</option>
                                            </select>
                                            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
                                        </div>

                                        {logoTestResult === 'not_ok' && (
                                            <div className="space-y-1">
                                                <p className="text-[10px] text-red-500 font-medium">Issue flagged — edit comment if needed:</p>
                                                <textarea
                                                    value={logoComment}
                                                    onChange={e => {
                                                        setLogoComment(e.target.value);
                                                        onOverlayChange({ ...overlayState, testResult: 'not_ok', testComment: e.target.value });
                                                    }}
                                                    className="w-full p-2 border border-red-300 rounded-lg text-[11px] resize-none focus:ring-2 focus:ring-red-400 outline-none leading-relaxed bg-red-50/40"
                                                    rows={4}
                                                />
                                            </div>
                                        )}
                                        {logoTestResult === 'ok' && (
                                            <p className="text-[11px] text-green-600 font-medium">✅ Logo placement looks good.</p>
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
