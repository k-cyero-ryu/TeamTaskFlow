import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, X, File } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  onClearFiles: () => void;
  selectedFiles: File[];
  maxFiles?: number;
  className?: string;
}

export function FileUpload({
  onFilesSelected,
  onClearFiles,
  selectedFiles,
  maxFiles = 5,
  className
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const filesArray = Array.from(event.target.files);
      if (filesArray.length + selectedFiles.length > maxFiles) {
        alert(`You can only upload a maximum of ${maxFiles} files.`);
        return;
      }
      onFilesSelected(filesArray);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    if (event.dataTransfer.files) {
      const filesArray = Array.from(event.dataTransfer.files);
      if (filesArray.length + selectedFiles.length > maxFiles) {
        alert(`You can only upload a maximum of ${maxFiles} files.`);
        return;
      }
      onFilesSelected(filesArray);
    }
  };

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = [...selectedFiles];
    newFiles.splice(index, 1);
    onFilesSelected(newFiles);
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={cn("w-full", className)}>
      {selectedFiles.length > 0 && (
        <div className="mb-2">
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 bg-background border rounded-md"
              >
                <File className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-sm truncate max-w-[150px]">{file.name}</span>
                  <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleRemoveFile(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
          {selectedFiles.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFiles}
              className="mt-1 h-6 text-xs"
            >
              Clear all
            </Button>
          )}
        </div>
      )}

      <div
        className={cn(
          "border-2 border-dashed rounded-md p-4 cursor-pointer transition-colors flex flex-col items-center justify-center gap-2",
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/20",
          selectedFiles.length > 0 ? "p-2" : "p-4"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleButtonClick}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          className="hidden"
          accept="*/*" // Can be restricted later if needed
        />
        
        <Paperclip className={cn(
          "text-muted-foreground",
          selectedFiles.length > 0 ? "h-4 w-4" : "h-6 w-6"
        )} />
        
        {selectedFiles.length === 0 && (
          <>
            <p className="text-sm font-medium">Drag and drop files here or click to browse</p>
            <p className="text-xs text-muted-foreground">
              Upload up to {maxFiles} files (10MB max per file)
            </p>
          </>
        )}
        {selectedFiles.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Add more files ({selectedFiles.length}/{maxFiles})
          </p>
        )}
      </div>
    </div>
  );
}

// File attachment display component
interface FileAttachmentProps {
  filename: string;
  size?: number;
  url: string;
  className?: string;
}

export function FileAttachment({ filename, size, url, className }: FileAttachmentProps) {
  // Format file size if available
  const formattedSize = size ? formatFileSize(size) : null;
  
  // Helper function to format file size
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  // Get file extension to show appropriate icon (can be expanded later)
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  
  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer" 
      className={cn("flex items-center gap-2 p-2 bg-background border rounded-md transition-colors hover:bg-accent/50 min-w-[120px]", className)}
      download={filename}
    >
      <File className="h-4 w-4 text-muted-foreground" />
      <div className="flex flex-col overflow-hidden">
        <span className="text-sm font-medium truncate">{filename}</span>
        {formattedSize && (
          <span className="text-xs text-muted-foreground">{formattedSize}</span>
        )}
      </div>
    </a>
  );
}