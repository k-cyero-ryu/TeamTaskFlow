import { FC, ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

export interface FormFieldProps {
  id: string;
  label?: string;
  description?: string;
  error?: string;
  className?: string;
  required?: boolean;
  optional?: boolean;
  children: ReactNode;
}

/**
 * FormField wraps a form input with label, description, and error handling.
 */
export const FormField: FC<FormFieldProps> = ({
  id,
  label,
  description,
  error,
  className,
  required,
  optional,
  children,
}) => {
  // Determine if we should show a required indicator, optional indicator, or none
  const shouldShowRequired = required && !optional;
  const shouldShowOptional = optional && !required;

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <Label 
            htmlFor={id} 
            className={cn(
              "text-sm font-medium",
              error ? "text-destructive" : "text-foreground"
            )}
          >
            {label}
            {shouldShowRequired && (
              <span className="ml-1 text-destructive">*</span>
            )}
            {shouldShowOptional && (
              <span className="ml-1 text-muted-foreground text-xs">(optional)</span>
            )}
          </Label>
        </div>
      )}

      <div className="relative">
        {children}
        
        {/* Show error icon for validation errors */}
        {error && (
          <div className="absolute top-1/2 right-3 -translate-y-1/2 pointer-events-none">
            <AlertCircle className="h-4 w-4 text-destructive" />
          </div>
        )}
      </div>

      {/* Show description text or error message */}
      {(description || error) && (
        <p 
          className={cn(
            "text-xs", 
            error 
              ? "text-destructive" 
              : "text-muted-foreground"
          )}
        >
          {error || description}
        </p>
      )}
    </div>
  );
};