import React, { useState, useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { Severity, ErrorCategory } from '../types';
import { SEVERITY_LABELS } from '../constants';
import predefinedCommentsData from '../constants/predefinedComments.json';

const PREDEFINED_MAP = predefinedCommentsData as Record<string, {label: string, text: string}[]>;

interface AnnotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (comment: string, severity: Severity, errorCategory: ErrorCategory, predefinedComment: string) => void;
  onDelete?: () => void;
  position: { x: number; y: number };
  initialComment?: string;
  initialSeverity?: Severity;
  initialErrorCategory?: ErrorCategory;
  initialPredefinedComment?: string;
}

export const AnnotationModal: React.FC<AnnotationModalProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  onDelete, 
  position, 
  initialComment = '',
  initialSeverity = Severity.MINOR,
  initialErrorCategory = ErrorCategory.DESIGN,
  initialPredefinedComment = ''
}) => {
  const [comment, setComment] = useState(initialComment);
  const [severity, setSeverity] = useState<Severity>(initialSeverity);
  const [errorCat, setErrorCat] = useState<ErrorCategory>(initialErrorCategory);
  const [predefinedComment, setPredefinedComment] = useState(initialPredefinedComment);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setComment(initialComment);
      setSeverity(initialSeverity);
      setErrorCat(initialErrorCategory);
      setPredefinedComment(initialPredefinedComment);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, initialComment, initialSeverity, initialErrorCategory, initialPredefinedComment]);

  if (!isOpen) return null;

  // Ensure modal stays within viewport
  const style: React.CSSProperties = {
    top: Math.min(position.y, window.innerHeight - 350),
    left: Math.min(position.x, window.innerWidth - 320),
  };

  const isEditing = !!initialComment || !!initialPredefinedComment;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-start" style={{ pointerEvents: 'none' }}>
      {/* Backdrop to catch clicks outside */}
      <div className="absolute inset-0 bg-transparent" style={{ pointerEvents: 'auto' }} onClick={onClose} />
      
      <div 
        className="absolute bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-80 max-h-[90vh] overflow-y-auto flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200"
        style={{ ...style, pointerEvents: 'auto' }}
      >
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold text-gray-700">
            {isEditing ? 'Edit Comment' : 'Add Comment'}
          </h3>
          {isEditing && onDelete && (
            <button 
              onClick={onDelete}
              className="text-gray-400 hover:text-red-500 transition-colors"
              title="Delete Annotation"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
        
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <select 
              className="flex-1 p-2 border border-gray-300 rounded-md text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as Severity)}
            >
              {Object.entries(SEVERITY_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            <select 
              className="flex-1 p-2 border border-gray-300 rounded-md text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={errorCat}
              onChange={(e) => { setErrorCat(e.target.value as ErrorCategory); setPredefinedComment(''); }}
            >
              <option value={ErrorCategory.DESIGN}>Design</option>
              <option value={ErrorCategory.LAYOUT}>Layout</option>
              <option value={ErrorCategory.EDITORIAL}>Editorial</option>
              <option value={ErrorCategory.BRAND}>Brand</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Predefined Comment (Optional)</label>
            <select 
              value={predefinedComment} 
              onChange={e => setPredefinedComment(e.target.value)} 
              className="w-full p-2 border border-gray-300 rounded-md text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">-- Select a predefined comment --</option>
              {PREDEFINED_MAP[errorCat]?.map((c, idx) => (
                <option key={idx} value={c.text}>{c.label}</option>
              ))}
            </select>
            {predefinedComment && <p className="mt-1 text-[11px] leading-snug text-brand-600 italic">"{predefinedComment}"</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Additional Info</label>
            <textarea
              ref={inputRef}
              className="w-full h-20 p-2 border border-gray-300 rounded-md resize-none text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Describe the issue in more detail..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (comment.trim() || predefinedComment.trim()) onSubmit(comment, severity, errorCat, predefinedComment);
                }
              }}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-1">
          <button 
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              if (comment.trim() || predefinedComment.trim()) onSubmit(comment, severity, errorCat, predefinedComment);
            }}
            disabled={!comment.trim() && !predefinedComment.trim()}
            className="px-3 py-1.5 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isEditing ? 'Update' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};