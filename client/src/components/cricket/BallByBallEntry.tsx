import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { insertBallSchema } from "@shared/schema";
import { Plus, Target } from "lucide-react";
import { z } from "zod";

const ballFormSchema = insertBallSchema.extend({
  runs: z.number().min(0).max(6),
  batsmanId: z.number().min(1, "Batsman is required"),
  bowlerId: z.number().min(1, "Bowler is required"),
});

interface BallByBallEntryProps {
  inningsId: number;
  balls: any[];
  onBallAdded: () => void;
}

export default function BallByBallEntry({ inningsId, balls, onBallAdded }: BallByBallEntryProps) {
  const [currentOver, setCurrentOver] = useState(1);
  const [currentBall, setCurrentBall] = useState(1);

  const form = useForm({
    resolver: zodResolver(ballFormSchema),
    defaultValues: {
      inningsId,
      overNumber: currentOver,
      ballNumber: currentBall,
      batsmanId: 1,
      bowlerId: 1,
      runs: 0,
      isWicket: false,
      wicketType: null,
      fielderInvolvedId: null,
      extras: {},
      commentary: "",
    },
  });

  const addBallMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/balls", data),
    onSuccess: () => {
      onBallAdded();
      
      // Auto-increment ball/over
      if (currentBall === 6) {
        setCurrentOver(prev => prev + 1);
        setCurrentBall(1);
      } else {
        setCurrentBall(prev => prev + 1);
      }
      
      // Reset form but keep current over/ball
      form.reset({
        inningsId,
        overNumber: currentBall === 6 ? currentOver + 1 : currentOver,
        ballNumber: currentBall === 6 ? 1 : currentBall + 1,
        batsmanId: form.getValues('batsmanId'),
        bowlerId: form.getValues('bowlerId'),
        runs: 0,
        isWicket: false,
        wicketType: null,
        fielderInvolvedId: null,
        extras: {},
        commentary: "",
      });
    },
  });

  const onSubmit = (data: any) => {
    addBallMutation.mutate({
      ...data,
      overNumber: currentOver,
      ballNumber: currentBall,
    });
  };

  const quickScoreButtons = [0, 1, 2, 3, 4, 6];
  const wicketTypes = [
    "bowled", "caught", "lbw", "run_out", "stumped", "hit_wicket"
  ];

  const setQuickScore = (runs: number) => {
    form.setValue('runs', runs);
  };

  const latestBalls = balls.slice(-6).reverse();

  return (
    <div className="space-y-6">
      {/* Current Over Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Ball by Ball Entry</span>
            <Badge variant="outline">
              Over {currentOver}.{currentBall}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Players Selection */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="batsmanId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Batsman</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select batsman" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">Player 1</SelectItem>
                          <SelectItem value="2">Player 2</SelectItem>
                          <SelectItem value="3">Player 3</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bowlerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bowler</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select bowler" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">Bowler 1</SelectItem>
                          <SelectItem value="2">Bowler 2</SelectItem>
                          <SelectItem value="3">Bowler 3</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Quick Score Buttons */}
              <div>
                <FormLabel>Runs Scored</FormLabel>
                <div className="flex space-x-2 mt-2">
                  {quickScoreButtons.map((runs) => (
                    <Button
                      key={runs}
                      type="button"
                      variant={form.watch('runs') === runs ? "default" : "outline"}
                      onClick={() => setQuickScore(runs)}
                      className="w-12 h-12"
                    >
                      {runs}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Wicket Information */}
              <FormField
                control={form.control}
                name="isWicket"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Wicket</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              {form.watch('isWicket') && (
                <FormField
                  control={form.control}
                  name="wicketType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>How Out</FormLabel>
                      <Select onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select wicket type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {wicketTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type.replace('_', ' ').toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Commentary */}
              <FormField
                control={form.control}
                name="commentary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commentary (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe the ball..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full"
                disabled={addBallMutation.isPending}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Ball
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Recent Balls */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Balls</CardTitle>
        </CardHeader>
        <CardContent>
          {latestBalls.length > 0 ? (
            <div className="space-y-2">
              {latestBalls.map((ball: any, index: number) => (
                <div key={ball.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Badge variant="outline">
                      {ball.overNumber}.{ball.ballNumber}
                    </Badge>
                    <span className="font-medium">
                      {ball.runs} run{ball.runs !== 1 ? 's' : ''}
                    </span>
                    {ball.isWicket && (
                      <Badge variant="destructive">WICKET</Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {ball.commentary || 'No commentary'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground">No Balls Yet</h3>
              <p className="text-muted-foreground">Start adding balls to see the history</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
