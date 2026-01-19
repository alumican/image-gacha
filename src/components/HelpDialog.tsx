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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

