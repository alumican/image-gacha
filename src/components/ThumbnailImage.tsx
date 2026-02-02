import React, { useState } from 'react';

/**
 * Thumbnail image component with fallback support
 * Displays an image thumbnail that falls back to a secondary URL if the primary fails to load
 */
interface ThumbnailImageProps {
  initialUrl: string;
  fallbackUrl: string;
  alt: string;
  onImageClick: (url: string) => void;
}

export const ThumbnailImage: React.FC<ThumbnailImageProps> = ({ 
  initialUrl, 
  fallbackUrl, 
  alt, 
  onImageClick 
}) => {
  const [imageUrl, setImageUrl] = useState<string>(initialUrl);
  
  return (
    <div 
      className="relative border rounded-md overflow-hidden bg-muted cursor-pointer group"
      style={{ width: '100px', height: '100px' }}
      onClick={() => onImageClick(imageUrl)}
    >
      <img
        src={imageUrl}
        alt={alt}
        className="w-full h-full object-contain"
        onError={() => {
          if (imageUrl !== fallbackUrl) {
            setImageUrl(fallbackUrl);
          }
        }}
      />
    </div>
  );
};
