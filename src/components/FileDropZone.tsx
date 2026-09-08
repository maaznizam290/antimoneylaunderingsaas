'use client';

import { useRef, useState, type DragEvent } from 'react';
import { Button } from '@/components/ui/Button';

interface FileDropZoneProps {
  title: string;
  hint: string;
  accept: string;
  pendingFiles: File[];
  onFilesSelected: (files: File[]) => void;
  onRemove: (index: number) => void;
  onUpload: () => void;
  isUploading: boolean;
  disabled?: boolean;
}

export function FileDropZone({
  title,
  hint,
  accept,
  pendingFiles,
  onFilesSelected,
  onRemove,
  onUpload,
  isUploading,
  disabled,
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    onFilesSelected(Array.from(e.dataTransfer.files));
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <p className="mb-2 text-xs text-slate-500">{hint}</p>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-4 py-8 text-center transition-colors ${
          disabled ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300' : isDragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 hover:border-indigo-300'
        }`}
      >
        <p className="text-sm text-slate-600">
          Drag and drop files here, or <span className="text-indigo-600 underline">browse</span>
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          disabled={disabled}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) onFilesSelected(Array.from(e.target.files));
            e.target.value = '';
          }}
        />
      </div>

      {pendingFiles.length > 0 && (
        <ul className="mt-2 space-y-1">
          {pendingFiles.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs">
              <span className="truncate">
                {f.name} <span className="text-slate-400">({(f.size / 1024).toFixed(1)} KB)</span>
              </span>
              <button onClick={() => onRemove(i)} className="ml-2 text-slate-400 hover:text-red-600" aria-label={`Remove ${f.name}`}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {pendingFiles.length > 0 && (
        <Button variant="outline" className="mt-2" onClick={onUpload} disabled={isUploading || disabled}>
          {isUploading ? 'Uploading…' : `Upload ${pendingFiles.length} file(s)`}
        </Button>
      )}
    </div>
  );
}
