// === User Types ===
export interface User {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'designer' | 'reviewer';
    stream: string;
    created_at?: string;
}

// === Document Types ===
export type DocumentStatus = 'pending' | 'in_review' | 'reviewed' | 'completed';
export type DeliverableType = 'assets' | 'ecomms' | 'marketing';

export interface Document {
    id: string;
    designer_id: string;
    reviewer_id: string | null;
    title: string;
    filepath: string;
    original_filename: string;
    job_id: string;
    deliverable_type: DeliverableType;
    complexity: string;
    due_date: string;
    delivery_date: string;
    status: DocumentStatus;
    created_at: string;
    designer_name?: string;
    reviewer_name?: string;
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
    page_number?: number;
    severity: Severity;
    x: number;
    y: number;
    width: number;
    height: number;
    comment: string;
    error_category: ErrorCategory;
    timestamp?: number;
    is_resolved?: number;
}

// === Score Types ===
export interface Score {
    id: string;
    document_id: string;
    reviewer_id: string;
    quality: number;
    complexity: number;
    ftp: number;
    design: number;
    repeat_offence: number;
    composite_score: number;
    created_at: string;
    title?: string;
    job_id?: string;
    deliverable_type?: string;
    doc_created_at?: string;
    designer_name?: string;
    designer_id?: string;
}

// === Notification Types ===
export interface Notification {
    id: string;
    user_id: string;
    message: string;
    target_url: string;
    read: number;
    created_at: string;
}

// === Upload form ===
export interface UploadedFile {
    name: string;
    type: 'image' | 'pdf' | 'unsupported';
    url: string;
    fileObject: File;
}
