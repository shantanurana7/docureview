import { Review, DocuReviewData, ReviewScore, Annotation } from '../types';

const EMPTY_DATA: DocuReviewData = { reviews: [] };

let store: DocuReviewData = { ...EMPTY_DATA };
let listeners: Array<() => void> = [];

function notify() {
    listeners.forEach(fn => fn());
}

// === Subscribe / Unsubscribe ===
export function subscribe(fn: () => void) {
    listeners.push(fn);
    return () => { listeners = listeners.filter(l => l !== fn); };
}

export function getSnapshot(): DocuReviewData {
    return store;
}

// === Check if store has existing reviews ===
export function hasExistingData(): boolean {
    return store.reviews.length > 0;
}

// === Parse a JSON file and return the data (without applying it) ===
export async function parseJsonFile(file: File): Promise<DocuReviewData> {
    const text = await file.text();
    const parsed: DocuReviewData = JSON.parse(text);
    if (!parsed.reviews || !Array.isArray(parsed.reviews)) {
        throw new Error('Invalid JSON: missing "reviews" array');
    }
    return parsed;
}

// === Apply parsed data: replace current store ===
export function applyLoadedData(data: DocuReviewData): void {
    // Restore blob URLs from base64 data
    store = {
        reviews: data.reviews.map(r => restoreBlobFromBase64(r)),
    };
    saveToLocalStorage();
    notify();
}

// === Merge loaded data with current store (deduplicate by id) ===
export function mergeLoadedData(data: DocuReviewData): void {
    const existingIds = new Set(store.reviews.map(r => r.id));
    const newReviews = data.reviews
        .filter(r => !existingIds.has(r.id))
        .map(r => restoreBlobFromBase64(r));
    store = {
        reviews: [...store.reviews, ...newReviews],
    };
    saveToLocalStorage();
    notify();
}

// === Convert base64 back to blob URL for runtime use ===
function restoreBlobFromBase64(review: Review): Review {
    if (review.fileBase64 && !review.fileBlobUrl) {
        try {
            const mimeType = review.fileType === 'pdf' ? 'application/pdf' : 'image/png';
            const binaryStr = atob(review.fileBase64);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
            const blob = new Blob([bytes], { type: mimeType });
            return { ...review, fileBlob: blob, fileBlobUrl: URL.createObjectURL(blob) };
        } catch { /* ignore decode errors */ }
    }
    return review;
}

// === Convert file to base64 string ===
export async function fileToBase64(file: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Strip the data URL prefix (e.g. "data:application/pdf;base64,")
            const base64 = result.split(',')[1] || result;
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// === Download current data as JSON ===
export function downloadJson() {
    // Strip runtime-only blob fields before saving (keep fileBase64)
    const cleaned: DocuReviewData = {
        reviews: store.reviews.map(r => {
            const { fileBlob, fileBlobUrl, ...rest } = r;
            return rest;
        }),
    };
    const json = JSON.stringify(cleaned, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    // Include date and time in filename
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    link.download = `docureview_data_${dateStr}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
}

// === Save to browser (auto-save to localStorage for session persistence) ===
export function saveToLocalStorage() {
    const cleaned: DocuReviewData = {
        reviews: store.reviews.map(r => {
            const { fileBlob, fileBlobUrl, ...rest } = r;
            return rest;
        }),
    };
    try {
        localStorage.setItem('docureview_data', JSON.stringify(cleaned));
    } catch (e) {
        // localStorage may exceed quota with large base64 data
        console.warn('Could not save to localStorage (data may be too large):', e);
    }
}

// === Load from localStorage on startup ===
export function loadFromLocalStorage() {
    const saved = localStorage.getItem('docureview_data');
    if (saved) {
        try {
            const parsed: DocuReviewData = JSON.parse(saved);
            if (parsed.reviews && Array.isArray(parsed.reviews)) {
                store = {
                    reviews: parsed.reviews.map(r => restoreBlobFromBase64(r)),
                };
                notify();
            }
        } catch { /* ignore invalid data */ }
    }
}

// === CRUD ===
export function getReviews(): Review[] {
    return store.reviews;
}

export function getReviewById(id: string): Review | undefined {
    return store.reviews.find(r => r.id === id);
}

export function addReview(review: Review): void {
    store = { ...store, reviews: [...store.reviews, review] };
    saveToLocalStorage();
    notify();
}

export function updateReview(id: string, updates: Partial<Review>): void {
    store = {
        ...store,
        reviews: store.reviews.map(r => r.id === id ? { ...r, ...updates } : r),
    };
    saveToLocalStorage();
    notify();
}

export function updateAnnotations(id: string, annotations: Annotation[]): void {
    updateReview(id, { annotations });
}

export function submitScore(id: string, score: ReviewScore): void {
    updateReview(id, { score, status: 'reviewed' });
}

export function deleteReview(id: string): void {
    store = {
        ...store,
        reviews: store.reviews.filter(r => r.id !== id),
    };
    saveToLocalStorage();
    notify();
}
