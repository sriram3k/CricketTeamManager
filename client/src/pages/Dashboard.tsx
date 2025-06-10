import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import StatsGrid from "@/components/stats/StatsGrid";
import { useCricketData } from "@/hooks/use-cricket-data";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertMatchSchema } from "@shared/schema";
import {
  Trophy,
  Users,
  Calendar,
  DollarSign,
  Plus,
  Play,
  Check,
  Clock,
  X,
  Target,
  CreditCard,
  BarChart3,
  Bell,
  CheckCircle
} from "lucide-react";

const matchFormSchema = z.object({
  homeTeamId: z.number(),
  date: z.string().min(1, "Date is required"),
  venue: z.string().min(1, "Venue is required"),
  opponent: z.string().min(1, "Opponent team is required"),
  matchType: z.string(),
  totalOvers: z.number(),
  matchFee: z.string().min(1, "Match fee is required"),
  status: z.string().default("scheduled"),
});

export default function Dashboard() {
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [isQuickScoreDialogOpen, setIsQuickScoreDialogOpen] = useState(false);
  const teamId = 1; // This would come from user context
  const { dashboardStats, recentMatches, upcomingMatches, isLoading } = useCricketData(teamId);

  const { data: pendingPayments } = useQuery({
    queryKey: [`/api/teams/${teamId}/payments/pending`],
  });

  const { data: availabilityRequests } = useQuery({
    queryKey: [`/api/teams/${teamId}/availability-requests`],
  });

  const { data: allTeams } = useQuery({
    queryKey: ["/api/teams"],
  });

  const matchForm = useForm({
    resolver: zodResolver(matchFormSchema),
    defaultValues: {
      homeTeamId: teamId,
      date: "",
      venue: "",
      status: "scheduled",
      matchType: "T20",
      totalOvers: 20,
      matchFee: "",
      opponent: "",
    },
  });

  // Watch for match type changes and auto-update total overs
  const watchedMatchType = matchForm.watch("matchType");
  useEffect(() => {
    let overs = 20;
    if (watchedMatchType === "T20") overs = 20;
    else if (watchedMatchType === "T25") overs = 25;
    else if (watchedMatchType === "T30") overs = 30;
    else if (watchedMatchType === "ODI") overs = 50;
    else if (watchedMatchType === "Test") overs = 90;
    
    matchForm.setValue("totalOvers", overs);
  }, [watchedMatchType, matchForm]);

  const createMatchMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/matches", data),
    onSuccess: (result) => {
      console.log("Match created successfully:", result);
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/matches/upcoming`] });
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/matches/recent`] });
      setIsScheduleDialogOpen(false);
      matchForm.reset();
      alert("Match scheduled successfully!");
    },
    onError: (error: any) => {
      console.error("Match creation error:", error);
      const errorMessage = error?.response?.data?.message || error.message || 'Unknown error occurred';
      alert(`Error scheduling match: ${errorMessage}`);
    },
  });

  const onMatchSubmit = (data: any) => {
    console.log("Match form submission data:", data);
    console.log("Form errors:", matchForm.formState.errors);
    
    // Check for form validation errors
    if (Object.keys(matchForm.formState.errors).length > 0) {
      console.error("Form validation errors:", matchForm.formState.errors);
      alert("Please fix the form errors before submitting");
      return;
    }
    
    if (!data.opponent || data.opponent.trim() === "") {
      alert("Please enter opponent team name");
      return;
    }
    if (!data.date) {
      alert("Please select a match date");
      return;
    }
    if (!data.venue || data.venue.trim() === "") {
      alert("Please enter venue");
      return;
    }
    if (!data.matchFee || data.matchFee.trim() === "") {
      alert("Please enter match fee");
      return;
    }
    
    // Auto-set totalOvers based on match type
    let overs = data.totalOvers;
    if (data.matchType === "T20") overs = 20;
    else if (data.matchType === "T25") overs = 25;
    else if (data.matchType === "T30") overs = 30;
    else if (data.matchType === "ODI") overs = 50;
    else if (data.matchType === "Test") overs = 90;
    
    const matchData = {
      homeTeamId: teamId,
      awayTeamId: 2, // Default away team ID since we're using text input
      date: data.date, // Keep as string, schema will transform it
      venue: data.venue,
      status: "scheduled",
      matchType: data.matchType,
      totalOvers: overs,
      matchFee: data.matchFee,
      tossWinner: null,
      tossDecision: null,
      result: null,
      winnerTeamId: null,
    };
    
    console.log("Match data being sent:", matchData);
    createMatchMutation.mutate(matchData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div data-tour="dashboard" className="space-y-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex-1 min-w-0">
          <h2 className="text-3xl font-bold leading-7 text-foreground">
            Cricket Team Management
          </h2>
          <p className="mt-2 text-muted-foreground">
            Complete cricket management platform for Mumbai Warriors team
          </p>
        </div>
        
        {/* Quick Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <Card className="p-4 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-primary/50" onClick={() => setIsScheduleDialogOpen(true)}>
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Schedule Match</h3>
                <p className="text-xs text-muted-foreground">Plan new games</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-green-500/50">
            <div className="flex items-center space-x-3" onClick={() => setIsQuickScoreDialogOpen(true)}>
              <div className="p-3 bg-green-500/10 rounded-xl">
                <Target className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Live Scoring</h3>
                <p className="text-xs text-muted-foreground">Track matches</p>
              </div>
            </div>
          </Card>
          
          <Link href="/player-management">
            <Card className="p-4 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-blue-500/50">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-blue-500/10 rounded-xl">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Player Management</h3>
                  <p className="text-xs text-muted-foreground">Team roster</p>
                </div>
              </div>
            </Card>
          </Link>
          
          <Link href="/payments">
            <Card className="p-4 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-orange-500/50">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-orange-500/10 rounded-xl">
                  <DollarSign className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Payments</h3>
                  <p className="text-xs text-muted-foreground">Track finances</p>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      </div>
      
      <div className="hidden">
        <div className="mt-4 flex md:mt-0 md:ml-4 space-x-2">
          <Dialog open={isQuickScoreDialogOpen} onOpenChange={setIsQuickScoreDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-secondary text-secondary hover:bg-secondary hover:text-secondary-foreground">
                <Target className="h-4 w-4 mr-2" />
                Quick Score
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Quick Score Match</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Select a match to start scoring or continue live scoring
                </p>
                
                {/* Live Matches */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Live Matches</h4>
                  <div className="space-y-2">
                    {recentMatches?.filter((match: any) => match.status === 'live').length > 0 ? (
                      recentMatches?.filter((match: any) => match.status === 'live').map((match: any) => (
                        <Link key={match.id} href="/live-scoring">
                          <Button 
                            variant="outline" 
                            className="w-full justify-start bg-green-50 hover:bg-green-100 border-green-200"
                            onClick={() => setIsQuickScoreDialogOpen(false)}
                          >
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                              <span className="text-sm">Match {match.id} - {match.venue}</span>
                            </div>
                          </Button>
                        </Link>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">No live matches</p>
                    )}
                  </div>
                </div>

                {/* Upcoming Matches */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Upcoming Matches</h4>
                  <div className="space-y-2">
                    {upcomingMatches?.slice(0, 3).map((match: any) => (
                      <Link key={match.id} href="/live-scoring">
                        <Button 
                          variant="outline" 
                          className="w-full justify-start"
                          onClick={() => setIsQuickScoreDialogOpen(false)}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-sm">Match {match.id} - {match.venue}</span>
                            <Badge variant="outline" className="text-xs">
                              {new Date(match.date).toLocaleDateString()}
                            </Badge>
                          </div>
                        </Button>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="pt-2 border-t">
                  <div className="flex space-x-2">
                    <Link href="/live-scoring" className="flex-1">
                      <Button 
                        className="w-full" 
                        onClick={() => setIsQuickScoreDialogOpen(false)}
                      >
                        <Target className="h-4 w-4 mr-2" />
                        Live Scoring
                      </Button>
                    </Link>
                    <Button 
                      variant="outline" 
                      onClick={() => setIsQuickScoreDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
            <DialogTrigger asChild>
              <Button data-tour="schedule-match" className="bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                Schedule Match
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Schedule New Match</DialogTitle>
              </DialogHeader>
              <Form {...matchForm}>
                <form onSubmit={matchForm.handleSubmit(onMatchSubmit)} className="space-y-4">
                  <FormField
                    control={matchForm.control}
                    name="opponent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Opponent Team</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter opponent team name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={matchForm.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Match Date & Time</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={matchForm.control}
                    name="venue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Venue</FormLabel>
                        <FormControl>
                          <Input placeholder="Match venue" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={matchForm.control}
                    name="matchType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Match Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="T20">T20</SelectItem>
                            <SelectItem value="T25">T25</SelectItem>
                            <SelectItem value="T30">T30</SelectItem>
                            <SelectItem value="ODI">ODI</SelectItem>
                            <SelectItem value="Test">Test</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={matchForm.control}
                    name="totalOvers"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Overs</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1" 
                            max="50" 
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={matchForm.control}
                    name="matchFee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Match Fee</FormLabel>
                        <FormControl>
                          <Input placeholder="5000.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsScheduleDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createMatchMutation.isPending}
                      className="bg-primary hover:bg-primary/90"
                    >
                      {createMatchMutation.isPending ? "Scheduling..." : "Schedule Match"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Team Overview Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Matches Won</p>
              <p className="text-2xl font-bold text-green-600">{dashboardStats?.matchesWon || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">This season</p>
            </div>
            <Trophy className="h-8 w-8 text-green-600" />
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Players</p>
              <p className="text-2xl font-bold text-blue-600">{dashboardStats?.activePlayers || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Available for selection</p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Upcoming Matches</p>
              <p className="text-2xl font-bold text-orange-600">{dashboardStats?.upcomingMatches || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Scheduled games</p>
            </div>
            <Calendar className="h-8 w-8 text-orange-600" />
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pending Payments</p>
              <p className="text-2xl font-bold text-red-600">{dashboardStats?.pendingPayments || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Require attention</p>
            </div>
            <DollarSign className="h-8 w-8 text-red-600" />
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Matches */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Matches</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentMatches?.slice(0, 3).map((match) => (
                  <div key={match.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                          {match.status === 'live' ? (
                            <Play className="h-5 w-5 text-secondary-foreground" />
                          ) : match.status === 'completed' ? (
                            <Trophy className="h-5 w-5 text-secondary-foreground" />
                          ) : (
                            <Calendar className="h-5 w-5 text-secondary-foreground" />
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Team vs Opponent
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(match.date).toLocaleDateString()} • {match.status}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {match.status === 'completed' && (
                        <>
                          <p className="text-sm font-medium text-foreground">
                            {match.result || 'Result pending'}
                          </p>
                          <Badge variant={match.winnerTeamId === teamId ? "default" : "secondary"}>
                            {match.winnerTeamId === teamId ? 'Victory' : 'Defeat'}
                          </Badge>
                        </>
                      )}
                      {match.status === 'live' && (
                        <>
                          <p className="text-sm font-medium text-foreground">Live Score</p>
                          <Badge variant="destructive" className="bg-accent">
                            <span className="animate-pulse mr-1">●</span> Live
                          </Badge>
                        </>
                      )}
                      {match.status === 'scheduled' && (
                        <>
                          <p className="text-sm font-medium text-foreground">
                            {new Date(match.date).toLocaleTimeString()}
                          </p>
                          <Badge variant="outline">Scheduled</Badge>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Content */}
        <div className="space-y-6">
          {/* Player Availability */}
          <Card>
            <CardHeader>
              <CardTitle>Player Availability</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {availabilityRequests?.slice(0, 3).map((request) => (
                  <div key={request.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
                        <span className="text-secondary-foreground text-xs font-medium">P</span>
                      </div>
                      <span className="text-sm font-medium text-foreground">Player Name</span>
                    </div>
                    <Badge variant="default" className="bg-secondary">
                      <Check className="h-3 w-3 mr-1" />
                      Available
                    </Badge>
                  </div>
                ))}
                
                <Button variant="outline" className="w-full mt-4">
                  Send Availability Request
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Payment Status */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Pending Payments</span>
                  <span className="text-sm font-medium text-accent">
                    ₹{pendingPayments?.reduce((total: number, payment: any) => 
                      total + parseFloat(payment.amount), 0
                    ).toLocaleString() || '0'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Collected This Month</span>
                  <span className="text-sm font-medium text-secondary">₹45,000</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Outstanding Invoices</span>
                  <span className="text-sm font-medium text-destructive">3</span>
                </div>
              </div>
              
              <Button variant="outline" className="w-full mt-4">
                View All Payments
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Analytics Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Team Performance Analytics</CardTitle>
            <Button variant="ghost" className="text-primary">
              View Full Report
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-secondary">76%</div>
              <div className="text-sm text-muted-foreground">Win Rate</div>
              <div className="mt-2 text-xs text-muted-foreground">+5% from last month</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">8.4</div>
              <div className="text-sm text-muted-foreground">Avg Run Rate</div>
              <div className="mt-2 text-xs text-muted-foreground">+0.3 from last month</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">142</div>
              <div className="text-sm text-muted-foreground">Avg Score</div>
              <div className="mt-2 text-xs text-muted-foreground">+12 runs improvement</div>
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t border-border">
            <h4 className="text-md font-medium text-foreground mb-4">Key Insights</h4>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-2 h-2 bg-secondary rounded-full mt-2"></div>
                <p className="text-sm text-muted-foreground">
                  Your team performs 23% better when batting first
                </p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-2 h-2 bg-primary rounded-full mt-2"></div>
                <p className="text-sm text-muted-foreground">
                  Middle-order batting needs improvement - average of 6.2 runs per over
                </p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-2 h-2 bg-accent rounded-full mt-2"></div>
                <p className="text-sm text-muted-foreground">
                  Death bowling (16-20 overs) is your strongest suit with 7.1 economy rate
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
