import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
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
  { 
    name: "Dashboard", 
    description: "Team overview & quick actions",
    href: "/", 
    icon: BarChart3, 
    dataTour: "dashboard" 
  },
  { 
    name: "Live Scoring", 
    description: "Track match progress in real-time",
    href: "/live-scoring", 
    icon: Target, 
    dataTour: "live-scoring" 
  },
  { 
    name: "Player Management", 
    description: "Team roster & player details",
    href: "/player-management", 
    icon: Users, 
    dataTour: "players" 
  },
  { 
    name: "Availability", 
    description: "Player availability for matches",
    href: "/availability", 
    icon: CalendarCheck, 
    dataTour: "availability" 
  },
  { 
    name: "Payments", 
    description: "Match fees & player payments",
    href: "/payments", 
    icon: CreditCard, 
    dataTour: "payments" 
  },
  { 
    name: "Invoices", 
    description: "Corporate billing & invoices",
    href: "/invoices", 
    icon: FileText, 
    dataTour: "invoices" 
  },
  { 
    name: "Analytics", 
    description: "Performance insights & statistics",
    href: "/analytics", 
    icon: TrendingUp, 
    dataTour: "analytics" 
  },
];

export default function Sidebar() {
  const [location] = useLocation();
  const teamId = 1;

  const { data: team } = useQuery({
    queryKey: [`/api/teams/${teamId}`],
    queryFn: () => fetch(`/api/teams/${teamId}`).then(res => res.json()),
  });

  return (
    <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-card shadow-lg border-r border-border">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Logo */}
        <div className="flex items-center h-16 flex-shrink-0 px-4 bg-primary">
          <Trophy className="text-primary-foreground text-2xl mr-3" />
          <h1 className="text-primary-foreground text-xl font-bold">CrickIQ</h1>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-2">
          {navigation.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            
            return (
              <Link key={item.name} href={item.href}>
                <div
                  data-tour={item.dataTour}
                  className={cn(
                    "group flex flex-col p-3 rounded-lg transition-all duration-200 cursor-pointer",
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-md" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={cn("h-5 w-5 flex-shrink-0", isActive ? "text-primary-foreground" : "")} />
                    <span className="font-medium">{item.name}</span>
                  </div>
                  <p className={cn(
                    "text-xs mt-1 ml-8 leading-relaxed",
                    isActive ? "text-primary-foreground/80" : "text-muted-foreground/70"
                  )}>
                    {item.description}
                  </p>
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
              <p className="text-xs text-muted-foreground">{team?.name || 'Loading...'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
