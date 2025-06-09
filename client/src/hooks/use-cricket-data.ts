import { useQuery } from "@tanstack/react-query";

export function useCricketData(teamId: number) {
  const { data: dashboardStats, isLoading: statsLoading } = useQuery({
    queryKey: [`/api/teams/${teamId}/dashboard-stats`],
  });

  const { data: recentMatches, isLoading: matchesLoading } = useQuery({
    queryKey: [`/api/teams/${teamId}/matches/recent`],
  });

  const { data: upcomingMatches, isLoading: upcomingLoading } = useQuery({
    queryKey: [`/api/teams/${teamId}/matches/upcoming`],
  });

  const { data: players, isLoading: playersLoading } = useQuery({
    queryKey: [`/api/teams/${teamId}/players/active`],
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
