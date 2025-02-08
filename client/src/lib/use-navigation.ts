import { useCallback } from 'react';
import { useLocation } from 'wouter';

export function useNavigation() {
  const [, setLocation] = useLocation();

  const navigate = useCallback((path: string) => {
    // Strip any double slashes that might occur from path concatenation
    const normalizedPath = path.replace(/\/+/g, '/');

    console.log(`Navigation requested to path: ${path}`);
    console.log(`Current location: ${window.location.pathname}`);

    // Always use absolute paths when navigating
    setLocation(normalizedPath);
  }, [setLocation]);

  return navigate;
}