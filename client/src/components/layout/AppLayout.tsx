import Sidebar from "./Sidebar";
import MobileNavigation from "./MobileNavigation";
import TopBar from "./TopBar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <div className="flex flex-col flex-1 lg:pl-64">
        <TopBar />
        
        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:pb-6">
          {children}
        </main>
      </div>
      
      <MobileNavigation />
    </div>
  );
}
