import React, { useState } from 'react';
import { ExpandablePane } from './ExpandablePane';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Pencil } from 'lucide-react';

interface EditableExpandablePaneProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: (value: string) => Promise<void> | void;
  placeholder?: string;
  dialogTitle?: string;
  dialogDescription?: string;
  parseGacha?: (value: string) => string; // Function to parse gacha notation
  initialHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  className?: string;
  keepOpenOnSave?: boolean; // If true, dialog stays open after save
}

/**
 * ExpandablePane with edit button and modal dialog for editing
 * Supports Dry Run functionality for gacha notation
 */
export const EditableExpandablePane: React.FC<EditableExpandablePaneProps> = ({
  value,
  onChange,
  onSave,
  placeholder,
  dialogTitle = 'Edit',
  dialogDescription = 'Edit in a larger area',
  parseGacha,
  initialHeight = 120,
  minHeight = 80,
  maxHeight = 600,
  className = '',
  keepOpenOnSave = false,
}) => {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);
  const [editingValue, setEditingValue] = useState<string>('');
  const [dryRunResult, setDryRunResult] = useState<string | null>(null);

  const handleOpenDialog = () => {
    setEditingValue(value);
    setDryRunResult(null); // Reset dry run result when opening dialog
    setIsEditDialogOpen(true);
  };

  const handleSave = async () => {
    onChange(editingValue);
    
    if (onSave) {
      await onSave(editingValue);
    }
    
    // Only close dialog if keepOpenOnSave is false
    if (!keepOpenOnSave) {
      setIsEditDialogOpen(false);
      setDryRunResult(null);
    }
  };

  const handleDryRun = () => {
    if (parseGacha) {
      const result = parseGacha(editingValue);
      setDryRunResult(result);
    }
  };

  const handleCloseDialog = (open: boolean) => {
    if (!open) {
      setIsEditDialogOpen(false);
      setDryRunResult(null); // Clear dry run result when closing
    }
  };

  return (
    <>
      <ExpandablePane
        initialHeight={initialHeight}
        minHeight={minHeight}
        maxHeight={maxHeight}
        className={`relative ${className}`}
      >
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="resize-none font-mono text-sm pr-10 h-full"
        />
        <Button
          variant="ghost"
          size="icon"
          className="absolute bottom-2 right-2 h-8 w-8 text-muted-foreground hover:text-foreground z-10"
          onClick={handleOpenDialog}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </ExpandablePane>

      <Dialog open={isEditDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {dialogDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0 px-1">
            <Textarea
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              placeholder={placeholder}
              className="min-h-[200px] resize-none font-mono text-sm"
            />
            {dryRunResult !== null && (
              <Textarea
                value={dryRunResult}
                readOnly
                className="min-h-[1.5rem] resize-y font-mono text-sm bg-muted"
              />
            )}
          </div>
          <DialogFooter className="justify-between">
            {parseGacha && (
              <Button variant="outline" onClick={handleDryRun}>
                Dry Run
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => handleCloseDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
