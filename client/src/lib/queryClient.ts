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
    headers: {},
    credentials: "include",
    ...options,
  };

  // Handle FormData vs JSON data
  if (data instanceof FormData) {
    // Let the browser set the content-type header with boundary for FormData
    config.body = data;
  } else if (data) {
    // For regular JSON data
    config.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
    config.body = JSON.stringify(data);
  }

  try {
    const res = await fetch(url, config);
    
    // Create a clone immediately for error checking
    const resForError = res.clone();
    
    // Check if response is OK
    if (!resForError.ok) {
      // Try to get error details from response
      try {
        const errorData = await resForError.json();
        const error = new Error(
          errorData.message || 
          errorData.error?.message || 
          `Request failed with status ${resForError.status}`
        );
        (error as any).status = resForError.status;
        throw error;
      } catch (jsonError) {
        // If we couldn't parse JSON, throw with status text
        throw new Error(`Request failed: ${resForError.statusText || resForError.status}`);
      }
    }
    
    return res;
  } catch (error) {
    console.error("API request error:", error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const res = await fetch(queryKey[0] as string, {
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      // Create a clone right away before doing anything with the response
      const resForProcessing = res.clone();
      
      // Check if response is ok using the original response
      if (!res.ok) {
        // Try to parse error as JSON
        try {
          const errorData = await res.json();
          throw new Error(errorData.message || errorData.error?.message || res.statusText);
        } catch (jsonError) {
          // If JSON parsing fails, try to get text content
          const textResponse = await res.clone().text();
          
          // Check if it's an HTML response
          if (textResponse.includes('<!DOCTYPE') || textResponse.includes('<html')) {
            throw new Error(`Server error ${res.status}: Server returned HTML instead of JSON`);
          } else {
            throw new Error(`Error ${res.status}: ${textResponse || res.statusText}`);
          }
        }
      }
      
      // Use the clone for the actual data
      try {
        // Check if the response is HTML before trying to parse as JSON
        const contentType = res.headers.get('content-type');
        
        // Get a text version first to check
        const textResponse = await resForProcessing.clone().text();
        
        // Check if it's an HTML response
        if (textResponse.includes('<!DOCTYPE') || textResponse.includes('<html')) {
          throw new Error(`Failed to parse response: Received HTML instead of JSON`);
        }
        
        // If we got here, try to parse as JSON
        try {
          return JSON.parse(textResponse);
        } catch (jsonError) {
          console.error("Failed to parse JSON response:", jsonError);
          throw new Error(`Failed to parse response: ${textResponse.substring(0, 50)}...`);
        }
      } catch (error) {
        console.error("Failed to parse response:", error);
        throw error;
      }
    } catch (error) {
      console.error("Query error:", error);
      throw error;
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
