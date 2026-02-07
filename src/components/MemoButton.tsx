import React from 'react';
import { Button } from './ui/button';
import { Pencil } from 'lucide-react';
import { GeneratedImage } from '../types';

interface MemoButtonProps {
  image: GeneratedImage;
  onClick: (image: GeneratedImage) => void;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  className?: string;
  disabled?: boolean;
}

/**
 * Memo button component that displays memo status and handles click
 * Shows filled Pencil icon when memo exists, Pencil icon when not
 */
export const MemoButton: React.FC<MemoButtonProps> = ({
  image,
  onClick,
  size = 'icon',
  variant = 'outline',
  className = '',
  disabled = false,
}) => {
  const hasMemo = !!image.metadata?.memo;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) {
          onClick(image);
        }
      }}
      title={hasMemo ? "Edit memo" : "Add memo"}
      className={className}
      disabled={disabled}
    >
      {hasMemo ? (
        <Pencil className="h-4 w-4 fill-black stroke-none" />
      ) : (
        <Pencil className="h-4 w-4" />
      )}
    </Button>
  );
};
