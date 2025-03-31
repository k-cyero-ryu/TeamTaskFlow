import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { globalErrorHandler } from "./error-utils";

// Define type for API error responses
interface ApiErrorResponse {
  message?: string;
  errors?: Record<string, string[]>;
  error?: string;
  status?: number;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      // Try to parse as JSON first to get structured error data
      const contentType = res.headers.get("content-type");
      
      // Safe clone of the response to handle potential parsing issues
      const resClone = res.clone();
      
      if (contentType && contentType.includes("application/json")) {
        try {
          const errorData = await res.json() as ApiErrorResponse;
          // Create an error that mimics AxiosError structure for consistent handling
          const error = new Error(errorData.message || res.statusText) as any;
          error.response = {
            status: res.status,
            statusText: res.statusText,
            data: errorData,
          };
          throw error;
        } catch (jsonError) {
          // If JSON parsing fails, fall back to text parsing
          const text = await resClone.text();
          
          // If text includes HTML content, provide a clearer error
          if (text.includes('<!DOCTYPE') || text.includes('<html')) {
            throw new Error(`Server error ${res.status}: Server returned HTML instead of JSON. This usually indicates a server-side error.`);
          } else {
            throw new Error(`${res.status}: ${text || res.statusText}`);
          }
        }
      } else {
        // Plain text error
        const text = await resClone.text();
        
        // If text includes HTML content, provide a clearer error
        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
          throw new Error(`Server error ${res.status}: Server returned HTML instead of JSON. This usually indicates a server-side error.`);
        } else {
          throw new Error(`${res.status}: ${text || res.statusText}`);
        }
      }
    } catch (parseError) {
      // If the error is not from our JSON/text parsing, propagate it
      if (parseError instanceof Error) {
        throw parseError;
      }
      // Ultimate fallback if everything else fails
      throw new Error(`${res.status}: ${res.statusText}`);
    }
  }
}

export async function apiRequest(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    
    try {
      return await res.json();
    } catch (error) {
      console.error("Failed to parse JSON response:", error);
      
      // Clone the response to read it again
      const resClone = res.clone();
      const text = await resClone.text();
      
      // If it's HTML, provide a more helpful error
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        throw new Error(`Server returned HTML instead of JSON. This usually indicates a server-side error.`);
      } else {
        // If it's not HTML, just throw the original error
        throw new Error(`Failed to parse server response: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
      }
    }
  };

// We're using globalErrorHandler from error-utils.ts

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// In TanStack React Query V5, we would normally use the following code, 
// but there seems to be a type issue with the event subscriptions

// Disable cache subscriptions for now since they're causing errors
// queryClient.getQueryCache().subscribe({
//   error: (error: unknown) => {
//     globalErrorHandler(error);
//   }
// });
// 
// queryClient.getMutationCache().subscribe({
//   error: (error: unknown) => {
//     globalErrorHandler(error);
//   }
// });
