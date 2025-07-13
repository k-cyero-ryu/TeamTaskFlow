import { Switch, Route } from "wouter";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import Tasks from "@/pages/tasks";
import Chat from "@/pages/chat";
import ChatConversation from "@/pages/chat-conversation";
import Users from "@/pages/users";
import Workflows from "@/pages/workflows";
import WorkflowDetail from "@/pages/workflow-detail";
import Channels from "@/pages/channels";
import ChannelDetail from "@/pages/channel-detail";
import Stock from "@/pages/stock";
import Estimations from "@/pages/estimations";
import Proformas from "@/pages/proformas";
import Expenses from "@/pages/expenses";
import Settings from "@/pages/settings";
import CompanySettings from "@/pages/company-settings";
import { ProtectedRoute } from "./lib/protected-route";
import { SidebarNav } from "./components/sidebar-nav";
import { useAuth } from "@/hooks/use-auth";
import { wsClient } from "./lib/websocket";
import { useEffect } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { handleQueryError } from "@/lib/error-utils";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <SidebarNav />
      <main className="flex-1 lg:ml-64 min-w-0">
        <div className="p-4 pt-2 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      try {
        wsClient.connect();
      } catch (error) {
        console.error("Failed to connect to WebSocket:", error);
        // Don't let WebSocket errors crash the app
      }
    } else {
      try {
        wsClient.disconnect();
      } catch (error) {
        console.error("Error disconnecting WebSocket:", error);
      }
    }
  }, [user]);

  // If user is authenticated, redirect from /auth to /
  if (user && window.location.pathname === "/auth") {
    window.location.href = "/";
    return null;
  }

  // Custom fallback UI for the global error boundary
  const globalErrorFallback = (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-8 p-8 bg-card rounded-lg shadow-lg">
        <div className="text-center space-y-6">
          <h2 className="text-3xl font-bold text-foreground">Something went wrong</h2>
          <p className="text-muted-foreground">
            We encountered an unexpected error. Please try refreshing the page or contact support if the issue persists.
          </p>
          <Button 
            onClick={() => window.location.reload()} 
            size="lg"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh the application
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <ErrorBoundary 
      fallback={globalErrorFallback} 
      onError={(error) => {
        console.error("Global application error:", error);
        handleQueryError(error, { title: "Application Error", showToast: true });
      }}
      showToast={true}
    >
      <Switch>
        {/* Public Route */}
        <Route path="/auth">
          <AuthPage />
        </Route>

        {/* Protected Routes with Layout */}
        <Route path="/">
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        </Route>

        <Route path="/tasks">
          <ProtectedRoute>
            <Layout>
              <Tasks />
            </Layout>
          </ProtectedRoute>
        </Route>

        <Route path="/workflows">
          <ProtectedRoute>
            <Layout>
              <Workflows />
            </Layout>
          </ProtectedRoute>
        </Route>

        <Route path="/workflows/:id">
          {(params) => (
            <ProtectedRoute>
              <Layout>
                <WorkflowDetail params={params} />
              </Layout>
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/chat">
          <ProtectedRoute>
            <Layout>
              <Chat />
            </Layout>
          </ProtectedRoute>
        </Route>

        <Route path="/chat/:id">
          {(params) => (
            <ProtectedRoute>
              <Layout>
                <ChatConversation params={params} />
              </Layout>
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/users">
          <ProtectedRoute>
            <Layout>
              <Users />
            </Layout>
          </ProtectedRoute>
        </Route>

        <Route path="/channels">
          <ProtectedRoute>
            <Layout>
              <Channels />
            </Layout>
          </ProtectedRoute>
        </Route>

        <Route path="/channels/:id">
          {(params) => (
            <ProtectedRoute>
              <Layout>
                <ChannelDetail />
              </Layout>
            </ProtectedRoute>
          )}
        </Route>
        
        <Route path="/settings">
          <ProtectedRoute>
            <Layout>
              <Settings />
            </Layout>
          </ProtectedRoute>
        </Route>

        <Route path="/company-settings">
          <ProtectedRoute>
            <Layout>
              <CompanySettings />
            </Layout>
          </ProtectedRoute>
        </Route>

        <Route path="/estimations">
          <ProtectedRoute>
            <Layout>
              <Estimations />
            </Layout>
          </ProtectedRoute>
        </Route>

        <Route path="/proformas">
          <ProtectedRoute>
            <Layout>
              <Proformas />
            </Layout>
          </ProtectedRoute>
        </Route>

        <Route path="/expenses">
          <ProtectedRoute>
            <Layout>
              <Expenses />
            </Layout>
          </ProtectedRoute>
        </Route>

        <Route path="/stock">
          <ProtectedRoute>
            <Layout>
              <Stock />
            </Layout>
          </ProtectedRoute>
        </Route>

        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}