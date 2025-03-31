import { toast } from "@/hooks/use-toast";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

// Define custom error types
export class ApiError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

export class NetworkError extends Error {
  constructor(message: string = "Network request failed") {
    super(message);
    this.name = "NetworkError";
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = "Authentication failed") {
    super(message);
    this.name = "AuthenticationError";
  }
}

// Helper to extract error message from various error types
export function extractErrorMessage(error: unknown): string {
  // Handle ZodError (validation errors)
  if (error instanceof ZodError) {
    const validationError = fromZodError(error);
    return validationError.message;
  }
  
  // Handle Error objects
  if (error instanceof Error) {
    return error.message;
  }
  
  // Handle string errors
  if (typeof error === "string") {
    return error;
  }
  
  // Handle objects with message property
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  
  // Default fallback
  return "An unexpected error occurred";
}

// Handle errors from API/query operations
export function handleQueryError(
  error: unknown, 
  options?: { 
    title?: string; 
    showToast?: boolean;
  }
): string {
  const { title = "Error", showToast = false } = options || {};
  const errorMessage = extractErrorMessage(error);
  
  if (showToast) {
    toast({
      title,
      description: errorMessage,
      variant: "destructive",
    });
  }
  
  // For authentication errors, redirect to login
  if (
    error instanceof AuthenticationError || 
    (error instanceof ApiError && error.statusCode === 401)
  ) {
    // If we're not already on the auth page, redirect
    if (!window.location.pathname.includes("/auth")) {
      window.location.href = "/auth";
    }
  }
  
  return errorMessage;
}

// Global error handler for unhandled errors
export function globalErrorHandler(error: unknown): void {
  console.error("Global error handler caught:", error);
  
  const errorMessage = extractErrorMessage(error);
  
  toast({
    title: "Application Error",
    description: errorMessage,
    variant: "destructive",
  });
}