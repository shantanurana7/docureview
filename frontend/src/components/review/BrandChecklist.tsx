import React, { useEffect, useState } from 'react';
import { Platform, StyleOption, LogoTestResult, SimpleTestKey, CommittedTestResult, SavedSimpleTests } from '../../types';
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

// ── Style Options with updated descriptions and sample image paths ─────────────
const STYLE_OPTIONS: { label: string; value: StyleOption; desc: string; sample: string }[] = [
    { label: 'Style 1.1', value: 'style1.1', desc: 'Human',                                         sample: './assets/sample-1.jpg' },
    { label: 'Style 1.2', value: 'style1.2', desc: 'Object',                                        sample: './assets/sample-2.jpg' },
    { label: 'Style 2',   value: 'style2',   desc: 'Only text - no image',                          sample: './assets/sample-3.jpg' },
    { label: 'Style 3.1', value: 'style3.1', desc: 'Action oriented support imagery',               sample: './assets/sample-4.jpg' },
    { label: 'Style 3.2', value: 'style3.2', desc: 'Architectural/Abstract hero image',             sample: './assets/sample-5.jpg' },
    { label: 'Style 4',   value: 'style4',   desc: 'Only action oriented imagery with gradient',    sample: './assets/sample-6.jpg' },
    { label: 'Style 5',   value: 'style5',   desc: 'Abstract without gradient',                     sample: './assets/sample-1.jpg' },
];

// ── Test visibility matrix (Y = true, N = false) ──────────────────────────────
const TEST_MATRIX: Record<StyleOption, Record<string, boolean>> = {
    'style1.1': {
        logo_space:       true,  typography:      true,  window_motif:  true,  text_clear_space:  true,
        gradient:         true,  portraits:        true,  diversity:     true,  body_copy_arial:   true,
        copyright:        true,  colors:           true,  window_bg_colors: false, type_in_window: false,
        bg_3_colors:      false, image_breakout:   false, neutral_image: false,
    },
    'style1.2': {
        logo_space:       true,  typography:      true,  window_motif:  true,  text_clear_space:  true,
        gradient:         true,  portraits:        false, diversity:     false, body_copy_arial:   true,
        copyright:        true,  colors:           true,  window_bg_colors: false, type_in_window: false,
        bg_3_colors:      false, image_breakout:   false, neutral_image: false,
    },
    'style2': {
        logo_space:       true,  typography:      true,  window_motif:  true,  text_clear_space:  true,
        gradient:         true,  portraits:        false, diversity:     false, body_copy_arial:   true,
        copyright:        true,  colors:           true,  window_bg_colors: true,  type_in_window: true,
        bg_3_colors:      false, image_breakout:   false, neutral_image: false,
    },
    'style3.1': {
        logo_space:       true,  typography:      true,  window_motif:  true,  text_clear_space:  true,
        gradient:         true,  portraits:        false, diversity:     true,  body_copy_arial:   true,
        copyright:        true,  colors:           true,  window_bg_colors: false, type_in_window: false,
        bg_3_colors:      true,  image_breakout:   true,  neutral_image: false,
    },
    'style3.2': {
        logo_space:       true,  typography:      true,  window_motif:  true,  text_clear_space:  true,
        gradient:         true,  portraits:        false, diversity:     false, body_copy_arial:   true,
        copyright:        true,  colors:           true,  window_bg_colors: false, type_in_window: false,
        bg_3_colors:      true,  image_breakout:   true,  neutral_image: false,
    },
    'style4': {
        logo_space:       true,  typography:      true,  window_motif:  true,  text_clear_space:  true,
        gradient:         true,  portraits:        false, diversity:     true,  body_copy_arial:   true,
        copyright:        true,  colors:           true,  window_bg_colors: false, type_in_window: false,
        bg_3_colors:      false, image_breakout:   false, neutral_image: true,
    },
    'style5': {
        logo_space:       true,  typography:      true,  window_motif:  false, text_clear_space:  true,
        gradient:         false, portraits:        false, diversity:     false, body_copy_arial:   true,
        copyright:        true,  colors:           true,  window_bg_colors: false, type_in_window: false,
        bg_3_colors:      false, image_breakout:   false, neutral_image: false,
    },
};

// ── Simple test labels ─────────────────────────────────────────────────────────
const SIMPLE_TEST_LABELS: Record<SimpleTestKey, string> = {
    gradient:          'Gradient',
    portraits:         'Portraits',
    diversity:         'Diversity',
    body_copy_arial:   'Body copy text Arial',
    copyright:         'Copyright',
    colors:            'Colors',
    window_bg_colors:  'Available window and background colors',
    type_in_window:    'Type and messages placed within the window',
    bg_3_colors:       'Background – 3 colors to appear',
    image_breakout:    'Image breaking out of the window (12 ways to break out)',
    neutral_image:     'The window always has a neutral-toned image with pops of color',
};

const SIMPLE_TEST_KEYS: SimpleTestKey[] = [
    'gradient', 'portraits', 'diversity', 'body_copy_arial', 'copyright', 'colors',
    'window_bg_colors', 'type_in_window', 'bg_3_colors', 'image_breakout', 'neutral_image',
];

// ── Default error comments ────────────────────────────────────────────────────
const NOT_OK_COMMENT =
    'Logo placement does not meet brand guidelines. Top-left logo clearance is insufficient. ' +
    'Please ensure the logo is placed within the safe zone with adequate clear space on all sides.';

const NOT_OK_MOTIF_COMMENT =
    'Window motif placement or ratio does not meet brand guidelines. ' +
    'Please ensure it covers the required safe zone and follows the correct aspect ratio.';

const NOT_OK_TYPOGRAPHY_COMMENT =
    'Typography does not meet brand guidelines. Title must use Condensed Bold font; subtitle must use Arial Regular.';

const NOT_OK_TEXT_CLEAR_COMMENT =
    'Text clear space is insufficient. Maintain one logo-space margin from all four edges (top, bottom, left, right).';

/** One-liner default "Not OK" comments for each simple yes/no test. */
const NOT_OK_SIMPLE_COMMENTS: Record<SimpleTestKey, string> = {
    gradient:         'Gradient usage does not comply with brand guidelines. Please correct the gradient application.',
    portraits:        'Portrait imagery does not meet brand requirements. Follow approved diversity and usage guidelines.',
    diversity:        'Diversity representation does not meet brand standards. Use inclusive imagery reflecting brand values.',
    body_copy_arial:  'Body copy is not set in Arial. All body copy and secondary text must use Arial Regular.',
    copyright:        'Copyright notice is missing or incorrect. Add the correct copyright statement in the required position.',
    colors:           'Color usage does not match the approved brand palette. Use only approved KPMG brand colors.',
    window_bg_colors: 'Window or background color is not from the approved set. Use only permitted color combinations.',
    type_in_window:   'Text or messaging is not correctly placed within the window motif. Follow the placement guidelines.',
    bg_3_colors:      'Background does not display the required three-color treatment. Adjust to meet the color breakdown rules.',
    image_breakout:   'Image does not use an approved window breakout configuration. Choose from the 12 approved breakout options.',
    neutral_image:    'Window image is not neutral-toned with pops of color. Adjust imagery to meet this brand requirement.',
};

// ── Overlay state types ───────────────────────────────────────────────────────
export interface LogoOverlayState {
    activeTest: 'logo' | 'window_motif' | 'typography' | 'text_clear_space' | null;
    pos: { x: number; y: number };
    scale: number;
    opacity: number;
    windowRatio: '7:10' | '10:7';
    testResult: 'ok' | 'not_ok' | null;
    testComment: string;
}

// ── Simple test entry state ───────────────────────────────────────────────────
interface SimpleTestEntry {
    result: 'yes' | 'no' | null;
    comment: string;
    saved: boolean;
}
type SimpleTestsState = Record<SimpleTestKey, SimpleTestEntry>;

const makeInitialSimpleTests = (): SimpleTestsState => ({
    gradient:         { result: null, comment: '', saved: false },
    portraits:        { result: null, comment: '', saved: false },
    diversity:        { result: null, comment: '', saved: false },
    body_copy_arial:  { result: null, comment: '', saved: false },
    copyright:        { result: null, comment: '', saved: false },
    colors:           { result: null, comment: '', saved: false },
    window_bg_colors: { result: null, comment: '', saved: false },
    type_in_window:   { result: null, comment: '', saved: false },
    bg_3_colors:      { result: null, comment: '', saved: false },
    image_breakout:   { result: null, comment: '', saved: false },
    neutral_image:    { result: null, comment: '', saved: false },
});

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
    overlayState: LogoOverlayState;
    onOverlayChange: (s: LogoOverlayState) => void;
    onSaveLogoResult:         (r: CommittedTestResult | null) => void;
    onSaveMotifResult:        (r: CommittedTestResult | null) => void;
    onSaveSizeResult:         (r: CommittedTestResult | null) => void;
    onSaveTypographyResult:   (r: CommittedTestResult | null) => void;
    onSaveTextClearResult:    (r: CommittedTestResult | null) => void;
    onSaveSimpleTests:        (results: SavedSimpleTests) => void;
    /** Natural pixel dimensions of the uploaded image */
    imageDimensions: { w: number; h: number } | null;
    /** Currently active logo source (blue or white) */
    logoSrc: string;
    onLogoSrcChange: (src: string) => void;
    /** Callback when style selection changes (for parent to show sample image in center column) */
    onStyleChange?: (style: StyleOption | null) => void;
    /** Callback when platform selection changes */
    onPlatformChange?: (platform: Platform | '') => void;
    /** Callback when PDF reference page selection changes */
    onPdfRefChange?: (ref: string | null) => void;
    /** When true (PDF upload), hides all brand checklist sections */
    isPdf?: boolean;

    // Initial loaded state from DB
    initialPlatform?: Platform | '' | null;
    initialStyle?: StyleOption | null;
    initialPdfRef?: string | null;
    initialLogoResult?: CommittedTestResult | null;
    initialMotifResult?: CommittedTestResult | null;
    initialSizeResult?: CommittedTestResult | null;
    initialTypographyResult?: CommittedTestResult | null;
    initialTextClearResult?: CommittedTestResult | null;
    initialSimpleTests?: SavedSimpleTests | null;
}

// ── Reusable "Saved to PDF" badge ─────────────────────────────────────────────
function SavedBadge() {
    return (
        <div className="flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
            <CheckCircle size={10} /> Saved to PDF
        </div>
    );
}

// ── Generic result row for overlay tests ─────────────────────────────────────
function OverlayResultSection({
    result, comment,
    saved, onResultChange, onCommentChange, onSave,
    okLabel, notOkLabel, notOkDefault,
}: {
    result: LogoTestResult;
    comment: string;
    saved: boolean;
    onResultChange: (v: LogoTestResult) => void;
    onCommentChange: (c: string) => void;
    onSave: () => void;
    okLabel?: string;
    notOkLabel?: string;
    notOkDefault?: string;
}) {
    return (
        <>
            <div className="relative mt-2">
                <select
                    value={result ?? ''}
                    onChange={e => onResultChange((e.target.value || null) as LogoTestResult)}
                    className="w-full appearance-none p-2 pr-7 border border-surface-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                >
                    <option value="">-- Select result --</option>
                    <option value="ok">✅  {okLabel ?? 'Ok — passes brand guidelines'}</option>
                    <option value="not_ok">❌  {notOkLabel ?? 'Not Ok — needs adjustment'}</option>
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
            </div>

            {result === 'not_ok' && (
                <div className="space-y-1.5 mt-1.5">
                    <p className="text-[10px] text-red-500 font-medium">Issue flagged — edit comment if needed:</p>
                    <textarea
                        value={comment}
                        onChange={e => onCommentChange(e.target.value)}
                        disabled={saved}
                        className="w-full p-2 border border-red-300 rounded-lg text-[11px] resize-none focus:ring-2 focus:ring-red-400 outline-none leading-relaxed bg-red-50/40 disabled:opacity-60"
                        rows={3}
                        placeholder={notOkDefault ?? 'Describe the issue…'}
                    />
                    <button
                        onClick={onSave}
                        disabled={saved}
                        className={`w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${saved ? 'bg-green-600 text-white cursor-default' : 'text-white bg-brand-600 hover:bg-brand-700'}`}
                    >
                        {saved ? <><CheckCircle size={11} /> Saved</> : <><Save size={11} /> Save Result</>}
                    </button>
                </div>
            )}
            {result === 'ok' && (
                <div className="space-y-1.5 mt-1.5">
                    <p className="text-[11px] text-green-600 font-medium">✅ Passes brand guidelines.</p>
                    <button
                        onClick={onSave}
                        disabled={saved}
                        className={`w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${saved ? 'bg-green-600 text-white cursor-default' : 'text-white bg-brand-600 hover:bg-brand-700'}`}
                    >
                        {saved ? <><CheckCircle size={11} /> Saved</> : <><Save size={11} /> Save Result</>}
                    </button>
                </div>
            )}
        </>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function BrandChecklist({
    overlayState, onOverlayChange,
    onSaveLogoResult, onSaveMotifResult, onSaveSizeResult,
    onSaveTypographyResult, onSaveTextClearResult, onSaveSimpleTests,
    imageDimensions,
    logoSrc, onLogoSrcChange,
    onStyleChange,
    onPlatformChange,
    onPdfRefChange,
    isPdf = false,
    initialPlatform, initialStyle, initialPdfRef,
    initialLogoResult, initialMotifResult, initialSizeResult,
    initialTypographyResult, initialTextClearResult, initialSimpleTests,
}: Props) {
    const [platform, setPlatform] = useState<Platform | ''>(initialPlatform || '');
    const [style,    setStyle]    = useState<StyleOption | null>(initialStyle || null);
    const [pdfRef,   setPdfRef]   = useState<string>(initialPdfRef || '');

    // Initialize from saved state on mount (only once)
    useEffect(() => {
        if (initialLogoResult) { setLogoResult(initialLogoResult.result); setLogoComment(initialLogoResult.comment); setLogoSaved(true); }
        if (initialMotifResult) { setMotifResult(initialMotifResult.result); setMotifComment(initialMotifResult.comment); setMotifSaved(true); }
        if (initialSizeResult) { setSizeSaved(true); setSizeComment(initialSizeResult.comment); }
        if (initialTypographyResult) { setTypographyResult(initialTypographyResult.result); setTypographyComment(initialTypographyResult.comment); setTypographySaved(true); }
        if (initialTextClearResult) { setTextClearResult(initialTextClearResult.result); setTextClearComment(initialTextClearResult.comment); setTextClearSaved(true); }
        
        if (initialSimpleTests) {
            setSimpleTests(prev => {
                const copy = { ...prev };
                (Object.keys(initialSimpleTests) as SimpleTestKey[]).forEach(key => {
                    const savedTest = initialSimpleTests[key];
                    if (savedTest && copy[key]) {
                        copy[key] = { result: savedTest.result === 'ok' ? 'yes' : 'no', comment: savedTest.comment, saved: true };
                    }
                });
                return copy;
            });
        }
    }, []);

    // ── Size test ─────────────────────────────────────────────────────────────
    const [sizeComment, setSizeComment] = useState('');
    const [sizeSaved,   setSizeSaved]   = useState(false);
    const sizeCheck = (() => {
        if (!platform || !imageDimensions) return null;
        const req = PLATFORM_DIMS[platform as Platform];
        if (!req) return null;
        const pass = imageDimensions.w === req.w && imageDimensions.h === req.h;
        return { pass, req, actual: imageDimensions };
    })();

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
            onSaveSizeResult(null);
        } else {
            setSizeComment('');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [platform, imageDimensions]);

    const handleSaveSize = () => {
        if (!sizeCheck) return;
        setSizeSaved(true);
        onSaveSizeResult({ result: sizeCheck.pass ? 'ok' : 'not_ok', comment: sizeCheck.pass ? '' : sizeComment });
    };

    // ── Logo test ─────────────────────────────────────────────────────────────
    const [logoResult,  setLogoResult]  = useState<LogoTestResult>(null);
    const [logoComment, setLogoComment] = useState('');
    const [logoSaved,   setLogoSaved]   = useState(false);

    // ── Motif test ────────────────────────────────────────────────────────────
    const [motifResult,  setMotifResult]  = useState<LogoTestResult>(null);
    const [motifComment, setMotifComment] = useState('');
    const [motifSaved,   setMotifSaved]   = useState(false);

    // ── Typography test ───────────────────────────────────────────────────────
    const [typographyResult,  setTypographyResult]  = useState<LogoTestResult>(null);
    const [typographyComment, setTypographyComment] = useState('');
    const [typographySaved,   setTypographySaved]   = useState(false);

    // ── Text Clear Space test ─────────────────────────────────────────────────
    const [textClearResult,  setTextClearResult]  = useState<LogoTestResult>(null);
    const [textClearComment, setTextClearComment] = useState('');
    const [textClearSaved,   setTextClearSaved]   = useState(false);

    // ── Simple Yes/No tests ───────────────────────────────────────────────────
    const [simpleTests, setSimpleTests] = useState<SimpleTestsState>(makeInitialSimpleTests());

    const updateSimpleTest = (key: SimpleTestKey, update: Partial<SimpleTestEntry>) => {
        setSimpleTests(prev => ({ ...prev, [key]: { ...prev[key], ...update } }));
    };

    const notifySimpleTests = (updated: SimpleTestsState) => {
        const committed: SavedSimpleTests = {};
        for (const k of SIMPLE_TEST_KEYS) {
            if (updated[k].saved && updated[k].result !== null) {
                committed[k] = {
                    result: updated[k].result === 'yes' ? 'ok' : 'not_ok',
                    comment: updated[k].comment,
                };
            }
        }
        onSaveSimpleTests(committed);
    };

    const saveSimpleTest = (key: SimpleTestKey) => {
        const entry = simpleTests[key];
        if (!entry.result) return;
        const updated = { ...simpleTests, [key]: { ...entry, saved: true } };
        setSimpleTests(updated);
        notifySimpleTests(updated);
    };

    // ── Helper: is a given test applicable for the current style? ─────────────
    const testVisible = (testKey: string): boolean => {
        if (!style) return false;
        return TEST_MATRIX[style]?.[testKey] === true;
    };

    // ── Reset all brand tests ─────────────────────────────────────────────────
    const resetBrandTests = () => {
        setLogoResult(null);  setLogoComment('');  setLogoSaved(false);  onSaveLogoResult(null);
        setMotifResult(null); setMotifComment(''); setMotifSaved(false); onSaveMotifResult(null);
        setTypographyResult(null); setTypographyComment(''); setTypographySaved(false); onSaveTypographyResult(null);
        setTextClearResult(null);  setTextClearComment('');  setTextClearSaved(false);  onSaveTextClearResult(null);
        setSizeSaved(false); onSaveSizeResult(null);
        setSimpleTests(makeInitialSimpleTests());
        onSaveSimpleTests({});
        onOverlayChange({ ...overlayState, activeTest: null, testResult: null, testComment: '' });
    };

    const handlePlatformChange = (val: Platform | '') => {
        setPlatform(val);
        if (onPlatformChange) onPlatformChange(val);
        setStyle(null);
        onStyleChange?.(null);
        resetBrandTests();
    };

    const handleStyleChange = (val: StyleOption) => {
        setStyle(val);
        onStyleChange?.(val);
        // Reset only overlay/simple tests; size test stays
        setLogoResult(null);  setLogoComment('');  setLogoSaved(false);  onSaveLogoResult(null);
        setMotifResult(null); setMotifComment(''); setMotifSaved(false); onSaveMotifResult(null);
        setTypographyResult(null); setTypographyComment(''); setTypographySaved(false); onSaveTypographyResult(null);
        setTextClearResult(null);  setTextClearComment('');  setTextClearSaved(false);  onSaveTextClearResult(null);
        setSimpleTests(makeInitialSimpleTests());
        onSaveSimpleTests({});
        onOverlayChange({ ...overlayState, activeTest: null, testResult: null, testComment: '' });
    };

    // ── Start an overlay test ─────────────────────────────────────────────────
    const handleStartTest = (testType: 'logo' | 'window_motif' | 'typography' | 'text_clear_space') => {
        if (testType === 'logo')             { setLogoResult(null);       setLogoComment('');       setLogoSaved(false); }
        if (testType === 'window_motif')     { setMotifResult(null);      setMotifComment('');      setMotifSaved(false); }
        if (testType === 'typography')       { setTypographyResult(null); setTypographyComment(''); setTypographySaved(false); }
        if (testType === 'text_clear_space') { setTextClearResult(null);  setTextClearComment('');  setTextClearSaved(false); }
        onOverlayChange({ activeTest: testType, pos: { x: 0, y: 0 }, scale: 1, opacity: 1, windowRatio: '7:10', testResult: null, testComment: '' });
    };

    // ── Logo result ───────────────────────────────────────────────────────────
    const handleLogoResultChange = (val: LogoTestResult) => {
        setLogoResult(val); setLogoSaved(false);
        const c = val === 'not_ok' ? NOT_OK_COMMENT : '';
        setLogoComment(c);
        onOverlayChange({ ...overlayState, testResult: val, testComment: c });
    };
    const handleSaveLogo = () => {
        if (!logoResult) return;
        setLogoSaved(true);
        onSaveLogoResult({ result: logoResult, comment: logoComment });
        onOverlayChange({ ...overlayState, activeTest: null });
    };

    // ── Motif result ──────────────────────────────────────────────────────────
    const handleMotifResultChange = (val: LogoTestResult) => {
        setMotifResult(val); setMotifSaved(false);
        const c = val === 'not_ok' ? NOT_OK_MOTIF_COMMENT : '';
        setMotifComment(c);
        onOverlayChange({ ...overlayState, testResult: val, testComment: c });
    };
    const handleSaveMotif = () => {
        if (!motifResult) return;
        setMotifSaved(true);
        onSaveMotifResult({ result: motifResult, comment: motifComment });
        onOverlayChange({ ...overlayState, activeTest: null });
    };

    // ── Typography result ─────────────────────────────────────────────────────
    const handleTypographyResultChange = (val: LogoTestResult) => {
        setTypographyResult(val); setTypographySaved(false);
        const c = val === 'not_ok' ? NOT_OK_TYPOGRAPHY_COMMENT : '';
        setTypographyComment(c);
        onOverlayChange({ ...overlayState, testResult: val, testComment: c });
    };
    const handleSaveTypography = () => {
        if (!typographyResult) return;
        setTypographySaved(true);
        onSaveTypographyResult({ result: typographyResult, comment: typographyComment });
        onOverlayChange({ ...overlayState, activeTest: null });
    };

    // ── Text Clear Space result ───────────────────────────────────────────────
    const handleTextClearResultChange = (val: LogoTestResult) => {
        setTextClearResult(val); setTextClearSaved(false);
        const c = val === 'not_ok' ? NOT_OK_TEXT_CLEAR_COMMENT : '';
        setTextClearComment(c);
        onOverlayChange({ ...overlayState, testResult: val, testComment: c });
    };
    const handleSaveTextClear = () => {
        if (!textClearResult) return;
        setTextClearSaved(true);
        onSaveTextClearResult({ result: textClearResult, comment: textClearComment });
        onOverlayChange({ ...overlayState, activeTest: null });
    };

    // ── Overlay test button label helper ──────────────────────────────────────
    const testBtnLabel = (isSaved: boolean, isActive: boolean) =>
        isSaved ? 'Re-test' : isActive ? 'Testing…' : 'Test';

    // ── Simple test component (inline) ────────────────────────────────────────
    const renderSimpleTest = (key: SimpleTestKey) => {
        const entry = simpleTests[key];
        return (
            <div key={key} className="space-y-1.5 pt-2 border-t border-surface-100">
                <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-surface-700 leading-tight flex-1">{SIMPLE_TEST_LABELS[key]}</p>
                    {entry.saved && <SavedBadge />}
                </div>
                <div className="relative">
                    <select
                        value={entry.result ?? ''}
                        onChange={e => {
                            const v = e.target.value as 'yes' | 'no' | '';
                            // Auto-fill the default "Not OK" comment when 'no' is selected
                            const defaultComment = v === 'no' ? NOT_OK_SIMPLE_COMMENTS[key] : '';
                            updateSimpleTest(key, { result: v || null, saved: false, comment: defaultComment });
                        }}
                        className="w-full appearance-none p-2 pr-7 border border-surface-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                    >
                        <option value="">-- Select --</option>
                        <option value="yes">✅  Yes — compliant</option>
                        <option value="no">❌  No — not compliant</option>
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
                </div>
                {entry.result === 'no' && (
                    <textarea
                        value={entry.comment}
                        onChange={e => updateSimpleTest(key, { comment: e.target.value, saved: false })}
                        disabled={entry.saved}
                        placeholder="Add a comment about the issue…"
                        className="w-full p-2 border border-red-300 rounded-lg text-[11px] resize-none focus:ring-2 focus:ring-red-400 outline-none leading-relaxed bg-red-50/40 disabled:opacity-60"
                        rows={2}
                    />
                )}
                {entry.result && (
                    <button
                        onClick={() => saveSimpleTest(key)}
                        disabled={entry.saved}
                        className={`w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${entry.saved ? 'bg-green-600 text-white cursor-default' : 'text-white bg-brand-600 hover:bg-brand-700'}`}
                    >
                        {entry.saved ? <><CheckCircle size={11} /> Saved</> : <><Save size={11} /> Save</>}
                    </button>
                )}
            </div>
        );
    };

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="border-t border-surface-100 flex-shrink-0">
            <div className="px-4 py-3 bg-surface-50 border-b border-surface-100">
                <h3 className="text-xs font-semibold text-surface-600 uppercase tracking-wide">Brand Checklist</h3>
            </div>

            {isPdf ? (
                <div className="p-4 space-y-4">
                    {/* ── PDF Reference Page Dropdown ─────────────────────── */}
                    <div>
                        <label className="block text-xs font-medium text-surface-600 mb-1.5">Reference Page</label>
                        <div className="relative">
                            <select
                                value={pdfRef}
                                onChange={e => {
                                    const val = e.target.value;
                                    setPdfRef(val);
                                    onPdfRefChange?.(val || null);
                                }}
                                className="w-full appearance-none p-2.5 pr-8 border border-surface-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                            >
                                <option value="">-- Select Reference Page --</option>
                                <option value="Insights led page">Insights led page</option>
                                <option value="Hub page">Hub page</option>
                                <option value="Contact page">Contact page</option>
                                <option value="Infographics">Infographics</option>
                                <option value="Video banners">Video banners</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
                        </div>
                    </div>
                    {/* Annotation info note */}
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <span className="text-amber-500 text-sm flex-shrink-0 mt-0.5">ℹ️</span>
                        <p className="text-xs text-amber-800 leading-relaxed">
                            Brand checklist tests are not available for PDF uploads.
                            Use the annotation tool above to add comments per page.
                        </p>
                    </div>
                </div>
            ) : (
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

                {/* ── Size Test ──────────────────────────────────────────── */}
                {platform && (
                    <div className={`rounded-xl border overflow-hidden ${
                        sizeCheck === null ? 'border-surface-200' : sizeCheck.pass ? 'border-green-200 bg-green-50/40' : 'border-red-200 bg-red-50/30'
                    }`}>
                        <div className={`flex items-center justify-between px-3 py-2 border-b ${
                            sizeCheck === null ? 'bg-surface-50 border-surface-100' : sizeCheck.pass ? 'bg-green-50 border-green-100' : 'bg-red-50/60 border-red-100'
                        }`}>
                            <div className="flex items-center gap-1.5">
                                <Ruler size={12} className={sizeCheck?.pass === false ? 'text-red-500' : 'text-surface-500'} />
                                <p className="text-[11px] font-semibold text-surface-600 uppercase tracking-wide">Image Size</p>
                            </div>
                            {sizeSaved && <SavedBadge />}
                        </div>
                        <div className="p-3 space-y-2">
                            {!imageDimensions && <p className="text-[11px] text-surface-400 italic">Waiting for image to load…</p>}
                            {sizeCheck && (
                                <>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] text-surface-500 font-medium">Required:</span>
                                        <span className="text-[10px] font-bold bg-surface-100 text-surface-700 px-2 py-0.5 rounded-full">
                                            {sizeCheck.req.w} × {sizeCheck.req.h} px
                                        </span>
                                        <span className="text-[10px] text-surface-400">vs</span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{
                                            background: sizeCheck.pass ? '#dcfce7' : '#fee2e2',
                                            color: sizeCheck.pass ? '#166534' : '#991b1b',
                                        }}>
                                            {sizeCheck.actual.w} × {sizeCheck.actual.h} px
                                        </span>
                                    </div>
                                    {sizeCheck.pass && (
                                        <div className="space-y-1.5">
                                            <p className="text-[11px] text-green-700 font-semibold">
                                                ✅ Image dimensions are correct for {PLATFORM_OPTIONS.find(p => p.value === platform)?.label}.
                                            </p>
                                            <button
                                                onClick={handleSaveSize} disabled={sizeSaved}
                                                className={`w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${sizeSaved ? 'bg-green-600 text-white cursor-default' : 'text-white bg-brand-600 hover:bg-brand-700'}`}
                                            >
                                                {sizeSaved ? <><CheckCircle size={11} /> Saved</> : <><Save size={11} /> Save Size Test Result</>}
                                            </button>
                                        </div>
                                    )}
                                    {!sizeCheck.pass && (
                                        <div className="space-y-1.5">
                                            <p className="text-[11px] text-red-600 font-semibold">
                                                ❌ Size mismatch — image does not meet {PLATFORM_OPTIONS.find(p => p.value === platform)?.label} requirements.
                                            </p>
                                            <textarea
                                                value={sizeComment}
                                                onChange={e => { setSizeComment(e.target.value); setSizeSaved(false); }}
                                                disabled={sizeSaved}
                                                className="w-full p-2 border border-red-300 rounded-lg text-[11px] resize-none focus:ring-2 focus:ring-red-400 outline-none leading-relaxed bg-white disabled:opacity-60"
                                                rows={3}
                                            />
                                            <button
                                                onClick={handleSaveSize} disabled={sizeSaved}
                                                className={`w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${sizeSaved ? 'bg-green-600 text-white cursor-default' : 'text-white bg-brand-600 hover:bg-brand-700'}`}
                                            >
                                                {sizeSaved ? <><CheckCircle size={11} /> Saved</> : <><Save size={11} /> Save Size Test Result</>}
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Style Toggles ──────────────────────────────────────── */}
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

                {/* ── Overlay + Simple Tests Panel ──────────────────────── */}
                {platform && style && (
                    <div className="border border-surface-200 rounded-xl overflow-hidden">
                        <div className="px-3 py-2 bg-surface-50 border-b border-surface-100">
                            <p className="text-[11px] font-semibold text-surface-500 uppercase tracking-wide">Brand Tests</p>
                        </div>
                        <div className="p-3 space-y-3">

                            {/* ── 1. Logo Space Test ────────────────────────── */}
                            {testVisible('logo_space') && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-surface-700">Logo Space Test</p>
                                            <p className="text-[10px] text-surface-400">Test logo clearance & placement</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            {logoSaved && <SavedBadge />}
                                            <button
                                                onClick={() => handleStartTest('logo')}
                                                className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${
                                                    !logoSaved && overlayState.activeTest === 'logo'
                                                        ? 'bg-brand-700 text-white shadow-inner'
                                                        : 'bg-brand-600 text-white hover:bg-brand-700'
                                                }`}
                                            >
                                                {testBtnLabel(logoSaved, overlayState.activeTest === 'logo')}
                                            </button>
                                        </div>
                                    </div>
                                    {/* Logo colour toggle */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-surface-500 font-medium">Logo colour:</span>
                                        <div className="flex bg-surface-100 p-0.5 rounded-md">
                                            <button onClick={() => onLogoSrcChange('./assets/KPMG_blue_logo.svg')} className={`px-2 py-0.5 text-[10px] rounded-sm font-medium transition-colors ${logoSrc === './assets/KPMG_blue_logo.svg' ? 'bg-white text-brand-700 shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}>Blue</button>
                                            <button onClick={() => onLogoSrcChange('./assets/KPMG_white_logo.svg')} className={`px-2 py-0.5 text-[10px] rounded-sm font-medium transition-colors ${logoSrc === './assets/KPMG_white_logo.svg' ? 'bg-surface-800 text-white shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}>White</button>
                                        </div>
                                    </div>
                                    {overlayState.activeTest === 'logo' && (
                                        <>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-[10px] text-surface-500 w-10">Scale</span>
                                                <input type="range" min={0.5} max={2.5} step={0.05} value={overlayState.scale}
                                                    onChange={e => onOverlayChange({ ...overlayState, scale: parseFloat(e.target.value) })}
                                                    className="flex-1 h-1.5 accent-brand-600" />
                                                <span className="text-[10px] text-surface-500 w-8 text-right">{overlayState.scale.toFixed(1)}x</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-surface-500 w-10">Opacity</span>
                                                <input type="range" min={0.1} max={1} step={0.05} value={overlayState.opacity ?? 1}
                                                    onChange={e => onOverlayChange({ ...overlayState, opacity: parseFloat(e.target.value) })}
                                                    className="flex-1 h-1.5 accent-brand-600" />
                                                <span className="text-[10px] text-surface-500 w-8 text-right">{Math.round((overlayState.opacity ?? 1) * 100)}%</span>
                                            </div>
                                            <OverlayResultSection
                                                result={logoResult} comment={logoComment} saved={logoSaved}
                                                onResultChange={handleLogoResultChange}
                                                onCommentChange={c => { setLogoComment(c); setLogoSaved(false); onOverlayChange({ ...overlayState, testResult: 'not_ok', testComment: c }); }}
                                                onSave={handleSaveLogo}
                                                notOkDefault={NOT_OK_COMMENT}
                                            />
                                        </>
                                    )}
                                </div>
                            )}

                            {/* ── 2. Typography Test ────────────────────────── */}
                            {testVisible('typography') && (
                                <div className="space-y-2 pt-2 border-t border-surface-100">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-surface-700">Typography Test</p>
                                            <p className="text-[10px] text-surface-400">Overlay title &amp; subtitle text on banner</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            {typographySaved && <SavedBadge />}
                                            <button
                                                onClick={() => handleStartTest('typography')}
                                                className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${
                                                    !typographySaved && overlayState.activeTest === 'typography'
                                                        ? 'bg-brand-700 text-white shadow-inner'
                                                        : 'bg-brand-600 text-white hover:bg-brand-700'
                                                }`}
                                            >
                                                {testBtnLabel(typographySaved, overlayState.activeTest === 'typography')}
                                            </button>
                                        </div>
                                    </div>
                                    {overlayState.activeTest === 'typography' && (
                                        <>
                                            <div className="text-[10px] text-surface-500 bg-surface-50 rounded p-2">
                                                Pink title "Condensed bold" + subtitle "Arial regular" appear on image at brand-specified position.
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-surface-500 w-10">Opacity</span>
                                                <input type="range" min={0.1} max={1} step={0.05} value={overlayState.opacity ?? 1}
                                                    onChange={e => onOverlayChange({ ...overlayState, opacity: parseFloat(e.target.value) })}
                                                    className="flex-1 h-1.5 accent-brand-600" />
                                                <span className="text-[10px] text-surface-500 w-8 text-right">{Math.round((overlayState.opacity ?? 1) * 100)}%</span>
                                            </div>
                                            <OverlayResultSection
                                                result={typographyResult} comment={typographyComment} saved={typographySaved}
                                                onResultChange={handleTypographyResultChange}
                                                onCommentChange={c => { setTypographyComment(c); setTypographySaved(false); }}
                                                onSave={handleSaveTypography}
                                            />
                                        </>
                                    )}
                                </div>
                            )}

                            {/* ── 3. Window Motif Test ──────────────────────── */}
                            {testVisible('window_motif') && (
                                <div className="space-y-2 pt-2 border-t border-surface-100">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-surface-700">Window Motif Test</p>
                                            <p className="text-[10px] text-surface-400">Test window motif coverage</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            {motifSaved && <SavedBadge />}
                                            <button
                                                onClick={() => handleStartTest('window_motif')}
                                                className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${
                                                    !motifSaved && overlayState.activeTest === 'window_motif'
                                                        ? 'bg-brand-700 text-white shadow-inner'
                                                        : 'bg-brand-600 text-white hover:bg-brand-700'
                                                }`}
                                            >
                                                {testBtnLabel(motifSaved, overlayState.activeTest === 'window_motif')}
                                            </button>
                                        </div>
                                    </div>
                                    {overlayState.activeTest === 'window_motif' && (
                                        <>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-[10px] text-surface-500 w-10">Scale</span>
                                                <input type="range" min={0.5} max={5} step={0.1} value={overlayState.scale}
                                                    onChange={e => onOverlayChange({ ...overlayState, scale: parseFloat(e.target.value) })}
                                                    className="flex-1 h-1.5 accent-brand-600" />
                                                <span className="text-[10px] text-surface-500 w-8 text-right">{overlayState.scale.toFixed(1)}x</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-surface-500 w-10">Opacity</span>
                                                <input type="range" min={0.1} max={1} step={0.05} value={overlayState.opacity ?? 1}
                                                    onChange={e => onOverlayChange({ ...overlayState, opacity: parseFloat(e.target.value) })}
                                                    className="flex-1 h-1.5 accent-brand-600" />
                                                <span className="text-[10px] text-surface-500 w-8 text-right">{Math.round((overlayState.opacity ?? 1) * 100)}%</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-surface-500 w-10">Ratio</span>
                                                <div className="flex-1 flex bg-surface-100 p-0.5 rounded-md">
                                                    <button onClick={() => onOverlayChange({ ...overlayState, windowRatio: '7:10' })} className={`flex-1 text-[10px] py-1 rounded-sm text-center font-medium transition-colors ${overlayState.windowRatio === '7:10' ? 'bg-white text-brand-700 shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}>7:10</button>
                                                    <button onClick={() => onOverlayChange({ ...overlayState, windowRatio: '10:7' })} className={`flex-1 text-[10px] py-1 rounded-sm text-center font-medium transition-colors ${overlayState.windowRatio === '10:7' ? 'bg-white text-brand-700 shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}>10:7</button>
                                                </div>
                                            </div>
                                            <OverlayResultSection
                                                result={motifResult} comment={motifComment} saved={motifSaved}
                                                onResultChange={handleMotifResultChange}
                                                onCommentChange={c => { setMotifComment(c); setMotifSaved(false); onOverlayChange({ ...overlayState, testResult: 'not_ok', testComment: c }); }}
                                                onSave={handleSaveMotif}
                                                notOkDefault={NOT_OK_MOTIF_COMMENT}
                                            />
                                        </>
                                    )}
                                </div>
                            )}

                            {/* ── 4. Text Clear Space Test ──────────────────── */}
                            {testVisible('text_clear_space') && (
                                <div className="space-y-2 pt-2 border-t border-surface-100">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-surface-700">Text Clear Space Test</p>
                                            <p className="text-[10px] text-surface-400">Pink dotted safe-zone lines at logo-space margin</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            {textClearSaved && <SavedBadge />}
                                            <button
                                                onClick={() => handleStartTest('text_clear_space')}
                                                className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${
                                                    !textClearSaved && overlayState.activeTest === 'text_clear_space'
                                                        ? 'bg-brand-700 text-white shadow-inner'
                                                        : 'bg-brand-600 text-white hover:bg-brand-700'
                                                }`}
                                            >
                                                {testBtnLabel(textClearSaved, overlayState.activeTest === 'text_clear_space')}
                                            </button>
                                        </div>
                                    </div>
                                    {overlayState.activeTest === 'text_clear_space' && (
                                        <>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-[10px] text-surface-500 w-10">Scale</span>
                                                <input type="range" min={0.5} max={3} step={0.1} value={overlayState.scale}
                                                    onChange={e => onOverlayChange({ ...overlayState, scale: parseFloat(e.target.value) })}
                                                    className="flex-1 h-1.5 accent-brand-600" />
                                                <span className="text-[10px] text-surface-500 w-8 text-right">{overlayState.scale.toFixed(1)}x</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-surface-500 w-10">Opacity</span>
                                                <input type="range" min={0.1} max={1} step={0.05} value={overlayState.opacity ?? 1}
                                                    onChange={e => onOverlayChange({ ...overlayState, opacity: parseFloat(e.target.value) })}
                                                    className="flex-1 h-1.5 accent-brand-600" />
                                                <span className="text-[10px] text-surface-500 w-8 text-right">{Math.round((overlayState.opacity ?? 1) * 100)}%</span>
                                            </div>
                                            <OverlayResultSection
                                                result={textClearResult} comment={textClearComment} saved={textClearSaved}
                                                onResultChange={handleTextClearResultChange}
                                                onCommentChange={c => { setTextClearComment(c); setTextClearSaved(false); }}
                                                onSave={handleSaveTextClear}
                                            />
                                        </>
                                    )}
                                </div>
                            )}

                            {/* ── 5–15. Simple Yes/No Tests ─────────────────── */}
                            {SIMPLE_TEST_KEYS.filter(k => testVisible(k)).map(k => renderSimpleTest(k))}

                        </div>
                    </div>
                )}
            </div>
            )}
        </div>
    );
}
