import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter } from "@/components/ui/sidebar";
import { LayoutDashboard, FileText, Settings, Users, BookOpen, BarChart3, PlusCircle, ListChecks, FormInput, LogOut, Clock, TrendingUp, AlertTriangle } from "lucide-react";
import { Link, useLocation } from "wouter";
import UserAvatar from "./UserAvatar";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import logoUrl from "@assets/IMG_3463-removebg-preview_1762619848377.png";

interface AppSidebarProps {
  userRole: "Admin" | "Management" | "QA/Ops" | "POC";
  userName: string;
}

const menuItems = {
  Admin: [
    { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
    { title: "All Gaps", url: "/admin/gaps", icon: FileText },
    { title: "Overdue Gaps", url: "/admin/overdue", icon: AlertTriangle },
    { title: "TAT Extensions", url: "/admin/tat-extensions", icon: Clock },
    { title: "POC Performance", url: "/admin/poc-performance", icon: TrendingUp },
    { title: "Users & Roles", url: "/admin/users", icon: Users },
    { title: "Form Builder", url: "/admin/form-builder", icon: FormInput },
    { title: "SOPs", url: "/admin/sops", icon: BookOpen },
    { title: "Reports", url: "/admin/reports", icon: BarChart3 },
    { title: "Settings", url: "/admin/settings", icon: Settings },
  ],
  Management: [
    { title: "Dashboard", url: "/management", icon: LayoutDashboard },
    { title: "All Gaps", url: "/management/gaps", icon: FileText },
    { title: "Overdue Gaps", url: "/management/overdue", icon: AlertTriangle },
    { title: "TAT Extensions", url: "/management/tat-extensions", icon: Clock },
    { title: "Form Builder", url: "/management/form-builder", icon: FormInput },
    { title: "SOPs", url: "/management/sops", icon: BookOpen },
    { title: "Reports", url: "/management/reports", icon: BarChart3 },
  ],
  "QA/Ops": [
    { title: "My Submissions", url: "/qa", icon: ListChecks },
    { title: "Submit Gap", url: "/qa/new", icon: PlusCircle },
    { title: "SOPs", url: "/sops", icon: BookOpen },
    { title: "Reports", url: "/qa/reports", icon: BarChart3 },
  ],
  POC: [
    { title: "Assigned Gaps", url: "/poc", icon: ListChecks },
    { title: "Overdue Gaps", url: "/poc/overdue", icon: AlertTriangle },
    { title: "SOPs", url: "/sops", icon: BookOpen },
    { title: "My Performance", url: "/poc/performance", icon: BarChart3 },
    { title: "Reports", url: "/poc/reports", icon: BarChart3 },
  ],
};

export default function AppSidebar({ userRole, userName }: AppSidebarProps) {
  const items = menuItems[userRole];
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      // Clear all React Query cache
      queryClient.clear();
      
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
      
      // Reload the page to trigger auth check and show login page
      window.location.href = "/";
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Logout Failed",
        description: "Failed to log out. Please try again.",
      });
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <Sidebar data-testid="sidebar-navigation">
      <SidebarHeader className="p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 flex items-center justify-center">
            <img 
              src={logoUrl} 
              alt="SolvExtra GO Logo" 
              className="h-8 w-8 object-contain"
            />
          </div>
          <span className="font-semibold text-lg">SolvExtra GO</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wide px-2">{userRole}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t space-y-3">
        <div className="flex items-center gap-3">
          <UserAvatar name={userName} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{userName}</p>
            <p className="text-xs text-muted-foreground">{userRole}</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          className="w-full" 
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4 mr-2" />
          {logoutMutation.isPending ? "Logging out..." : "Logout"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
