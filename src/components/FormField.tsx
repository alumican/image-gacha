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
    <div className={className}>
      <Label htmlFor={htmlFor} className="block mb-2">{label}</Label>
      {children}
    </div>
  );
};

