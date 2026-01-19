import React from 'react';
import { Button } from './ui/button';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { GeneratedImage } from '../types';

interface BookmarkButtonProps {
  image: GeneratedImage;
  onToggle: (imageId: string) => void;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  className?: string;
}

/**
 * Bookmark button component that displays bookmark status and handles toggle
 * Shows BookmarkCheck icon when bookmarked, Bookmark icon when not
 */
export const BookmarkButton: React.FC<BookmarkButtonProps> = ({
  image,
  onToggle,
  size = 'icon',
  variant = 'outline',
  className = '',
}) => {
  const isBookmarked = image.metadata.bookmarked;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(image.id);
      }}
      title={isBookmarked ? "Remove bookmark" : "Add bookmark"}
      className={className}
    >
      {isBookmarked ? (
        <BookmarkCheck className="h-4 w-4 fill-current" />
      ) : (
        <Bookmark className="h-4 w-4" />
      )}
    </Button>
  );
};
