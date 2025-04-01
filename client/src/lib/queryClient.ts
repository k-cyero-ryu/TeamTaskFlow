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
          // Create a new clone since we already consumed the response body with json()
          const resForText = res.clone();
          try {
            const text = await resForText.text();
            
            // If text includes HTML content, provide a clearer error
            if (text.includes('<!DOCTYPE') || text.includes('<html')) {
              throw new Error(`Server error ${res.status}: Server returned HTML instead of JSON. This usually indicates a server-side error.`);
            } else {
              throw new Error(`${res.status}: ${text || res.statusText}`);
            }
          } catch (textError) {
            // If both JSON and text parsing fail, use a generic error
            throw new Error(`${res.status}: ${res.statusText} (Error parsing response)`);
          }
        }
      } else {
        // Plain text error - make sure to use a fresh clone
        const resForText = res.clone();
        try {
          const text = await resForText.text();
          
          // If text includes HTML content, provide a clearer error
          if (text.includes('<!DOCTYPE') || text.includes('<html')) {
            throw new Error(`Server error ${res.status}: Server returned HTML instead of JSON. This usually indicates a server-side error.`);
          } else {
            throw new Error(`${res.status}: ${text || res.statusText}`);
          }
        } catch (textError) {
          // If text parsing fails, use a generic error
          throw new Error(`${res.status}: ${res.statusText} (Error parsing response)`);
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
  method: string,
  url: string,
  data?: any,
  options?: RequestInit,
): Promise<Response> {
  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: data ? JSON.stringify(data) : undefined,
    ...options,
    credentials: "include",
  };

  const res = await fetch(url, config);
  
  // Clone the response before checking if it's ok
  // This ensures we can still return a usable response object
  const resForError = res.clone();
  
  try {
    await throwIfResNotOk(resForError);
  } catch (error) {
    // If error checking fails, we still want to propagate the error
    // but we also want to return a usable response object
    throw error;
  }
  
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

    // Clone the response before error checking
    const resForError = res.clone();
    
    try {
      await throwIfResNotOk(resForError);
    } catch (error) {
      throw error;
    }
    
    try {
      return await res.json();
    } catch (error) {
      console.error("Failed to parse JSON response:", error);
      
      // Clone the response to read it again - we already used the original for json()
      const resForText = res.clone();
      
      try {
        const text = await resForText.text();
        
        // If it's HTML, provide a more helpful error
        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
          throw new Error(`Server returned HTML instead of JSON. This usually indicates a server-side error.`);
        } else {
          // If it's not HTML, just throw a more descriptive error
          throw new Error(`Failed to parse server response: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
        }
      } catch (textError) {
        // If reading as text also fails, throw the original error
        throw new Error(`Failed to parse response: ${error instanceof Error ? error.message : String(error)}`);
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
