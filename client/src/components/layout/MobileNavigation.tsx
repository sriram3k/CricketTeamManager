import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  PlayCircle,
  Users,
  CreditCard,
  TrendingUp
} from "lucide-react";

const mobileNavigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Scoring", href: "/live-scoring", icon: PlayCircle },
  { name: "Players", href: "/players", icon: Users },
  { name: "Payments", href: "/payments", icon: CreditCard },
  { name: "Analytics", href: "/analytics", icon: TrendingUp },
];

export default function MobileNavigation() {
  const [location] = useLocation();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border lg:hidden z-50">
      <div className="grid grid-cols-5 py-2">
        {mobileNavigation.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          
          return (
            <Link key={item.name} href={item.href}>
              <a
                className={cn(
                  "flex flex-col items-center py-2 px-1 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs mt-1">{item.name}</span>
              </a>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
