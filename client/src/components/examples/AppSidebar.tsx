import AppSidebar from "../AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function AppSidebarExample() {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar userRole="Management" userName="Jane Smith" />
        <main className="flex-1 p-6">
          <h1 className="text-2xl font-semibold">Main Content Area</h1>
        </main>
      </div>
    </SidebarProvider>
  );
}
