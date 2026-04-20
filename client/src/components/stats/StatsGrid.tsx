import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Users, Calendar } from "lucide-react";

interface StatsGridProps {
  stats?: {
    matchesWon: number;
    activePlayers: number;
    upcomingMatches: number;
    pendingPayments?: number;
  };
}

export default function StatsGrid({ stats }: StatsGridProps) {
  const statsData = [
    {
      title: "Victories",
      value: stats?.matchesWon || 0,
      icon: Trophy,
      bgColor: "bg-green-100 dark:bg-green-900/20",
      textColor: "text-green-600 dark:text-green-400",
    },
    {
      title: "Squad Members",
      value: stats?.activePlayers || 0,
      icon: Users,
      bgColor: "bg-blue-100 dark:bg-blue-900/20",
      textColor: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Fixtures",
      value: stats?.upcomingMatches || 0,
      icon: Calendar,
      bgColor: "bg-orange-100 dark:bg-orange-900/20",
      textColor: "text-orange-600 dark:text-orange-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
