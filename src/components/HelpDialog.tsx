import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { ReactNode } from 'react';

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}

/**
 * Reusable help dialog component
 * Used for displaying help information for various sections
 */
export function HelpDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: HelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3 overflow-y-auto flex-1 min-h-0 px-1">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

