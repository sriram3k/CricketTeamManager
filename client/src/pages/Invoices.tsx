import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertInvoiceSchema } from "@shared/schema";
import { Plus, FileText, DollarSign, Calendar, CheckCircle, AlertCircle, Eye } from "lucide-react";
import { z } from "zod";

const invoiceFormSchema = insertInvoiceSchema.extend({
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  amount: z.string().min(1, "Amount is required"),
  description: z.string().min(1, "Description is required"),
});

export default function Invoices() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const teamId = 1; // This would come from user context

  const { data: invoices, isLoading } = useQuery({
    queryKey: [`/api/teams/${teamId}/invoices`],
  });

  const { data: pendingInvoices } = useQuery({
    queryKey: [`/api/teams/${teamId}/invoices/pending`],
  });

  const form = useForm({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      teamId: teamId,
      matchId: null,
      invoiceNumber: "",
      amount: "",
      description: "",
      dueDate: new Date(),
      status: "sent",
      paidDate: null,
      corporateId: 1,
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/invoices", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/invoices`] });
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/invoices/pending`] });
      setIsDialogOpen(false);
      form.reset();
    },
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      apiRequest("PUT", `/api/invoices/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/invoices`] });
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/invoices/pending`] });
    },
  });

  const onSubmit = (data: any) => {
    const invoiceData = {
      ...data,
      amount: parseFloat(data.amount),
      dueDate: new Date(data.dueDate).toISOString(),
      invoiceNumber: data.invoiceNumber || `INV-${Date.now()}`,
    };
    createInvoiceMutation.mutate(invoiceData);
  };

  const markAsPaid = (invoiceId: number) => {
    updateInvoiceMutation.mutate({
      id: invoiceId,
      data: {
        status: "paid",
        paidDate: new Date().toISOString(),
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading invoices...</div>
      </div>
    );
  }

  const totalPending = pendingInvoices?.reduce((total: number, invoice: any) => 
    total + parseFloat(invoice.amount), 0
  ) || 0;

  const overdueInvoices = pendingInvoices?.filter((invoice: any) => 
    new Date(invoice.dueDate) < new Date()
  ) || [];

  const paidInvoices = invoices?.filter((invoice: any) => invoice.status === 'paid') || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Invoice Management</h1>
          <p className="text-muted-foreground">Manage corporate invoices and billing</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Invoice</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="invoiceNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Number</FormLabel>
                      <FormControl>
                        <Input placeholder="INV-001 (auto-generated if empty)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Cricket match organizing services, venue rental, etc."
                          {...field}
                        />
                      </FormControl>
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
                          placeholder="Enter invoice amount" 
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
                  <Button type="submit" disabled={createInvoiceMutation.isPending}>
                    Create Invoice
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
                <p className="text-2xl font-bold text-foreground">{overdueInvoices.length}</p>
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
                <p className="text-sm font-medium text-muted-foreground">Paid This Month</p>
                <p className="text-2xl font-bold text-foreground">{paidInvoices.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <FileText className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Invoices</p>
                <p className="text-2xl font-bold text-foreground">{invoices?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices?.map((invoice: any) => {
                const isOverdue = new Date(invoice.dueDate) < new Date() && invoice.status !== 'paid';
                
                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {invoice.invoiceNumber}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate">
                        {invoice.description}
                      </div>
                    </TableCell>
                    <TableCell>S${parseFloat(invoice.amount).toLocaleString()}</TableCell>
                    <TableCell>
                      {new Date(invoice.issueDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {new Date(invoice.dueDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          invoice.status === 'paid' ? 'default' : 
                          isOverdue ? 'destructive' : 'secondary'
                        }
                      >
                        {invoice.status === 'paid' ? 'Paid' : 
                         isOverdue ? 'Overdue' : 'Sent'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedInvoice(invoice)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {invoice.status !== 'paid' && (
                          <Button
                            size="sm"
                            onClick={() => markAsPaid(invoice.id)}
                            disabled={updateInvoiceMutation.isPending}
                          >
                            Mark Paid
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          
          {(!invoices || invoices.length === 0) && (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground">No Invoices Yet</h3>
              <p className="text-muted-foreground">Create your first invoice to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Details Dialog */}
      {selectedInvoice && (
        <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Invoice Details - {selectedInvoice.invoiceNumber}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Issue Date</label>
                  <p className="text-foreground">{new Date(selectedInvoice.issueDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Due Date</label>
                  <p className="text-foreground">{new Date(selectedInvoice.dueDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Amount</label>
                  <p className="text-2xl font-bold text-foreground">₹{parseFloat(selectedInvoice.amount).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <Badge className="mt-1" variant={selectedInvoice.status === 'paid' ? 'default' : 'secondary'}>
                    {selectedInvoice.status}
                  </Badge>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <p className="text-foreground mt-1">{selectedInvoice.description}</p>
              </div>
              
              {selectedInvoice.paidDate && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Paid Date</label>
                  <p className="text-foreground">{new Date(selectedInvoice.paidDate).toLocaleDateString()}</p>
                </div>
              )}
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setSelectedInvoice(null)}>
                  Close
                </Button>
                <Button>
                  Download PDF
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
