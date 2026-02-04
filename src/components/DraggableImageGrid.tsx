import React, { useState, useCallback } from 'react';
import { ReferenceImage } from '../types';
import { Button } from './ui/button';
import { X, Upload } from 'lucide-react';

interface DraggableImageGridProps {
  images: ReferenceImage[];
  onImagesChange?: (newImages: ReferenceImage[]) => void;
  onImageAdd?: (files: File[]) => void;
  onImageRemove?: (imageId: string) => void;
  onImageClick?: (imageUrl: string, index: number) => void;
  imageType?: 'prompt' | 'style';
}

/**
 * Draggable image grid component for prompt and style images
 * Supports drag-and-drop reordering, image removal, and file upload
 * 
 * Events:
 * - onImagesChange: Called when images are reordered (new order array)
 * - onImageAdd: Called when images are added (array of File objects)
 * - onImageRemove: Called when an image is removed (image ID)
 * - onImageClick: Called when an image is clicked (image URL)
 */
export const DraggableImageGrid: React.FC<DraggableImageGridProps> = ({
  images,
  onImagesChange,
  onImageAdd,
  onImageRemove,
  onImageClick,
  imageType = 'prompt',
}) => {
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [reorderedImages, setReorderedImages] = useState<ReferenceImage[] | null>(null);
  const [isDraggingUpload, setIsDraggingUpload] = useState<boolean>(false);

  const displayedImages = reorderedImages || images;

  /**
   * Handle drag start for image reordering
   */
  const handleDragStart = useCallback((index: number) => {
    if (images.length < 2) return; // Only allow dragging if there are 2 or more images
    setDraggedImageIndex(index);
    setReorderedImages(null); // Reset reordered images
  }, [images.length]);

  /**
   * Handle drag over for image reordering - real-time reordering
   */
  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    if (draggedImageIndex === null) return;
    e.preventDefault();
    e.stopPropagation();
    
    // Only update if the index actually changed
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
      
      // Real-time reordering
      const currentImages = reorderedImages || images;
      const currentDraggedIndex = reorderedImages 
        ? currentImages.findIndex(img => img.id === images[draggedImageIndex].id)
        : draggedImageIndex;
      
      if (currentDraggedIndex !== index && currentDraggedIndex !== -1) {
        const newImages = [...currentImages];
        const [moved] = newImages.splice(currentDraggedIndex, 1);
        newImages.splice(index, 0, moved);
        setReorderedImages(newImages);
      }
    }
  }, [draggedImageIndex, dragOverIndex, reorderedImages, images]);

  /**
   * Handle drop for image reordering
   */
  const handleDrop = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (draggedImageIndex === null) {
      setDraggedImageIndex(null);
      setDragOverIndex(null);
      setReorderedImages(null);
      return;
    }
    
    // Apply the reordered images if they exist, otherwise use the current index
    if (reorderedImages) {
      onImagesChange?.(reorderedImages);
      setReorderedImages(null);
    } else if (draggedImageIndex !== index) {
      const newImages = [...images];
      const [moved] = newImages.splice(draggedImageIndex, 1);
      newImages.splice(index, 0, moved);
      onImagesChange?.(newImages);
    }
    
    setDraggedImageIndex(null);
    setDragOverIndex(null);
  }, [draggedImageIndex, reorderedImages, images, onImagesChange]);

  /**
   * Handle drag end for image reordering
   */
  const handleDragEnd = useCallback(() => {
    // If reordered images exist, apply them
    if (reorderedImages) {
      onImagesChange?.(reorderedImages);
    }
    
    setDraggedImageIndex(null);
    setDragOverIndex(null);
    setReorderedImages(null);
  }, [reorderedImages, onImagesChange]);

  /**
   * Handle file selection for upload
   */
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      onImageAdd?.(fileArray);
      // Reset input to allow selecting the same file again
      e.target.value = '';
    }
  }, [onImageAdd]);

  /**
   * Handle drag over for file upload
   */
  const handleDragOverUpload = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingUpload(true);
  }, []);

  /**
   * Handle drag leave for file upload
   */
  const handleDragLeaveUpload = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingUpload(false);
  }, []);

  /**
   * Handle drop for file upload
   */
  const handleDropUpload = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingUpload(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      onImageAdd?.(fileArray);
    }
  }, [onImageAdd]);

  /**
   * Handle image removal
   */
  const handleRemove = useCallback((imageId: string) => {
    onImageRemove?.(imageId);
  }, [onImageRemove]);

  /**
   * Handle image click
   */
  const handleImageClick = useCallback((imageUrl: string, index: number) => {
    if (draggedImageIndex === null) {
      onImageClick?.(imageUrl, index);
    }
  }, [draggedImageIndex, onImageClick]);

  return (
    <div className="grid grid-cols-3 gap-2">
      {displayedImages.map((img, index) => {
        // Use original index for drag operations
        const originalIndex = reorderedImages 
          ? images.findIndex(i => i.id === img.id)
          : index;
        const isDraggingThis = draggedImageIndex === originalIndex;
        const isDragOverThis = dragOverIndex === index;
        
        return (
          <div 
            key={img.id} 
            draggable={images.length >= 2 && draggedImageIndex === null}
            onDragStart={() => handleDragStart(originalIndex)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`relative bg-muted aspect-square group cursor-pointer transition-all duration-300 ease-out ${
              isDraggingThis ? 'opacity-50 scale-95' : ''
            } ${
              isDragOverThis ? 'ring-2 ring-primary' : ''
            } ${
              images.length >= 2 && draggedImageIndex === null ? 'cursor-move' : ''
            }`}
            onClick={() => handleImageClick(img.data, index)}
          >
            <img 
              src={img.data} 
              alt={imageType === 'prompt' ? 'Prompt' : 'Style Reference'} 
              className="w-full h-full object-contain rounded-md border pointer-events-none"
            />
            {draggedImageIndex === null && (
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(img.id);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        );
      })}
      {draggedImageIndex === null && (
        <label 
          className={`aspect-square border-2 border-dashed rounded-md flex flex-col items-center justify-center cursor-pointer transition-colors ${
            isDraggingUpload 
              ? 'bg-accent border-primary border-solid' 
              : 'hover:bg-accent'
          }`}
          onDragOver={handleDragOverUpload}
          onDragLeave={handleDragLeaveUpload}
          onDrop={handleDropUpload}
        >
          <Upload className="h-6 w-6 mb-1 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">UPLOAD</span>
          <input 
            type="file" 
            multiple 
            accept="image/*" 
            onChange={handleFileChange} 
            className="hidden" 
          />
        </label>
      )}
    </div>
  );
};
