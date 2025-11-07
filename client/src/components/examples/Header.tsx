import Header from "../Header";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function HeaderExample() {
  return (
    <SidebarProvider>
      <div className="w-full">
        <Header notificationCount={5} />
      </div>
    </SidebarProvider>
  );
}
