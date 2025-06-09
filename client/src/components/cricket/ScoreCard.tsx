import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ScoreCardProps {
  match: any;
  innings?: any[];
}

export default function ScoreCard({ match, innings = [] }: ScoreCardProps) {
  const currentInnings = innings.find(inning => !inning.isCompleted);
  const completedInnings = innings.filter(inning => inning.isCompleted);

  const formatOvers = (totalOvers: number) => {
    const overs = Math.floor(totalOvers);
    const balls = Math.round((totalOvers - overs) * 6);
    return `${overs}.${balls}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Scorecard</span>
          <Badge variant={match.status === 'live' ? 'destructive' : 'outline'}>
            {match.status === 'live' && <span className="animate-pulse mr-1">●</span>}
            {match.status.toUpperCase()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current/Live Innings */}
        {currentInnings && (
          <div className="p-4 bg-accent/10 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-foreground">
                Current Innings - Team {currentInnings.battingTeamId}
              </h3>
              <Badge variant="destructive" className="bg-accent">
                <span className="animate-pulse mr-1">●</span> Live
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {currentInnings.totalRuns}/{currentInnings.totalWickets}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatOvers(parseFloat(currentInnings.totalOvers))} overs
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Run Rate</p>
                <p className="text-lg font-medium text-foreground">
                  {currentInnings.totalOvers > 0 
                    ? (currentInnings.totalRuns / parseFloat(currentInnings.totalOvers)).toFixed(2)
                    : '0.00'
                  }
                </p>
              </div>
            </div>
            
            {/* Extras */}
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">
                Extras: {Object.values(currentInnings.extras || {}).reduce((a: number, b: number) => a + b, 0)}
                {currentInnings.extras && (
                  <span className="ml-2">
                    (w: {currentInnings.extras.wides || 0}, 
                     nb: {currentInnings.extras.noballs || 0}, 
                     b: {currentInnings.extras.byes || 0}, 
                     lb: {currentInnings.extras.legbyes || 0})
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Completed Innings */}
        {completedInnings.map((inning, index) => (
          <div key={inning.id} className="p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-foreground">
                Innings {inning.inningsNumber} - Team {inning.battingTeamId}
              </h3>
              <Badge variant="outline">Completed</Badge>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {inning.totalRuns}
                  {inning.totalWickets < 10 ? `/${inning.totalWickets}` : ''}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatOvers(parseFloat(inning.totalOvers))} overs
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Run Rate</p>
                <p className="text-lg font-medium text-foreground">
                  {inning.totalOvers > 0 
                    ? (inning.totalRuns / parseFloat(inning.totalOvers)).toFixed(2)
                    : '0.00'
                  }
                </p>
              </div>
            </div>
          </div>
        ))}

        {/* Match Summary */}
        {match.status === 'completed' && match.result && (
          <>
            <Separator />
            <div className="text-center p-4 bg-secondary/10 rounded-lg">
              <h3 className="font-bold text-lg text-foreground mb-2">Match Result</h3>
              <p className="text-foreground">{match.result}</p>
              {match.winnerTeamId && (
                <Badge className="mt-2 bg-secondary">
                  Team {match.winnerTeamId} Won
                </Badge>
              )}
            </div>
          </>
        )}

        {/* Empty State */}
        {innings.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No innings data available</p>
            <p className="text-sm text-muted-foreground mt-1">
              Start the match to begin scoring
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
