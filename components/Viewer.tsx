import React, { useState, useRef, useEffect } from 'react';
import { UploadedFile, ShapeType, Annotation, Severity, ErrorCategory } from '../types';
import { AnnotationModal } from './AnnotationModal';
import { Trash2 } from 'lucide-react';
import { SEVERITY_COLORS } from '../constants';

// Declaration for PDF.js available on window
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

interface ViewerProps {
  file: UploadedFile | null;
  annotations: Annotation[];
  activeTool: ShapeType;
  onAddAnnotation: (annotation: Annotation) => void;
  onRemoveAnnotation: (id: string) => void;
  onUpdateAnnotation: (id: string, newComment: string, newSeverity?: string, newErrorCat?: string, newPredefined?: string) => void;
  viewerRef: React.RefObject<HTMLDivElement>;
}

export const Viewer: React.FC<ViewerProps> = ({ 
  file, 
  annotations, 
  activeTool, 
  onAddAnnotation, 
  onRemoveAnnotation,
  onUpdateAnnotation,
  viewerRef 
}) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number, y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPos, setModalPos] = useState({ x: 0, y: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempShape, setTempShape] = useState<Partial<Annotation> | null>(null);

  // PDF Rendering state
  const [pdfImageSrc, setPdfImageSrc] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [jumpPage, setJumpPage] = useState('1');

  // Load PDF if applicable
  useEffect(() => {
    if (file?.type === 'pdf') {
      setIsLoadingPdf(true);
      const loadPdf = async () => {
        try {
          // Use the PDF.js global
          if (!window.pdfjsLib) {
             console.error("PDF.js library not loaded");
             return;
          }
          const loadingTask = window.pdfjsLib.getDocument(file.url);
          const pdf = await loadingTask.promise;
          setNumPages(pdf.numPages);

          const page = await pdf.getPage(currentPage); // Render current page
          
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;

          setPdfImageSrc(canvas.toDataURL('image/png'));
        } catch (err) {
          console.error('Error rendering PDF', err);
        } finally {
          setIsLoadingPdf(false);
        }
      };
      loadPdf();
    } else {
      setPdfImageSrc(null);
      setNumPages(null);
    }
  }, [file, currentPage]);

  const getRelativeCoords = (e: React.MouseEvent) => {
    if (!viewerRef.current) return { x: 0, y: 0, pctX: 0, pctY: 0 };
    const rect = viewerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return {
      x,
      y,
      pctX: (x / rect.width) * 100,
      pctY: (y / rect.height) * 100,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!file || modalOpen) return;
    setIsDrawing(true);
    const coords = getRelativeCoords(e);
    setStartPoint({ x: coords.pctX, y: coords.pctY });
    setCurrentRect({ x: coords.pctX, y: coords.pctY, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !startPoint) return;
    const coords = getRelativeCoords(e);
    
    const x = Math.min(coords.pctX, startPoint.x);
    const y = Math.min(coords.pctY, startPoint.y);
    const w = Math.abs(coords.pctX - startPoint.x);
    const h = Math.abs(coords.pctY - startPoint.y);

    setCurrentRect({ x, y, w, h });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDrawing || !currentRect) return;
    setIsDrawing(false);

    // Ignore tiny accidental clicks
    if (currentRect.w < 1 || currentRect.h < 1) {
      setCurrentRect(null);
      return;
    }

    setTempShape({
      type: activeTool,
      x: currentRect.x,
      y: currentRect.y,
      width: currentRect.w,
      height: currentRect.h,
    });

    setModalPos({ x: e.clientX, y: e.clientY });
    setEditingId(null);
    setModalOpen(true);
  };

  const handleAnnotationClick = (e: React.MouseEvent, ann: Annotation) => {
    e.stopPropagation();
    setEditingId(ann.id);
    setModalPos({ x: e.clientX, y: e.clientY });
    setModalOpen(true);
  };

  const handleCommentSubmit = (comment: string, severity: Severity, errorCategory: ErrorCategory, predefinedComment: string) => {
    if (editingId) {
      onUpdateAnnotation(editingId, comment, severity, errorCategory, predefinedComment);
    } else if (tempShape) {
      const newAnnotation: Annotation = {
        id: crypto.randomUUID(),
        type: tempShape.type || ShapeType.RECTANGLE,
        pageNumber: file?.type === 'pdf' ? currentPage : 1,
        severity,
        error_category: errorCategory,
        x: tempShape.x || 0,
        y: tempShape.y || 0,
        width: tempShape.width || 0,
        height: tempShape.height || 0,
        comment,
        predefined_comment: predefinedComment,
        timestamp: Date.now(),
      };
      onAddAnnotation(newAnnotation);
    }
    closeModal();
  };

  const handleAnnotationDelete = () => {
    if (editingId) {
      onRemoveAnnotation(editingId);
    }
    closeModal();
  };

  const closeModal = () => {
    setModalOpen(false);
    setCurrentRect(null);
    setTempShape(null);
    setEditingId(null);
  };

  const renderContent = () => {
    if (!file) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <p className="text-lg font-medium">No file selected</p>
          <p className="text-sm">Upload a PDF or Image to start reviewing</p>
        </div>
      );
    }

    if (file.type === 'pdf') {
      if (isLoadingPdf) {
        return (
          <div className="flex items-center justify-center h-full text-brand-600">
            <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="ml-2">Rendering PDF...</span>
          </div>
        );
      }
      return pdfImageSrc ? (
        <img src={pdfImageSrc} alt="PDF Page 1" className="max-w-full h-auto shadow-lg select-none pointer-events-none" />
      ) : (
        <div className="text-red-500">Failed to render PDF</div>
      );
    }

    // Image
    return (
      <img src={file.url} alt="Review content" className="max-w-full h-auto shadow-lg select-none pointer-events-none" />
    );
  };

  const visibleAnnotations = annotations.filter(ann => 
    file?.type === 'pdf' ? (ann.pageNumber || 1) === currentPage : true
  );

  const editingAnnotation = editingId ? annotations.find(a => a.id === editingId) : undefined;

  return (
    <div className="relative flex-1 bg-gray-100 overflow-auto p-8 flex items-start justify-center min-h-0">
      <div 
        ref={viewerRef}
        className="relative inline-block bg-white shadow-sm cursor-crosshair select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => isDrawing && setIsDrawing(false)}
        style={{ touchAction: 'none' }} // Prevent scrolling while drawing on touch devices
      >
        {renderContent()}

        {/* Drawing Overlay */}
        {file && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Committed Annotations */}
            {visibleAnnotations.map((ann, index) => (
              <div
                key={ann.id}
                onClick={(e) => handleAnnotationClick(e, ann)}
                className={`absolute border-2 transition-all cursor-pointer pointer-events-auto group shadow-sm backdrop-blur-[1px]
                  ${editingId === ann.id ? 'z-10' : ''}`}
                style={{
                  left: `${ann.x}%`,
                  top: `${ann.y}%`,
                  width: `${ann.width}%`,
                  height: `${ann.height}%`,
                  borderRadius: ann.type === ShapeType.CIRCLE ? '50%' : '4px',
                  borderColor: editingId === ann.id ? '#3b82f6' : SEVERITY_COLORS[ann.severity],
                  backgroundColor: editingId === ann.id ? 'rgba(59, 130, 246, 0.2)' : `${SEVERITY_COLORS[ann.severity]}33` // 33 is 20% opacity in hex
                }}
              >
                {/* Trash Icon on Hover (keep quick delete, but also have in modal) */}
                {!editingId && (
                  <div className="absolute -top-3 -right-3 hidden group-hover:flex">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveAnnotation(ann.id);
                      }}
                      className="p-1 bg-white rounded-full text-red-600 shadow-sm border border-gray-200 hover:bg-red-50"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
                
                {/* Tooltip for Comment (Only show if not editing) */}
                {editingId !== ann.id && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-gray-900 text-white text-xs p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                    {ann.comment}
                  </div>
                )}
                
                {/* Index badge - Displays Number instead of ! */}
                <div className={`absolute -top-2 -left-2 w-5 h-5 flex items-center justify-center text-white text-[10px] font-bold rounded-full shadow-sm bg-gray-900`}>
                  {(annotations.findIndex(a => a.id === ann.id) + 1)}
                </div>
              </div>
            ))}

            {/* Current Drawing Shape */}
            {currentRect && (
              <div
                className="absolute border-2 border-brand-500 bg-brand-500/20"
                style={{
                  left: `${currentRect.x}%`,
                  top: `${currentRect.y}%`,
                  width: `${currentRect.w}%`,
                  height: `${currentRect.h}%`,
                  borderRadius: activeTool === ShapeType.CIRCLE ? '50%' : '4px',
                }}
              />
            )}
          </div>
        )}
      </div>

      {file?.type === 'pdf' && numPages && numPages > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-full shadow-lg border border-gray-200 flex items-center gap-4 z-20 transition-all hover:shadow-xl">
          <button 
            disabled={currentPage <= 1 || isLoadingPdf}
            onClick={() => { setCurrentPage(p => p - 1); setJumpPage(String(currentPage - 1)); }}
            className="p-1 rounded text-sm font-medium hover:bg-gray-100 disabled:opacity-50 text-gray-700 transition-colors"
          >
            &larr; Prev
          </button>
          
          <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
            <span>Page</span>
            <input 
              type="text" 
              value={jumpPage}
              onChange={(e) => setJumpPage(e.target.value)}
              disabled={isLoadingPdf}
              onBlur={() => {
                const p = parseInt(jumpPage, 10);
                if (isNaN(p) || p < 1 || p > numPages) {
                  alert(`Invalid page. Document has ${numPages} pages.`);
                  setJumpPage(String(currentPage));
                } else {
                  setCurrentPage(p);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
              className="w-12 text-center py-1 border border-gray-300 rounded focus:ring-2 focus:ring-brand-500 outline-none disabled:opacity-50"
            />
            <span>of {numPages}</span>
          </div>

          <button 
            disabled={currentPage >= numPages || isLoadingPdf}
            onClick={() => { setCurrentPage(p => p + 1); setJumpPage(String(currentPage + 1)); }}
            className="p-1 rounded text-sm font-medium hover:bg-gray-100 disabled:opacity-50 text-gray-700 transition-colors"
          >
            Next &rarr;
          </button>
        </div>
      )}

      <AnnotationModal 
        isOpen={modalOpen} 
        onClose={closeModal} 
        onSubmit={handleCommentSubmit}
        onDelete={editingId ? handleAnnotationDelete : undefined}
        position={modalPos}
        initialComment={editingAnnotation?.comment}
        initialSeverity={editingAnnotation?.severity}
        initialErrorCategory={editingAnnotation?.error_category}
        initialPredefinedComment={editingAnnotation?.predefined_comment}
      />
    </div>
  );
};