import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Trophy,
  Target,
  Users,
  CalendarCheck,
  CreditCard,
  FileText,
  TrendingUp,
  BarChart3,
  Zap
} from "lucide-react";

const navigation = [
  { name: "Team Overview", href: "/", icon: BarChart3, dataTour: "dashboard" },
  { name: "Live Match", href: "/live-scoring", icon: Target, dataTour: "live-scoring" },
  { name: "Squad", href: "/players", icon: Users, dataTour: "players" },
  { name: "Player Availability", href: "/availability", icon: CalendarCheck, dataTour: "availability" },
  { name: "Match Fees", href: "/payments", icon: CreditCard, dataTour: "payments" },
  { name: "Club Invoices", href: "/invoices", icon: FileText, dataTour: "invoices" },
  { name: "Performance Stats", href: "/analytics", icon: TrendingUp, dataTour: "analytics" },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-card shadow-lg border-r border-border">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Logo */}
        <div className="flex items-center h-16 flex-shrink-0 px-4 bg-primary">
          <Trophy className="text-primary-foreground text-2xl mr-3" />
          <h1 className="text-primary-foreground text-xl font-bold">CricManager</h1>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            
            return (
              <Link key={item.name} href={item.href}>
                <div
                  data-tour={item.dataTour}
                  className={cn(
                    "sidebar-link cursor-pointer",
                    isActive ? "sidebar-link-active" : "sidebar-link-inactive"
                  )}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </div>
              </Link>
            );
          })}
        </nav>
        
        {/* User Profile */}
        <div className="flex-shrink-0 flex border-t border-border p-4">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <Users className="text-primary-foreground text-sm" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-foreground">Team Manager</p>
              <p className="text-xs text-muted-foreground">Mumbai Warriors</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
