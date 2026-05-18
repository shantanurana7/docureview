// === Review Types ===
export type ReviewStatus = 'in_progress' | 'reviewed';

export interface Review {
    id: string;
    title: string;
    job_id: string;
    designer_name: string;
    designer_email: string;
    status: ReviewStatus;
    created_at: string;
    annotations: Annotation[];
    score: null;
    // File data stored as base64 in JSON for persistence
    fileBase64?: string;
    // Runtime-only: the file blob (not saved to JSON)
    fileBlob?: Blob;
    fileBlobUrl?: string;
    fileType?: 'image';
    original_filename?: string;
}

// === Annotation Types ===
export enum ShapeType {
    RECTANGLE = 'RECTANGLE',
}

export interface Annotation {
    id: string;
    type: ShapeType;
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
    comment: string;
    timestamp?: number;
}

// === Brand Checklist Types ===
export type Platform = 'linkedin' | 'twitter' | 'ecomms';

export type StyleOption =
    | 'style1.1'
    | 'style1.2'
    | 'style2'
    | 'style3.1'
    | 'style3.2';

export type LogoTestResult = 'ok' | 'not_ok' | null;

// === JSON Data File ===
export interface DocuReviewData {
    reviews: Review[];
}
