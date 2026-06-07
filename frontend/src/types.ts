// === Review Types ===
export type ReviewStatus = 'in_progress' | 'reviewed';

export interface CommittedTestResult {
    result: 'ok' | 'not_ok';
    comment: string;
}

export type SavedSimpleTests = Partial<Record<SimpleTestKey, CommittedTestResult>>;

export interface Review {
    id: string;
    title: string;
    job_id: string;
    designer_name: string;
    designer_email: string;
    status: ReviewStatus;
    created_at: string;
    annotations: Annotation[];
    testScore?: string | null;
    style?: string | null;
    platform?: string | null;
    
    // Saved Test Results
    savedLogoResult?: CommittedTestResult | null;
    savedMotifResult?: CommittedTestResult | null;
    savedSizeResult?: CommittedTestResult | null;
    savedTypographyResult?: CommittedTestResult | null;
    savedTextClearResult?: CommittedTestResult | null;
    savedSimpleTests?: SavedSimpleTests | null;

    // File data stored as base64 in JSON for persistence
    fileBase64?: string;
    // Runtime-only: the file blob (not saved to JSON)
    fileBlob?: Blob;
    fileBlobUrl?: string;
    fileType?: 'image' | 'pdf';
    totalPages?: number;
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
    | 'style3.2'
    | 'style4'
    | 'style5';

export type LogoTestResult = 'ok' | 'not_ok' | null;

/** Keys for all simple yes/no brand tests */
export type SimpleTestKey =
    | 'gradient'
    | 'portraits'
    | 'diversity'
    | 'body_copy_arial'
    | 'copyright'
    | 'colors'
    | 'window_bg_colors'
    | 'type_in_window'
    | 'bg_3_colors'
    | 'image_breakout'
    | 'neutral_image';

// === JSON Data File ===
export interface DocuReviewData {
    reviews: Review[];
}
