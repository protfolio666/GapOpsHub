import { useState } from "react";
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

type UserRole = "Admin" | "Management" | "QA/Ops" | "POC";

interface User {
  email: string;
  name: string;
  role: UserRole;
}

function Router({ user }: { user: User }) {
  const roleRoutes = {
    Admin: "/admin",
    Management: "/management",
    "QA/Ops": "/qa",
    POC: "/poc",
  };

  return (
    <Switch>
      <Route path={roleRoutes[user.role]} component={
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
  const [, setLocation] = useLocation();

  const handleLogin = (email: string, role: string) => {
    const name = email.split("@")[0].split(".").map(n => 
      n.charAt(0).toUpperCase() + n.slice(1)
    ).join(" ");
    
    const userRole = role as UserRole;
    setUser({ email, name, role: userRole });
    
    const roleRoutes = {
      Admin: "/admin",
      Management: "/management",
      "QA/Ops": "/qa",
      POC: "/poc",
    };
    
    setLocation(roleRoutes[userRole]);
  };

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
            <AppSidebar userRole={user.role} userName={user.name} />
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
