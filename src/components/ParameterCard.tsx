import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { HelpButton } from './HelpButton';
import { cn } from '@/lib/utils';

interface ParameterCardProps {
  number: string;
  title: string;
  onHelpClick?: () => void;
  contentClassName?: string;
  children: React.ReactNode;
}

export const ParameterCard: React.FC<ParameterCardProps> = ({
  number,
  title,
  onHelpClick,
  contentClassName = '',
  children,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle 
            className="text-sm font-semibold uppercase tracking-wider cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {number} / {title}
          </CardTitle>
          {onHelpClick && (
            <HelpButton onClick={onHelpClick} />
          )}
        </div>
      </CardHeader>
      <div
        className={cn(
          "grid transition-all duration-150 ease-out",
          isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <CardContent className={contentClassName}>
            {children}
          </CardContent>
        </div>
      </div>
    </Card>
  );
};

