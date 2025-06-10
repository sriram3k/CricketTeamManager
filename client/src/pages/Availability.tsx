import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertAvailabilityRequestSchema } from "@shared/schema";
import { Plus, Calendar, Users, CheckCircle, XCircle, Clock } from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";

const availabilityFormSchema = insertAvailabilityRequestSchema.extend({
  venue: z.string().min(1, "Venue is required"),
  opponent: z.string().min(1, "Opponent is required"),
});

export default function Availability() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const teamId = 1; // This would come from user context
  const { user } = useAuth();
  
  // Check if user is a player (role-based access control)
  const isPlayer = user?.role === "player";

  const { data: availabilityRequests, isLoading } = useQuery({
    queryKey: [`/api/teams/${teamId}/availability-requests`],
  });

  const { data: players } = useQuery({
    queryKey: [`/api/teams/${teamId}/players/active`],
  });

  const form = useForm({
    resolver: zodResolver(availabilityFormSchema),
    defaultValues: {
      teamId: teamId,
      matchId: null,
      requestDate: new Date(),
      matchDate: new Date(),
      venue: "",
      opponent: "",
      deadline: new Date(),
      message: "",
    },
  });

  const createRequestMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/availability-requests", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/availability-requests`] });
      setIsDialogOpen(false);
      form.reset();
    },
  });

  const onSubmit = (data: any) => {
    createRequestMutation.mutate({
      ...data,
      requestDate: new Date().toISOString(),
      matchDate: new Date(data.matchDate).toISOString(),
      deadline: new Date(data.deadline).toISOString(),
    });
  };

  const getResponseStats = async (requestId: number) => {
    const responses = await queryClient.fetchQuery({
      queryKey: [`/api/availability-requests/${requestId}/responses`],
    });
    
    const available = responses?.filter((r: any) => r.status === 'available').length || 0;
    const unavailable = responses?.filter((r: any) => r.status === 'unavailable').length || 0;
    const pending = (players?.length || 0) - available - unavailable;
    
    return { available, unavailable, pending };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading availability requests...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Player Availability</h1>
          <p className="text-muted-foreground">Request and track player availability for matches</p>
        </div>
        
        {!isPlayer && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Request
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Send Availability Request</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="opponent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opponent</FormLabel>
                      <FormControl>
                        <Input placeholder="vs Team Name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
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
                  control={form.control}
                  name="matchDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Match Date & Time</FormLabel>
                      <FormControl>
                        <Input 
                          type="datetime-local" 
                          {...field}
                          value={field.value instanceof Date ? field.value.toISOString().slice(0, 16) : field.value}
                          onChange={(e) => field.onChange(new Date(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="deadline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Response Deadline</FormLabel>
                      <FormControl>
                        <Input 
                          type="datetime-local" 
                          {...field}
                          value={field.value instanceof Date ? field.value.toISOString().slice(0, 16) : field.value}
                          onChange={(e) => field.onChange(new Date(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Message (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Any additional information for players..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createRequestMutation.isPending}>
                    Send Request
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <Calendar className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Active Requests</p>
                <p className="text-2xl font-bold text-foreground">
                  {availabilityRequests?.filter((r: any) => new Date(r.deadline) > new Date()).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
                <Users className="h-4 w-4 text-secondary-foreground" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Players</p>
                <p className="text-2xl font-bold text-foreground">{players?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                <CheckCircle className="h-4 w-4 text-accent-foreground" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Avg Response Rate</p>
                <p className="text-2xl font-bold text-foreground">85%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Availability Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Availability Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {availabilityRequests?.map((request: any) => {
              const isExpired = new Date(request.deadline) < new Date();
              
              return (
                <div key={request.id} className="border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-foreground">{request.opponent}</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(request.matchDate).toLocaleDateString()} at {request.venue}
                      </p>
                    </div>
                    <Badge variant={isExpired ? "secondary" : "default"}>
                      {isExpired ? "Expired" : "Active"}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <CheckCircle className="h-4 w-4 text-secondary" />
                        <span className="text-sm font-medium">Available</span>
                      </div>
                      <p className="text-lg font-bold text-secondary">0</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <XCircle className="h-4 w-4 text-destructive" />
                        <span className="text-sm font-medium">Unavailable</span>
                      </div>
                      <p className="text-lg font-bold text-destructive">0</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <Clock className="h-4 w-4 text-accent" />
                        <span className="text-sm font-medium">Pending</span>
                      </div>
                      <p className="text-lg font-bold text-accent">{players?.length || 0}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Deadline: {new Date(request.deadline).toLocaleDateString()} at{" "}
                      {new Date(request.deadline).toLocaleTimeString()}
                    </p>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                </div>
              );
            })}
            
            {(!availabilityRequests || availabilityRequests.length === 0) && (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground">No Availability Requests</h3>
                <p className="text-muted-foreground">Create your first availability request to get started</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
