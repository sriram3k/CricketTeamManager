import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@shared/schema";
import { Trophy, Mail, ArrowLeft } from "lucide-react";

export default function ForgotPassword() {
  const [authError, setAuthError] = useState<string>("");
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordInput) => {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }
      
      return response.json();
    },
    onSuccess: () => {
      setEmailSent(true);
      toast({
        title: "Reset email sent",
        description: "Check your email for password reset instructions.",
      });
    },
    onError: (error: Error) => {
      setAuthError(error.message || "Failed to send reset email. Please try again.");
    },
  });

  const onSubmit = (data: ForgotPasswordInput) => {
    setAuthError("");
    forgotPasswordMutation.mutate(data);
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-center space-x-2">
              <Trophy className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold">CrickIQ</h1>
            </div>
            <div className="text-center">
              <CardTitle className="text-xl">Check your email</CardTitle>
              <CardDescription>
                We've sent password reset instructions to your email address
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <Mail className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm text-muted-foreground">
                If you don't see the email in your inbox, check your spam folder.
              </p>
            </div>

            <div className="text-center space-y-2">
              <Link href="/login">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to sign in
                </Button>
              </Link>
              
              <Button
                variant="link"
                onClick={() => {
                  setEmailSent(false);
                  form.reset();
                }}
                className="text-sm"
              >
                Try a different email
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-center space-x-2">
            <Trophy className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">CrickIQ</h1>
          </div>
          <div className="text-center">
            <CardTitle className="text-xl">Forgot your password?</CardTitle>
            <CardDescription>
              Enter your email address and we'll send you a reset link
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="Enter your email address"
                          className="pl-10"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {authError && (
                <Alert variant="destructive">
                  <AlertDescription>{authError}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={forgotPasswordMutation.isPending}
              >
                {forgotPasswordMutation.isPending ? "Sending..." : "Send reset email"}
              </Button>
            </form>
          </Form>

          <div className="text-center">
            <Link href="/login">
              <Button variant="link" className="text-sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to sign in
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}