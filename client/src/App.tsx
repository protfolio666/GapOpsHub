import { useState, useEffect } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import Header from "@/components/Header";
import LoginPage from "@/pages/LoginPage";
import ManagementDashboard from "@/pages/ManagementDashboard";
import POCDashboard from "@/pages/POCDashboard";
import QAOpsDashboard from "@/pages/QAOpsDashboard";
import GapDetailPage from "@/pages/GapDetailPage";
import GapSubmissionForm from "@/pages/GapSubmissionForm";
import FormBuilder from "@/components/FormBuilder";
import UserManagementPage from "@/pages/UserManagementPage";
import FormBuilderPage from "@/pages/FormBuilderPage";
import AdminSettingsPage from "@/pages/AdminSettingsPage";
import AllGapsPage from "@/pages/AllGapsPage";
import OverdueGapsPage from "@/pages/OverdueGapsPage";
import ReportsPage from "@/pages/ReportsPage";
import TATExtensionsPage from "@/pages/TATExtensionsPage";
import POCPerformancePage from "@/pages/POCPerformancePage";
import SopBrowserPage from "@/pages/SopBrowserPage";
import SopManagementPage from "@/pages/SopManagementPage";
import AiSopSearchPage from "@/pages/AiSopSearchPage";
import NotificationsPage from "@/pages/NotificationsPage";
import NotFound from "@/pages/not-found";
import type { PublicUser } from "@shared/schema";
import { authApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// Protected route component that checks user role
function ProtectedRoute({ 
  user, 
  allowedRoles, 
  component: Component 
}: { 
  user: PublicUser; 
  allowedRoles: string[];
  component: React.ComponentType;
}) {
  if (!allowedRoles.includes(user.role)) {
    return <Redirect to="/" />;
  }
  return <Component />;
}

function Router({ user }: { user: PublicUser }) {
  const roleRoutes = {
    Admin: "/admin",
    Management: "/management",
    "QA/Ops": "/qa",
    POC: "/poc",
  };

  return (
    <Switch>
      <Route path="/admin" component={ManagementDashboard} />
      <Route path="/management" component={ManagementDashboard} />
      <Route path="/poc" component={POCDashboard} />
      <Route path="/qa" component={QAOpsDashboard} />
      
      <Route path="/admin/users">
        <ProtectedRoute user={user} allowedRoles={["Admin"]} component={UserManagementPage} />
      </Route>
      
      <Route path="/admin/form-builder">
        <ProtectedRoute user={user} allowedRoles={["Admin", "Management"]} component={FormBuilderPage} />
      </Route>
      
      <Route path="/admin/settings">
        <ProtectedRoute user={user} allowedRoles={["Admin"]} component={AdminSettingsPage} />
      </Route>
      
      <Route path="/admin/gaps">
        <ProtectedRoute user={user} allowedRoles={["Admin", "Management"]} component={AllGapsPage} />
      </Route>
      
      <Route path="/admin/overdue">
        <ProtectedRoute user={user} allowedRoles={["Admin", "Management", "POC"]} component={OverdueGapsPage} />
      </Route>
      
      <Route path="/management/gaps">
        <ProtectedRoute user={user} allowedRoles={["Admin", "Management"]} component={AllGapsPage} />
      </Route>
      
      <Route path="/management/overdue">
        <ProtectedRoute user={user} allowedRoles={["Admin", "Management", "POC"]} component={OverdueGapsPage} />
      </Route>
      
      <Route path="/poc/overdue">
        <ProtectedRoute user={user} allowedRoles={["Admin", "Management", "POC"]} component={OverdueGapsPage} />
      </Route>
      
      <Route path="/management/form-builder">
        <ProtectedRoute user={user} allowedRoles={["Admin", "Management"]} component={FormBuilderPage} />
      </Route>
      
      <Route path="/admin/reports">
        <ProtectedRoute user={user} allowedRoles={["Admin", "Management", "POC", "QA/Ops"]} component={ReportsPage} />
      </Route>
      
      <Route path="/management/reports">
        <ProtectedRoute user={user} allowedRoles={["Admin", "Management", "POC", "QA/Ops"]} component={ReportsPage} />
      </Route>
      
      <Route path="/poc/reports">
        <ProtectedRoute user={user} allowedRoles={["Admin", "Management", "POC", "QA/Ops"]} component={ReportsPage} />
      </Route>
      
      <Route path="/qa/reports">
        <ProtectedRoute user={user} allowedRoles={["Admin", "Management", "POC", "QA/Ops"]} component={ReportsPage} />
      </Route>
      
      <Route path="/admin/tat-extensions">
        <ProtectedRoute user={user} allowedRoles={["Admin", "Management"]} component={TATExtensionsPage} />
      </Route>
      
      <Route path="/management/tat-extensions">
        <ProtectedRoute user={user} allowedRoles={["Admin", "Management"]} component={TATExtensionsPage} />
      </Route>
      
      <Route path="/admin/poc-performance">
        <ProtectedRoute user={user} allowedRoles={["Admin"]} component={() => <POCPerformancePage isAdmin={true} />} />
      </Route>
      
      <Route path="/poc/performance">
        <ProtectedRoute user={user} allowedRoles={["POC"]} component={() => <POCPerformancePage isAdmin={false} />} />
      </Route>
      
      <Route path="/admin/sops">
        <ProtectedRoute user={user} allowedRoles={["Admin", "Management"]} component={SopManagementPage} />
      </Route>
      
      <Route path="/management/sops">
        <ProtectedRoute user={user} allowedRoles={["Admin", "Management"]} component={SopManagementPage} />
      </Route>
      
      <Route path="/sops">
        <ProtectedRoute user={user} allowedRoles={["Admin", "Management", "QA/Ops", "POC"]} component={SopBrowserPage} />
      </Route>

      <Route path="/ai-sop-search">
        <ProtectedRoute user={user} allowedRoles={["Admin", "Management", "QA/Ops", "POC"]} component={AiSopSearchPage} />
      </Route>

      <Route path="/notifications" component={NotificationsPage} />
      
      <Route path="/admin/gaps/:id" component={GapDetailPage} />
      <Route path="/management/gaps/:id" component={GapDetailPage} />
      <Route path="/poc/gaps/:id" component={GapDetailPage} />
      <Route path="/qa/gaps/:id" component={GapDetailPage} />
      
      <Route path="/qa/new" component={GapSubmissionForm} />
      
      <Route path="/" component={
        user.role === "Admin" ? ManagementDashboard :
        user.role === "Management" ? ManagementDashboard :
        user.role === "POC" ? POCDashboard :
        user.role === "QA/Ops" ? QAOpsDashboard :
        ManagementDashboard
      } />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await authApi.getMe();
        setUser(response.user);
      } catch (error) {
        // Not logged in, that's okay
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogin = async (email: string, password: string) => {
    try {
      const response = await authApi.login(email, password);
      console.log("Login response:", response);
      setUser(response.user);
      
      const roleRoutes = {
        Admin: "/admin",
        Management: "/management",
        "QA/Ops": "/qa",
        POC: "/poc",
      };
      
      setLocation(roleRoutes[response.user.role as keyof typeof roleRoutes]);
      
      toast({
        title: "Logged in successfully",
        description: `Welcome back, ${response.user.name}!`,
      });
    } catch (error) {
      console.error("Login error:", error);
      toast({
        variant: "destructive",
        title: "Login failed",
        description: "Please check your email and password.",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center mb-4 mx-auto">
            <span className="text-primary-foreground font-bold text-sm">GO</span>
          </div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <LoginPage onLogin={handleLogin} />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={sidebarStyle as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar userRole={user.role as any} userName={user.name} />
            <div className="flex flex-col flex-1 overflow-hidden">
              <Header notificationCount={3} />
              <main className="flex-1 overflow-auto">
                <div className="container max-w-7xl mx-auto p-6">
                  <Router user={user} />
                </div>
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
