import * as React from "react"
import { cn } from "@/utils/classNames"

/**
 * VisuallyHidden component
 * Hides content visually but keeps it accessible to screen readers
 * Uses Tailwind CSS sr-only class for implementation
 */
const VisuallyHidden = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("sr-only", className)}
    {...props}
  />
))
VisuallyHidden.displayName = "VisuallyHidden"

export { VisuallyHidden }
