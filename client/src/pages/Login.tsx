import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { loginSchema, type LoginInput } from "@shared/schema";
import { Trophy, Mail, Lock, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string>("");
  const { toast } = useToast();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginInput) => {
      const response = await fetch("/api/auth/login", {
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
      toast({
        title: "Login successful",
        description: "Welcome back to CrickIQ!",
      });
      window.location.href = "/";
    },
    onError: (error: Error) => {
      setAuthError(error.message || "Login failed. Please try again.");
    },
  });

  const onSubmit = (data: LoginInput) => {
    setAuthError("");
    loginMutation.mutate(data);
  };

  const handleReplitLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-center space-x-2">
            <Trophy className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">CrickIQ</h1>
          </div>
          <div className="text-center">
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>
              Sign in to your cricket management account
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Replit Auth Login */}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleReplitLogin}
          >
            Continue with Replit
          </Button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with email
              </span>
            </div>
          </div>

          {/* Email/Password Login Form */}
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
                          placeholder="Enter your email"
                          className="pl-10"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          className="pl-10 pr-10"
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
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
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </Form>

          <div className="text-center space-y-2">
            <Link href="/forgot-password">
              <Button variant="link" className="text-sm">
                Forgot your password?
              </Button>
            </Link>
            
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/signup">
                <Button variant="link" className="p-0 h-auto text-sm">
                  Sign up
                </Button>
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}