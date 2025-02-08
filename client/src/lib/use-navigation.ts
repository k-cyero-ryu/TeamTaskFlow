import { useCallback } from 'react';
import { useLocation } from 'wouter';

export function useNavigation() {
  const [, setLocation] = useLocation();
  
  const navigate = useCallback((path: string) => {
    // Get the base URL from the current window location
    const baseUrl = window.location.pathname.split('/').slice(0, -1).join('/');
    // Ensure the path starts with a slash
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    // Combine base URL with the path, avoiding double slashes
    const fullPath = baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
    
    console.log(`Navigating to: ${fullPath} (original path: ${path})`);
    setLocation(fullPath);
  }, [setLocation]);

  return navigate;
}
