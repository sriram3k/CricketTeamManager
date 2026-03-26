import { useQuery } from "@tanstack/react-query";

export function useCricketData(teamId: number) {
  const { data: dashboardStats, isLoading: statsLoading } = useQuery({
    queryKey: [`/api/teams/${teamId}/dashboard-stats`],
    enabled: !!teamId,
  });

  const { data: recentMatches, isLoading: matchesLoading } = useQuery({
    queryKey: [`/api/teams/${teamId}/matches/recent`],
    enabled: !!teamId,
  });

  const { data: upcomingMatches, isLoading: upcomingLoading } = useQuery({
    queryKey: [`/api/teams/${teamId}/matches/upcoming`],
    enabled: !!teamId,
  });

  const { data: players, isLoading: playersLoading } = useQuery({
    queryKey: [`/api/teams/${teamId}/players/active`],
    enabled: !!teamId,
  });

  const isLoading = statsLoading || matchesLoading || upcomingLoading || playersLoading;

  return {
    dashboardStats,
    recentMatches,
    upcomingMatches,
    players,
    isLoading,
  };
}
