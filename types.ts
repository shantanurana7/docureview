export enum ShapeType {
  RECTANGLE = 'RECTANGLE',
  CIRCLE = 'CIRCLE',
}

export enum Severity {
  MINOR = 'MINOR',
  MODERATE = 'MODERATE',
  MAJOR = 'MAJOR',
  CRITICAL = 'CRITICAL'
}

export interface Annotation {
  id: string;
  type: ShapeType;
  pageNumber: number; // 1-indexed
  severity: Severity;
  x: number; // percentage (0-100) relative to container width
  y: number; // percentage (0-100) relative to container height
  width: number; // percentage
  height: number; // percentage
  comment: string;
  timestamp: number;
}

export interface UploadedFile {
  name: string;
  type: 'image' | 'pdf' | 'unsupported';
  url: string;
  fileObject: File;
}

export interface ViewportCoords {
  x: number;
  y: number;
}

export interface DocumentMetadata {
  designerName: string;
  jobNumber: string;
  deliveryType: 'Complex' | 'Medium' | 'Low';
}

