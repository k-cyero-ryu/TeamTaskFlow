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
import { ProtectedRoute } from "./lib/protected-route";
import { MainNav } from "./components/main-nav";
import { useAuth } from "@/hooks/use-auth";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <MainNav />
      <main className="flex-1">{children}</main>
    </div>
  );
}

export default function App() {
  const { user } = useAuth();

  // If user is authenticated, redirect from /auth to /
  if (user && window.location.pathname === "/auth") {
    window.location.href = "/";
    return null;
  }

  return (
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

      <Route component={NotFound} />
    </Switch>
  );
}