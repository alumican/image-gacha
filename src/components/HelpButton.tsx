import { HelpCircle } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

interface HelpButtonProps {
  onClick: () => void;
  className?: string;
}

/**
 * Reusable help button component
 * Displays a question mark icon button for showing help information
 */
export function HelpButton({ onClick, className }: HelpButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={cn('h-6 w-6 text-muted-foreground hover:text-foreground', className)}
    >
      <HelpCircle className="h-4 w-4" />
    </Button>
  );
}

