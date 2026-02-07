import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

interface MemoEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memo: string;
  onSave: (memo: string) => Promise<void>;
}

/**
 * Memo edit modal component
 * Displays a textarea for editing memo and Cancel/Save buttons
 */
export const MemoEditModal: React.FC<MemoEditModalProps> = ({
  open,
  onOpenChange,
  memo: initialMemo,
  onSave,
}) => {
  const [memo, setMemo] = useState<string>(initialMemo);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Update memo state when initialMemo changes
  useEffect(() => {
    setMemo(initialMemo);
  }, [initialMemo]);

  // Reset memo when modal closes
  useEffect(() => {
    if (!open) {
      setMemo(initialMemo);
      setIsSaving(false);
    }
  }, [open, initialMemo]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(memo);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save memo:', error);
      // Error handling is done in parent component via toast
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setMemo(initialMemo);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Memo</DialogTitle>
          <DialogDescription>
            Add or edit a memo for this image.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Enter memo..."
            className="min-h-[200px] resize-none"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
