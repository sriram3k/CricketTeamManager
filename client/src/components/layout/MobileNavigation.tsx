import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Target,
  Users,
  CreditCard,
  TrendingUp
} from "lucide-react";

const mobileNavigation = [
  { name: "Overview", href: "/", icon: BarChart3 },
  { name: "Live", href: "/live-scoring", icon: Target },
  { name: "Squad", href: "/players", icon: Users },
  { name: "Fees", href: "/payments", icon: CreditCard },
  { name: "Stats", href: "/analytics", icon: TrendingUp },
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
              <div
                className={cn(
                  "flex flex-col items-center py-2 px-1 transition-colors cursor-pointer",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs mt-1">{item.name}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
