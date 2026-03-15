// === Review Types ===
export type ReviewStatus = 'in_progress' | 'reviewed';
export type DeliverableType = 'assets' | 'ecomms' | 'marketing';

export interface Review {
    id: string;
    title: string;
    job_id: string;
    designer_name: string;
    designer_email: string;
    deliverable_type: DeliverableType;
    complexity: string;
    status: ReviewStatus;
    created_at: string;
    annotations: Annotation[];
    score: ReviewScore | null;
    // File data stored as base64 in JSON for persistence
    fileBase64?: string;
    // Runtime-only: the file blob (not saved to JSON)
    fileBlob?: Blob;
    fileBlobUrl?: string;
    fileType?: 'pdf' | 'image';
    original_filename?: string;
}

// === Annotation Types ===
export enum ShapeType {
    RECTANGLE = 'RECTANGLE',
    CIRCLE = 'CIRCLE',
}

export enum Severity {
    MINOR = 'MINOR',
    MODERATE = 'MODERATE',
    MAJOR = 'MAJOR',
    CRITICAL = 'CRITICAL',
}

export enum ErrorCategory {
    DESIGN = 'Design',
    LAYOUT = 'Layout',
    EDITORIAL = 'Editorial',
    BRAND = 'Brand',
}

export interface Annotation {
    id: string;
    type: ShapeType;
    pageNumber: number;
    severity: Severity;
    error_category: ErrorCategory;
    x: number;
    y: number;
    width: number;
    height: number;
    comment: string;
    timestamp?: number;
}

// === Score Types ===
export interface ReviewScore {
    quality: number;
    complexity: number;
    ftp: number;
    design: number;
    repeat_offence: number;
    composite_score: number;
}

// === JSON Data File ===
export interface DocuReviewData {
    reviews: Review[];
}
