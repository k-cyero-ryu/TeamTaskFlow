import { useState } from "react";
import { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

/**
 * Custom hook to handle form validation errors more effectively
 * @param form The react-hook-form useForm return value
 */
export function useFormError<T extends FieldValues>(form: UseFormReturn<T>) {
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  /**
   * Set validation errors on the form
   * @param errors Record of field name to error message
   */
  const setFieldErrors = (errors: Record<string, string>) => {
    // Update state for retrieval via getFieldError
    setFormErrors(errors);

    // Set errors on the form itself
    Object.entries(errors).forEach(([field, message]) => {
      try {
        form.setError(field as FieldPath<T>, {
          type: "manual",
          message,
        });
      } catch (e) {
        console.error(`Error setting field error for ${field}:`, e);
      }
    });
  };

  /**
   * Get a validation error for a specific field
   * @param field Field name
   * @returns Error message if available
   */
  const getFieldError = (field: string): string | undefined => {
    return formErrors[field] || form.formState.errors[field as FieldPath<T>]?.message as string | undefined;
  };

  /**
   * Clear all form errors
   */
  const clearFormErrors = () => {
    setFormErrors({});
    form.clearErrors();
  };

  /**
   * Handle an error during form submission
   * @param error The error that occurred
   * @param options Additional options for handling the error
   */
  const handleFormSubmitError = (
    error: unknown, 
    options?: { 
      setGeneralError?: (message: string) => void,
      defaultMessage?: string 
    }
  ) => {
    const { setGeneralError, defaultMessage = "An error occurred" } = options || {};

    // Handle Zod validation errors
    if (error instanceof ZodError) {
      const validationError = fromZodError(error);
      const fieldErrors: Record<string, string> = {};
      
      error.errors.forEach((err) => {
        if (err.path.length > 0) {
          const field = err.path.join(".");
          fieldErrors[field] = err.message;
        } else if (setGeneralError) {
          setGeneralError(err.message);
        }
      });
      
      setFieldErrors(fieldErrors);
      return validationError.message;
    }
    
    // Handle API errors
    if (error instanceof Error) {
      if (setGeneralError) {
        setGeneralError(error.message || defaultMessage);
      }
      return error.message || defaultMessage;
    }
    
    // Handle unknown errors
    if (setGeneralError) {
      setGeneralError(defaultMessage);
    }
    return defaultMessage;
  };

  return {
    setFieldErrors,
    getFieldError,
    clearFormErrors,
    handleFormSubmitError,
  };
}