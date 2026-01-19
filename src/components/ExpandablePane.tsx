import React, { useState, useEffect, useRef } from 'react';

interface ExpandablePaneProps {
  children: React.ReactNode;
  initialHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  className?: string;
}

export const ExpandablePane: React.FC<ExpandablePaneProps> = ({
  children,
  initialHeight = 120,
  minHeight = 80,
  maxHeight = 600,
  className = '',
}) => {
  const [height, setHeight] = useState<number>(initialHeight);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const resizeStartRef = useRef<{ startY: number; startHeight: number } | null>(null);

  // Handle resize
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeStartRef.current) return;
      
      const deltaY = e.clientY - resizeStartRef.current.startY;
      const newHeight = resizeStartRef.current.startHeight + deltaY;
      
      setHeight(Math.max(minHeight, Math.min(maxHeight, newHeight)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeStartRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, minHeight, maxHeight]);

  return (
    <div className={`relative ${className}`}>
      {/* Content */}
      <div style={{ height: `${height}px` }}>
        {children}
      </div>
      
      {/* Resize handle - positioned outside the content area */}
      <div
        className="absolute -bottom-2 left-0 right-0 h-2 cursor-ns-resize flex items-center justify-center group z-10"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          resizeStartRef.current = {
            startY: e.clientY,
            startHeight: height,
          };
          setIsResizing(true);
        }}
      >
        <div className="w-12 h-0.5 bg-border group-hover:bg-muted-foreground transition-colors" />
      </div>
    </div>
  );
};

