import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  User,
  Trophy
} from "lucide-react";

export default function PlayerDashboard() {
  const { toast } = useToast();
  
  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  const { data: allMatches = [] } = useQuery({
    queryKey: ["/api/matches"],
  });

  // Filter matches for the current player's team
  const matches = allMatches.filter((match: any) => 
    currentPlayer?.teamId && (match.homeTeamId === currentPlayer.teamId || match.awayTeamId === currentPlayer.teamId)
  );

  const { data: playerData } = useQuery({
    queryKey: ["/api/players"],
    enabled: !!user?.email,
  });

  const currentPlayer = playerData?.find((p: any) => p.email === user?.email);

  const { data: payments = [] } = useQuery({
    queryKey: [`/api/players/${currentPlayer?.id}/payments`],
    enabled: !!currentPlayer?.id,
  });

  const { data: availabilityRequests = [] } = useQuery({
    queryKey: ["/api/availability"],
  });

  const respondToAvailabilityMutation = useMutation({
    mutationFn: async ({ requestId, response }: { requestId: number; response: string }) => {
      if (!currentPlayer) {
        throw new Error('Player not found');
      }
      
      return apiRequest("/api/availability-responses", "POST", { 
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
      queryClient.invalidateQueries({ queryKey: ["/api/availability"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit availability response.",
        variant: "destructive",
      });
    },
  });

  const markPaymentPaidMutation = useMutation({
    mutationFn: (paymentId: number) => 
      apiRequest("PUT", `/api/payments/${paymentId}`, { 
        status: "paid",
        paidDate: new Date().toISOString()
      }),
    onSuccess: () => {
      toast({
        title: "Payment recorded",
        description: "Payment has been marked as paid.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/players/${currentPlayer?.id}/payments`] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update payment status.",
        variant: "destructive",
      });
    },
  });

  // Filter for player's outstanding payments
  const outstandingPayments = payments.filter((payment: any) => 
    payment.status === "pending" || payment.status === "overdue"
  );

  // Filter for upcoming matches
  const upcomingMatches = matches.filter((match: any) => 
    new Date(match.date) > new Date() && match.status === "scheduled"
  ).slice(0, 5);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      paid: "default",
      overdue: "destructive",
      partial: "secondary",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
              <CardTitle className="text-sm font-medium">Outstanding Payments</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{outstandingPayments.length}</div>
              <p className="text-xs text-muted-foreground">
                Total: ${outstandingPayments.reduce((sum: number, p: any) => sum + parseFloat(p.amount || '0'), 0).toFixed(2)}
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                          <h4 className="font-semibold">{request.title}</h4>
                          <p className="text-sm text-gray-600">{request.description}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Deadline: {new Date(request.deadline).toLocaleDateString()}
                          </p>
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

          {/* Outstanding Payments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Outstanding Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {outstandingPayments.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-gray-500">All payments are up to date!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {outstandingPayments.map((payment: any) => (
                    <div key={payment.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold">{payment.purpose || 'Match Fee'}</h4>
                          <p className="text-sm text-gray-600">
                            Match on {new Date(payment.match?.date || '').toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Due: {new Date(payment.dueDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">${payment.amount}</p>
                          {getStatusBadge(payment.status)}
                          <Button 
                            size="sm" 
                            className="mt-2"
                            onClick={() => markPaymentPaidMutation.mutate(payment.id)}
                            disabled={markPaymentPaidMutation.isPending}
                          >
                            Mark as Paid
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

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
      </div>
    </div>
  );
}