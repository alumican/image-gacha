import React from 'react';
import { Label } from './ui/label';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  htmlFor,
  children,
  className = '',
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
};

