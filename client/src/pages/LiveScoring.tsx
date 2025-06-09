import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import ScoreCard from "@/components/cricket/ScoreCard";
import BallByBallEntry from "@/components/cricket/BallByBallEntry";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Play, Pause, Square } from "lucide-react";

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Live Scoring</h1>
          <p className="text-muted-foreground">Score cricket matches in real-time</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <Select onValueChange={(value) => setSelectedMatch(parseInt(value))}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a match" />
            </SelectTrigger>
            <SelectContent>
              {liveMatches?.map((match: any) => (
                <SelectItem key={match.id} value={match.id.toString()}>
                  Match {match.id} - {match.venue}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {selectedMatch && (
            <div className="flex space-x-2">
              <Button 
                onClick={startMatch}
                disabled={match?.status === 'live'}
                className="bg-secondary hover:bg-secondary/90"
              >
                <Play className="h-4 w-4 mr-2" />
                Start
              </Button>
              <Button 
                onClick={endMatch}
                variant="destructive"
                disabled={match?.status === 'completed'}
              >
                <Square className="h-4 w-4 mr-2" />
                End Match
              </Button>
            </div>
          )}
        </div>
      </div>

      {!selectedMatch && (
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <Play className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground">No Match Selected</h3>
              <p className="text-muted-foreground">Select a match from the dropdown to start scoring</p>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedMatch && match && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Score Card */}
          <div className="space-y-6">
            <ScoreCard match={match} innings={innings} />
            
            {/* Match Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Match Status
                  <Badge 
                    variant={match.status === 'live' ? 'destructive' : 'outline'}
                    className={match.status === 'live' ? 'bg-accent' : ''}
                  >
                    {match.status === 'live' && <span className="animate-pulse mr-1">●</span>}
                    {match.status.toUpperCase()}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Venue:</span>
                    <span className="font-medium">{match.venue}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date:</span>
                    <span className="font-medium">
                      {new Date(match.date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Match Type:</span>
                    <span className="font-medium">{match.matchType}</span>
                  </div>
                  {match.tossWinner && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Toss:</span>
                      <span className="font-medium">
                        Team {match.tossWinner} won, chose to {match.tossDecision}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Ball by Ball Entry */}
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
                    <Pause className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground">No Active Innings</h3>
                    <p className="text-muted-foreground">Start an innings to begin ball-by-ball scoring</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Innings Selection */}
            {innings && innings.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Select Innings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {innings.map((inning: any) => (
                      <Button
                        key={inning.id}
                        variant={currentInnings === inning.id ? "default" : "outline"}
                        onClick={() => setCurrentInnings(inning.id)}
                        className="justify-start"
                      >
                        Innings {inning.inningsNumber}
                        <Badge variant="secondary" className="ml-2">
                          {inning.totalRuns}/{inning.totalWickets}
                        </Badge>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
