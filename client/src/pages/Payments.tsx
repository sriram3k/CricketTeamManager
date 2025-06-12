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
import { useAuth } from "@/hooks/useAuth";

const paymentFormSchema = insertPaymentSchema.extend({
  amount: z.string().min(1, "Amount is required"),
  paymentMethod: z.string().optional(),
});

export default function Payments() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string>("");
  const teamId = 1; // This would come from user context
  const { user } = useAuth();
  
  // Check if user is a player (role-based access control)
  const isPlayer = user?.role === "player";

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
      purpose: "",
      status: "pending",
      dueDate: new Date().toISOString().split('T')[0], // Format for date input
      paymentMethod: "",
    },
  });

  const createPaymentMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/payments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/payments/pending`] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      console.error("Payment creation error:", error);
      // Show error message to user
      alert(`Error creating payment: ${error.message || 'Unknown error'}`);
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
    console.log("Form submission data:", data);
    
    // Validate required fields
    if (!data.playerId) {
      alert("Please select a player");
      return;
    }
    if (!data.amount || parseFloat(data.amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    if (!data.dueDate) {
      alert("Please select a due date");
      return;
    }
    
    const paymentData = {
      playerId: parseInt(data.playerId),
      matchId: parseInt(data.matchId),
      amount: data.amount.toString(),
      status: data.status || "pending",
      dueDate: new Date(data.dueDate).toISOString(),
      // Don't include optional fields if they're null/empty
      ...(data.paidDate && { paidDate: new Date(data.paidDate).toISOString() }),
      ...(data.paymentMethod && data.paymentMethod !== "null" && { paymentMethod: data.paymentMethod }),
    };
    
    console.log("Payment data being sent:", paymentData);
    createPaymentMutation.mutate(paymentData);
  };

  const processPayment = (paymentMethod: string) => {
    if (selectedPayment) {
      updatePaymentMutation.mutate({
        id: selectedPayment.id,
        data: {
          status: "paid",
          paidDate: new Date(),
          paymentMethod: paymentMethod
        }
      });
      setIsPaymentDialogOpen(false);
      setSelectedPayment(null);
    }
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

  const totalPending = paymentsArray.reduce((total: number, payment: any) => {
    const amount = payment.payments?.amount || payment.amount;
    return total + (amount ? parseFloat(amount) : 0);
  }, 0);

  const overduePayments = paymentsArray.filter((payment: any) => {
    const dueDate = payment.payments?.dueDate || payment.dueDate;
    const status = payment.payments?.status || payment.status;
    return dueDate && new Date(dueDate) < new Date() && status === 'pending';
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Payment Management</h1>
          <p className="text-muted-foreground">Track and manage player match fees</p>
        </div>
        
        {!isPlayer && (
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
                      <FormLabel>Amount (S$)</FormLabel>
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
                  name="purpose"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purpose</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Match fee, Equipment, Travel" 
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="UPI">UPI</SelectItem>
                          <SelectItem value="Credit Card">Credit Card</SelectItem>
                          <SelectItem value="Debit Card">Debit Card</SelectItem>
                          <SelectItem value="Net Banking">Net Banking</SelectItem>
                          <SelectItem value="Cash">Cash</SelectItem>
                        </SelectContent>
                      </Select>
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
                          value={typeof field.value === 'string' ? field.value : new Date().toISOString().split('T')[0]}
                          onChange={(e) => field.onChange(e.target.value)}
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
        )}
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
                <p className="text-2xl font-bold text-foreground">S${totalPending.toLocaleString()}</p>
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
                <p className="text-2xl font-bold text-foreground">S$45,000</p>
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

      {/* Player Filter - Only show for managers */}
      {!isPlayer && (
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
      )}

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {selectedPlayer && selectedPlayer !== "all" ? "Player Payment History" : "Pending Payments"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(selectedPlayer && selectedPlayer !== "all" ? playerPaymentsArray : paymentsArray).map((payment: any) => {
                // Handle nested payment data structure
                const paymentData = payment.payments || payment;
                const playerId = paymentData.playerId || payment.playerId;
                const player = playersArray.find((p: any) => p.id === playerId);
                const amount = paymentData.amount || payment.amount;
                const dueDate = paymentData.dueDate || payment.dueDate;
                const status = paymentData.status || payment.status;
                const paidDate = paymentData.paidDate || payment.paidDate;
                const paymentId = paymentData.id || payment.id;
                
                const isOverdue = dueDate && new Date(dueDate) < new Date() && status === 'pending';
                
                return (
                  <TableRow key={paymentId}>
                    <TableCell className="font-medium">
                      {player?.name || 'Unknown Player'}
                    </TableCell>
                    <TableCell>{paymentData.purpose || payment.purpose || 'Match fee'}</TableCell>
                    <TableCell>S${amount ? parseFloat(amount).toLocaleString() : '0'}</TableCell>
                    <TableCell>
                      {dueDate ? new Date(dueDate).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          status === 'paid' ? 'default' : 
                          isOverdue ? 'destructive' : 'secondary'
                        }
                      >
                        {status === 'paid' ? 'Paid' : 
                         isOverdue ? 'Overdue' : 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedPayment(paymentData);
                            setIsPaymentDialogOpen(true);
                          }}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Pay Now
                        </Button>
                      )}
                      {status === 'paid' && paidDate && (
                        <span className="text-sm text-muted-foreground">
                          Paid on {new Date(paidDate).toLocaleDateString()}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          
          {paymentsArray.length === 0 && !selectedPlayer && (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground">No Pending Payments</h3>
              <p className="text-muted-foreground">All payments are up to date</p>
            </div>
          )}
          
          {selectedPlayer && selectedPlayer !== "all" && playerPaymentsArray.length === 0 && (
            <div className="text-center py-8">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground">No Payment History</h3>
              <p className="text-muted-foreground">This player has no payment records</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Processing Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Payment</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium">Payment Details</h4>
                <p className="text-sm text-muted-foreground">Amount: S${parseFloat(selectedPayment.amount).toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Due Date: {new Date(selectedPayment.dueDate).toLocaleDateString()}</p>
              </div>
              
              <div className="space-y-3">
                <label className="text-sm font-medium">Select Payment Method</label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="h-12 flex-col"
                    onClick={() => processPayment("UPI")}
                  >
                    <span className="text-xs">UPI</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 flex-col"
                    onClick={() => processPayment("Credit Card")}
                  >
                    <span className="text-xs">Credit Card</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 flex-col"
                    onClick={() => processPayment("Debit Card")}
                  >
                    <span className="text-xs">Debit Card</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 flex-col"
                    onClick={() => processPayment("Net Banking")}
                  >
                    <span className="text-xs">Net Banking</span>
                  </Button>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
