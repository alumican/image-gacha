import React from 'react';
import {
  Select as SelectPrimitive,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface SelectOption {
  value: string;
  label: string;
}

interface SimpleSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

export const SimpleSelect: React.FC<SimpleSelectProps> = ({
  value,
  onValueChange,
  options,
  placeholder,
  className = '',
}) => {
  return (
    <SelectPrimitive value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectPrimitive>
  );
};

