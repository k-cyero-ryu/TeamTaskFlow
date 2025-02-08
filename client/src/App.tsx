import { Switch, Route } from "wouter";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import Tasks from "@/pages/tasks";
import Chat from "@/pages/chat";
import ChatConversation from "@/pages/chat-conversation";
import Users from "@/pages/users";
import { ProtectedRoute } from "./lib/protected-route";
import { MainNav } from "./components/main-nav";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <MainNav />
      <main className="flex-1">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
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
      <Route path="/chat">
        <ProtectedRoute>
          <Layout>
            <Chat />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/chat/:id">
        <ProtectedRoute>
          <Layout>
            <ChatConversation params={{ id: window.location.pathname.split("/")[2] }} />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/users">
        <ProtectedRoute>
          <Layout>
            <Users />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}