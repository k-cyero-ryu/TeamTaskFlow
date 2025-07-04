import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider } from "@/hooks/use-auth";
import { I18nProvider } from "@/i18n/provider";
import { Toaster } from "@/components/ui/toaster";
import App from "./App";
import "./index.css";

const root = createRoot(document.getElementById("root")!);

root.render(
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <AuthProvider>
        <App />
        <Toaster />
      </AuthProvider>
    </I18nProvider>
  </QueryClientProvider>
);