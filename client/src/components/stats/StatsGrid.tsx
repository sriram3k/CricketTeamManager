import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Users, Calendar, DollarSign } from "lucide-react";

interface StatsGridProps {
  stats?: {
    matchesWon: number;
    activePlayers: number;
    upcomingMatches: number;
    pendingPayments: number;
  };
}

export default function StatsGrid({ stats }: StatsGridProps) {
  const statsData = [
    {
      title: "Matches Won",
      value: stats?.matchesWon || 0,
      icon: Trophy,
      bgColor: "bg-secondary",
      textColor: "text-secondary-foreground",
    },
    {
      title: "Active Players",
      value: stats?.activePlayers || 0,
      icon: Users,
      bgColor: "bg-accent",
      textColor: "text-accent-foreground",
    },
    {
      title: "Upcoming Matches",
      value: stats?.upcomingMatches || 0,
      icon: Calendar,
      bgColor: "bg-primary",
      textColor: "text-primary-foreground",
    },
    {
      title: "Pending Payments",
      value: stats?.pendingPayments ? `₹${stats.pendingPayments.toLocaleString()}` : "₹0",
      icon: DollarSign,
      bgColor: "bg-accent",
      textColor: "text-accent-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statsData.map((stat) => {
        const IconComponent = stat.icon;
        
        return (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className={`flex-shrink-0 w-8 h-8 ${stat.bgColor} rounded-full flex items-center justify-center`}>
                  <IconComponent className={`h-4 w-4 ${stat.textColor}`} />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-muted-foreground truncate">
                      {stat.title}
                    </dt>
                    <dd className="text-lg font-medium text-foreground">
                      {stat.value}
                    </dd>
                  </dl>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
