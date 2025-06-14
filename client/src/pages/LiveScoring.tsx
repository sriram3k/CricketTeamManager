import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import ScoreCard from "@/components/cricket/ScoreCard";
import BallByBallEntry from "@/components/cricket/BallByBallEntry";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Play, Pause, Square, Plus, Target, Clock, Users, Trophy } from "lucide-react";

export default function LiveScoring() {
  const [selectedMatch, setSelectedMatch] = useState<number | null>(null);
  const [currentInnings, setCurrentInnings] = useState<number | null>(null);

  const { data: liveMatches } = useQuery({
    queryKey: ["/api/matches/live"],
  });

  const { data: match } = useQuery({
    queryKey: [`/api/matches/${selectedMatch}`],
    enabled: !!selectedMatch,
  });

  const { data: innings } = useQuery({
    queryKey: [`/api/matches/${selectedMatch}/innings`],
    enabled: !!selectedMatch,
  });

  const { data: balls } = useQuery({
    queryKey: [`/api/innings/${currentInnings}/balls`],
    enabled: !!currentInnings,
  });

  const updateMatchMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/matches/${selectedMatch}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/matches/${selectedMatch}`] });
    },
  });

  const startMatch = () => {
    if (selectedMatch) {
      updateMatchMutation.mutate({ status: "live" });
    }
  };

  const endMatch = () => {
    if (selectedMatch) {
      updateMatchMutation.mutate({ status: "completed" });
    }
  };

  // Helper function to get current innings stats
  const getCurrentInningsData = () => {
    if (!innings || innings.length === 0) return null;
    const current = innings.find(inning => !inning.isCompleted) || innings[innings.length - 1];
    return current;
  };

  const currentInningsData = getCurrentInningsData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Target className="h-6 w-6 text-green-600" />
                <h1 className="text-xl font-bold text-foreground">Live Scoring</h1>
              </div>
              {match?.status === 'live' && (
                <Badge variant="destructive" className="bg-red-500 animate-pulse">
                  <span className="animate-pulse mr-1">●</span> LIVE
                </Badge>
              )}
            </div>
            
            <div className="flex items-center space-x-3">
              <Select onValueChange={(value) => setSelectedMatch(parseInt(value))}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select Match" />
                </SelectTrigger>
                <SelectContent>
                  {liveMatches?.map((match: any) => (
                    <SelectItem key={match.id} value={match.id.toString()}>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs">{match.matchType}</Badge>
                        <span>{match.venue}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedMatch && (
                <div className="flex space-x-2">
                  <Button 
                    onClick={startMatch}
                    disabled={match?.status === 'live'}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Start
                  </Button>
                  <Button 
                    onClick={endMatch}
                    variant="destructive"
                    size="sm"
                    disabled={match?.status === 'completed'}
                  >
                    <Square className="h-4 w-4 mr-1" />
                    End
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {!selectedMatch ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center p-8">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-6">
              <Target className="h-10 w-10 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-2">Ready to Score</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              Select a match from the dropdown above to start live cricket scoring
            </p>
            <Button onClick={() => {}} variant="outline">
              <Clock className="h-4 w-4 mr-2" />
              View Scheduled Matches
            </Button>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto p-4 space-y-6">
          {/* Match Header Card */}
          <Card className="bg-gradient-to-r from-blue-600 to-green-600 text-white border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold">{match?.matchType} Match</h2>
                  <p className="text-blue-100">{match?.venue} • {new Date(match?.date).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <Badge className="bg-white/20 text-white border-white/30">
                    {match?.totalOvers} Overs
                  </Badge>
                </div>
              </div>
              
              {/* Teams */}
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Users className="h-8 w-8" />
                  </div>
                  <h3 className="font-semibold">Home Team</h3>
                  <p className="text-blue-100 text-sm">Team 1</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Users className="h-8 w-8" />
                  </div>
                  <h3 className="font-semibold">{match?.opponentName}</h3>
                  <p className="text-blue-100 text-sm">Opponent</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Scoring Interface */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Left: Current Score Display */}
            <div className="xl:col-span-2 space-y-6">
              {/* Live Score Card */}
              {currentInningsData && (
                <Card className="bg-white dark:bg-slate-900 shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-3">
                        <Badge variant="outline">Innings {currentInningsData.inningsNumber}</Badge>
                        <span className="text-sm text-muted-foreground">
                          Batting: Team {currentInningsData.battingTeamId}
                        </span>
                      </div>
                      {match?.status === 'live' && (
                        <Badge variant="destructive" className="bg-red-500">
                          <span className="animate-pulse mr-1">●</span> LIVE
                        </Badge>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-8 mb-6">
                      {/* Score */}
                      <div className="text-center">
                        <div className="text-6xl font-bold text-foreground mb-2">
                          {currentInningsData.totalRuns}
                          <span className="text-3xl text-muted-foreground">
                            /{currentInningsData.totalWickets}
                          </span>
                        </div>
                        <p className="text-muted-foreground">
                          {parseFloat(currentInningsData.totalOvers).toFixed(1)} overs
                        </p>
                      </div>
                      
                      {/* Run Rate */}
                      <div className="text-center">
                        <div className="text-3xl font-bold text-green-600 mb-2">
                          {currentInningsData.totalOvers > 0 
                            ? (currentInningsData.totalRuns / parseFloat(currentInningsData.totalOvers)).toFixed(2)
                            : '0.00'
                          }
                        </div>
                        <p className="text-muted-foreground">Run Rate</p>
                      </div>
                    </div>

                    {/* Recent Balls */}
                    <div className="border-t pt-4">
                      <p className="text-sm font-medium text-muted-foreground mb-3">Last 6 Balls</p>
                      <div className="flex space-x-2">
                        {(balls || []).slice(-6).map((ball: any, index) => (
                          <div
                            key={ball.id || index}
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                              ball.isWicket 
                                ? 'bg-red-100 border-red-300 text-red-700' 
                                : ball.runs === 4 
                                ? 'bg-blue-100 border-blue-300 text-blue-700'
                                : ball.runs === 6
                                ? 'bg-green-100 border-green-300 text-green-700'
                                : 'bg-gray-100 border-gray-300 text-gray-700'
                            }`}
                          >
                            {ball.isWicket ? 'W' : ball.runs}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Innings Selection */}
              {innings && innings.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="h-5 w-5" />
                      Match Innings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {innings.map((inning: any) => (
                        <Button
                          key={inning.id}
                          variant={currentInnings === inning.id ? "default" : "outline"}
                          onClick={() => setCurrentInnings(inning.id)}
                          className="h-16 justify-start p-4"
                        >
                          <div className="text-left">
                            <div className="font-semibold">Innings {inning.inningsNumber}</div>
                            <div className="text-sm opacity-75">
                              {inning.totalRuns}/{inning.totalWickets} ({parseFloat(inning.totalOvers).toFixed(1)} ov)
                            </div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right: Ball Entry */}
            <div className="space-y-6">
              {currentInnings ? (
                <BallByBallEntry
                  inningsId={currentInnings}
                  balls={balls || []}
                  onBallAdded={() => {
                    queryClient.invalidateQueries({ queryKey: [`/api/innings/${currentInnings}/balls`] });
                    queryClient.invalidateQueries({ queryKey: [`/api/matches/${selectedMatch}/innings`] });
                  }}
                />
              ) : (
                <Card>
                  <CardContent className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Plus className="h-8 w-8 text-blue-600" />
                      </div>
                      <h3 className="text-lg font-medium text-foreground mb-2">Ready to Score</h3>
                      <p className="text-muted-foreground mb-4">Select an innings to start ball-by-ball scoring</p>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Create Innings
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Create New Innings</DialogTitle>
                          </DialogHeader>
                          <div className="text-center py-4">
                            <p className="text-muted-foreground">Innings creation form would go here</p>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
