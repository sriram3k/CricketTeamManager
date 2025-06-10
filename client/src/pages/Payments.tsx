import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertPaymentSchema } from "@shared/schema";
import { Plus, DollarSign, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { z } from "zod";

const paymentFormSchema = insertPaymentSchema.extend({
  amount: z.string().min(1, "Amount is required"),
});

export default function Payments() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<string>("");
  const teamId = 1; // This would come from user context

  const { data: pendingPayments, isLoading } = useQuery({
    queryKey: [`/api/teams/${teamId}/payments/pending`],
  });

  const { data: players } = useQuery({
    queryKey: [`/api/teams/${teamId}/players/active`],
  });

  const { data: playerPayments } = useQuery({
    queryKey: [`/api/players/${selectedPlayer}/payments`],
    enabled: !!selectedPlayer,
  });

  const form = useForm({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      playerId: 1,
      matchId: 1,
      amount: "",
      status: "pending",
      dueDate: new Date().toISOString().split('T')[0], // Format for date input
    },
  });

  const createPaymentMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/payments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/payments/pending`] });
      setIsDialogOpen(false);
      form.reset();
    },
  });

  const updatePaymentMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      apiRequest("PUT", `/api/payments/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/payments/pending`] });
      if (selectedPlayer) {
        queryClient.invalidateQueries({ queryKey: [`/api/players/${selectedPlayer}/payments`] });
      }
    },
  });

  const onSubmit = (data: any) => {
    const paymentData = {
      playerId: data.playerId,
      matchId: data.matchId,
      amount: data.amount, // Keep as string for decimal field
      status: data.status,
      dueDate: new Date(data.dueDate).toISOString(),
      // Don't include optional fields if they're null/empty
      ...(data.paidDate && { paidDate: new Date(data.paidDate).toISOString() }),
      ...(data.paymentMethod && data.paymentMethod !== "null" && { paymentMethod: data.paymentMethod }),
    };
    createPaymentMutation.mutate(paymentData);
  };

  const markAsPaid = (paymentId: number) => {
    updatePaymentMutation.mutate({
      id: paymentId,
      data: {
        status: "paid",
        paidDate: new Date().toISOString(),
        paymentMethod: "cash",
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading payments...</div>
      </div>
    );
  }

  const paymentsArray = Array.isArray(pendingPayments) ? pendingPayments : [];
  const playersArray = Array.isArray(players) ? players : [];
  const playerPaymentsArray = Array.isArray(playerPayments) ? playerPayments : [];

  const totalPending = paymentsArray.reduce((total: number, payment: any) => 
    total + parseFloat(payment.amount), 0
  );

  const overduePayments = paymentsArray.filter((payment: any) => 
    new Date(payment.dueDate) < new Date()
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Payment Management</h1>
          <p className="text-muted-foreground">Track and manage player match fees</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Payment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Payment</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="playerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Player</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select player" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {playersArray.map((player: any) => (
                            <SelectItem key={player.id} value={player.id.toString()}>
                              {player.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (₹)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="Enter amount" 
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field}
                          value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : field.value}
                          onChange={(e) => field.onChange(new Date(e.target.value))}
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
                  <Button type="submit" disabled={createPaymentMutation.isPending}>
                    Add Payment
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-accent-foreground" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Pending</p>
                <p className="text-2xl font-bold text-foreground">₹{totalPending.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-destructive rounded-full flex items-center justify-center">
                <AlertCircle className="h-4 w-4 text-destructive-foreground" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-foreground">{overduePayments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
                <CheckCircle className="h-4 w-4 text-secondary-foreground" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold text-foreground">₹45,000</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <Clock className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Pending Count</p>
                <p className="text-2xl font-bold text-foreground">{paymentsArray.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Player Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filter by Player</CardTitle>
        </CardHeader>
        <CardContent>
          <Select onValueChange={setSelectedPlayer}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a player to view their payments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Players</SelectItem>
              {playersArray.map((player: any) => (
                <SelectItem key={player.id} value={player.id.toString()}>
                  {player.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {selectedPlayer ? "Player Payment History" : "Pending Payments"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(selectedPlayer ? playerPayments : pendingPayments)?.map((payment: any) => {
                const player = players?.find((p: any) => p.id === payment.playerId);
                const isOverdue = new Date(payment.dueDate) < new Date() && payment.status === 'pending';
                
                return (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      {player?.name || 'Unknown Player'}
                    </TableCell>
                    <TableCell>₹{parseFloat(payment.amount).toLocaleString()}</TableCell>
                    <TableCell>
                      {new Date(payment.dueDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          payment.status === 'paid' ? 'default' : 
                          isOverdue ? 'destructive' : 'secondary'
                        }
                      >
                        {payment.status === 'paid' ? 'Paid' : 
                         isOverdue ? 'Overdue' : 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {payment.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => markAsPaid(payment.id)}
                          disabled={updatePaymentMutation.isPending}
                        >
                          Mark as Paid
                        </Button>
                      )}
                      {payment.status === 'paid' && payment.paidDate && (
                        <span className="text-sm text-muted-foreground">
                          Paid on {new Date(payment.paidDate).toLocaleDateString()}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          
          {(!pendingPayments || pendingPayments.length === 0) && !selectedPlayer && (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground">No Pending Payments</h3>
              <p className="text-muted-foreground">All payments are up to date</p>
            </div>
          )}
          
          {selectedPlayer && (!playerPayments || playerPayments.length === 0) && (
            <div className="text-center py-8">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground">No Payment History</h3>
              <p className="text-muted-foreground">This player has no payment records</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
