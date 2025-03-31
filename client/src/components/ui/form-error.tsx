import { FC } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

interface FormErrorMessageProps {
  message?: string;
  className?: string;
}

/**
 * FormErrorMessage displays a formatted error message for form validation errors
 */
export const FormErrorMessage: FC<FormErrorMessageProps> = ({
  message,
  className,
}) => {
  if (!message) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-destructive text-sm mt-1.5",
        className
      )}
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      <span>{message}</span>
    </div>
  );
};

interface FormGeneralErrorProps {
  error?: string | string[];
  className?: string;
}

/**
 * FormGeneralError displays form-level errors (not tied to a specific field)
 */
export const FormGeneralError: FC<FormGeneralErrorProps> = ({
  error,
  className,
}) => {
  if (!error || (Array.isArray(error) && error.length === 0)) return null;
  
  const errorMessages = Array.isArray(error) ? error : [error];
  
  return (
    <div
      className={cn(
        "p-3 border border-destructive/50 bg-destructive/10 rounded-md mb-4",
        className
      )}
    >
      <div className="flex gap-2">
        <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          {errorMessages.map((message, index) => (
            <p key={index} className="text-destructive text-sm">
              {message}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
};