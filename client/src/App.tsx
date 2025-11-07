import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
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
import NotFound from "@/pages/not-found";
import type { User } from "@shared/schema";
import { authApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

function Router({ user }: { user: User }) {
  const roleRoutes = {
    Admin: "/admin",
    Management: "/management",
    "QA/Ops": "/qa",
    POC: "/poc",
  };

  return (
    <Switch>
      <Route path={roleRoutes[user.role as keyof typeof roleRoutes]} component={
        user.role === "Management" ? ManagementDashboard :
        user.role === "POC" ? POCDashboard :
        user.role === "QA/Ops" ? QAOpsDashboard :
        ManagementDashboard
      } />
      
      <Route path="/management/gaps/:id" component={GapDetailPage} />
      <Route path="/poc/gaps/:id" component={GapDetailPage} />
      <Route path="/qa/gaps/:id" component={GapDetailPage} />
      
      <Route path="/qa/new" component={GapSubmissionForm} />
      
      <Route path="/management/forms" component={FormBuilder} />
      
      <Route path="/" component={
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
  const [user, setUser] = useState<User | null>(null);
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
