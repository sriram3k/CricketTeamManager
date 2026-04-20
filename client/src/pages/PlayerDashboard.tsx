import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  User,
  Trophy,
  TrendingUp,
  Target,
  Activity
} from "lucide-react";

export default function PlayerDashboard() {
  const { toast } = useToast();
  
  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  const teamId = (user as any)?.teamId || 0;

  // Find current player record by email
  const { data: playerData } = useQuery({
    queryKey: [`/api/teams/${teamId}/players/active`],
    enabled: !!teamId,
  });

  const currentPlayer = (playerData as any[])?.find((p: any) => p.email === (user as any)?.email);

  const { data: matchData = [] } = useQuery({
    queryKey: [`/api/matches/team/${teamId}`],
    enabled: !!teamId,
  });

  const matches = matchData as any[];

  const { data: availabilityRequests = [] } = useQuery({
    queryKey: [`/api/teams/${teamId}/availability-requests`],
    enabled: !!teamId,
  });

  const { data: playerStats = [] } = useQuery({
    queryKey: [`/api/players/${currentPlayer?.id}/stats`],
    enabled: !!currentPlayer?.id,
  });

  const respondToAvailabilityMutation = useMutation({
    mutationFn: async ({ requestId, response }: { requestId: number; response: string }) => {
      if (!currentPlayer) {
        throw new Error('Player not found');
      }
      return apiRequest("POST", "/api/availability-responses", {
        requestId,
        playerId: currentPlayer.id,
        status: response
      });
    },
    onSuccess: () => {
      toast({
        title: "Response submitted",
        description: "Your availability response has been recorded.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/availability-requests`] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit availability response.",
        variant: "destructive",
      });
    },
  });

  // Aggregate career stats from all match stats
  const careerStats = (playerStats as any[]).reduce(
    (acc, s) => ({
      matches: acc.matches + 1,
      runs: acc.runs + (s.runsScored || 0),
      ballsFaced: acc.ballsFaced + (s.ballsFaced || 0),
      fours: acc.fours + (s.fours || 0),
      sixes: acc.sixes + (s.sixes || 0),
      wickets: acc.wickets + (s.wicketsTaken || 0),
      ballsBowled: acc.ballsBowled + (s.ballsBowled || 0),
      runsConceded: acc.runsConceded + (s.runsConceded || 0),
      catches: acc.catches + (s.catches || 0),
    }),
    { matches: 0, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, wickets: 0, ballsBowled: 0, runsConceded: 0, catches: 0 }
  );
  const battingAvg = careerStats.matches > 0 ? (careerStats.runs / careerStats.matches).toFixed(1) : '0.0';
  const strikeRate = careerStats.ballsFaced > 0 ? ((careerStats.runs / careerStats.ballsFaced) * 100).toFixed(1) : '0.0';
  const bowlingAvg = careerStats.wickets > 0 ? (careerStats.runsConceded / careerStats.wickets).toFixed(1) : '-';
  const economy = careerStats.ballsBowled > 0 ? ((careerStats.runsConceded / careerStats.ballsBowled) * 6).toFixed(1) : '-';

  // Filter for upcoming matches
  const upcomingMatches = matches.filter((match: any) => 
    new Date(match.date) > new Date() && match.status === "scheduled"
  ).slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-600 rounded-lg">
              <User className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Player Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Welcome back, {user?.firstName || user?.username}!
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming Matches</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{upcomingMatches.length}</div>
              <p className="text-xs text-muted-foreground">
                Next match: {upcomingMatches[0] ? new Date(upcomingMatches[0].date).toLocaleDateString() : 'None scheduled'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Availability Requests</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{availabilityRequests.length}</div>
              <p className="text-xs text-muted-foreground">
                Pending responses
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Availability Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Availability Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            {availabilityRequests.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No availability requests at the moment</p>
            ) : (
              <div className="space-y-4">
                {availabilityRequests.map((request: any) => (
                  <div key={request.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-semibold">vs {request.opponent || 'Match'}</h4>
                        <p className="text-sm text-gray-600">
                          {request.matchDate ? new Date(request.matchDate).toLocaleDateString() : 'TBD'} at {request.venue || 'TBD'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Deadline: {new Date(request.deadline).toLocaleDateString()} at {new Date(request.deadline).toLocaleTimeString()}
                        </p>
                        {request.message && (
                          <p className="text-sm text-gray-700 mt-2 p-2 bg-gray-50 rounded">{request.message}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <Badge variant={new Date(request.deadline) < new Date() ? "secondary" : "default"}>
                          {new Date(request.deadline) < new Date() ? "Expired" : "Active"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Select
                        onValueChange={(value) =>
                          respondToAvailabilityMutation.mutate({
                            requestId: request.id,
                            response: value
                          })
                        }
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Your response" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">Available</SelectItem>
                          <SelectItem value="unavailable">Unavailable</SelectItem>
                          <SelectItem value="maybe">Maybe</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Matches */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Upcoming Matches
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingMatches.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No upcoming matches scheduled</p>
            ) : (
              <div className="space-y-4">
                {upcomingMatches.map((match: any) => (
                  <div key={match.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold">
                          vs {match.opponent}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {match.venue}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(match.date).toLocaleDateString()} at {new Date(match.date).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">{match.matchType}</Badge>
                        <p className="text-sm text-gray-500 mt-1">
                          {match.totalOvers} overs
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Stats */}
        {careerStats.matches > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                My Performance Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {/* Batting */}
                <div className="text-center">
                  <div className="flex justify-center mb-2">
                    <Activity className="h-6 w-6 text-green-600" />
                  </div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Batting</p>
                  <p className="text-2xl font-bold">{careerStats.runs}</p>
                  <p className="text-xs text-gray-500">Total Runs</p>
                </div>
                <div className="text-center">
                  <div className="flex justify-center mb-2">
                    <Target className="h-6 w-6 text-blue-600" />
                  </div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Avg / SR</p>
                  <p className="text-2xl font-bold">{battingAvg}</p>
                  <p className="text-xs text-gray-500">SR: {strikeRate}</p>
                </div>
                {/* Bowling */}
                <div className="text-center">
                  <div className="flex justify-center mb-2">
                    <Trophy className="h-6 w-6 text-yellow-600" />
                  </div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Bowling</p>
                  <p className="text-2xl font-bold">{careerStats.wickets}</p>
                  <p className="text-xs text-gray-500">Wickets</p>
                </div>
                <div className="text-center">
                  <div className="flex justify-center mb-2">
                    <CheckCircle className="h-6 w-6 text-purple-600" />
                  </div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Economy / Avg</p>
                  <p className="text-2xl font-bold">{economy}</p>
                  <p className="text-xs text-gray-500">Avg: {bowlingAvg}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t flex justify-around text-center">
                <div>
                  <p className="text-lg font-bold">{careerStats.matches}</p>
                  <p className="text-xs text-gray-500">Matches</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{careerStats.fours}</p>
                  <p className="text-xs text-gray-500">Fours</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{careerStats.sixes}</p>
                  <p className="text-xs text-gray-500">Sixes</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{careerStats.catches}</p>
                  <p className="text-xs text-gray-500">Catches</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}