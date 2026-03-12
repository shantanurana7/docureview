import React, { useState, useRef, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Viewer } from './components/Viewer';
import { UploadedFile, ShapeType, Annotation, DocumentMetadata } from './types';
import { exportDocument } from './utils/export';
import { SUPPORTED_IMAGE_TYPES, SUPPORTED_PDF_TYPES } from './constants';

const App: React.FC = () => {
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [activeTool, setActiveTool] = useState<ShapeType>(ShapeType.RECTANGLE);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Reset state for new file
    setAnnotations([]);

    const fileType = selectedFile.type;
    let type: UploadedFile['type'] = 'unsupported';
    
    if (SUPPORTED_IMAGE_TYPES.includes(fileType)) {
      type = 'image';
    } else if (SUPPORTED_PDF_TYPES.includes(fileType)) {
      type = 'pdf';
    } else {
      // For PPT/Word, strictly speaking we'd need backend.
      // We will alert user for this demo.
      alert("Note: For this client-side demo, please convert Word/PPT documents to PDF before uploading for best results. Images and PDFs are fully supported.");
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setFile({
      name: selectedFile.name,
      type,
      url: objectUrl,
      fileObject: selectedFile
    });
  };

  const handleAddAnnotation = useCallback((annotation: Annotation) => {
    setAnnotations(prev => [...prev, annotation]);
  }, []);

  const handleRemoveAnnotation = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
  }, []);

  const handleUpdateAnnotation = useCallback((id: string, newComment: string) => {
    setAnnotations(prev => prev.map(a => 
      a.id === id ? { ...a, comment: newComment } : a
    ));
  }, []);

  const handleDownload = async (metadata: DocumentMetadata) => {
    if (!viewerRef.current || !file) return;
    setIsExporting(true);
    // Slight delay to allow UI to update state
    setTimeout(async () => {
      await exportDocument(viewerRef.current!, file, annotations, metadata);
      setIsExporting(false);
    }, 100);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-100 font-sans text-gray-900">
      {/* Main Content Area (Viewer) */}
      <Viewer 
        file={file}
        annotations={annotations}
        activeTool={activeTool}
        onAddAnnotation={handleAddAnnotation}
        onRemoveAnnotation={handleRemoveAnnotation}
        onUpdateAnnotation={handleUpdateAnnotation}
        viewerRef={viewerRef}
      />

      {/* Right Sidebar */}
      <Sidebar 
        file={file}
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        onUpload={handleFileUpload}
        onDownload={handleDownload}
        annotations={annotations}
        isExporting={isExporting}
        onRemoveAnnotation={handleRemoveAnnotation}
        onUpdateAnnotation={handleUpdateAnnotation}
      />
    </div>
  );
};

export default App;