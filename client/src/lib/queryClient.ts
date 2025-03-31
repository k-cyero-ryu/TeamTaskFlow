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
        const errorData = await res.json() as ApiErrorResponse;
        // Create an error that mimics AxiosError structure for consistent handling
        const error = new Error(errorData.message || res.statusText) as any;
        error.response = {
          status: res.status,
          statusText: res.statusText,
          data: errorData,
        };
        throw error;
      } else {
        // Plain text error
        const text = await res.text();
        throw new Error(`${res.status}: ${text || res.statusText}`);
      }
    } catch (parseError) {
      // If we can't parse the response, throw the original response text
      if (parseError instanceof SyntaxError) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      throw parseError;
    }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
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
    return await res.json();
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
