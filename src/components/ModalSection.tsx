import React from 'react';

interface ModalSectionProps {
  title: string;
  children: React.ReactNode;
}

/**
 * Reusable section component for modal dialogs
 * Displays a title and content with right-side gradient background and rounded corners
 */
export const ModalSection: React.FC<ModalSectionProps> = ({ title, children }) => {
  return (
    <div className="bg-muted p-4 rounded-md">
      <h3 className="text-sm font-semibold mb-2 uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  );
};
