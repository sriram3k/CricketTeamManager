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
    <div className="space-y-4">
      {/* Current Over Display */}
      <Card className="bg-gradient-to-r from-blue-500 to-green-500 text-white border-0">
        <CardContent className="p-4">
          <div className="text-center">
            <div className="text-3xl font-bold mb-1">
              Over {currentOver}.{currentBall}
            </div>
            <p className="text-blue-100 text-sm">Current Ball</p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Score Entry */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Score This Ball</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Large Score Buttons */}
              <div className="space-y-3">
                <FormLabel className="text-base font-semibold">Runs Scored</FormLabel>
                <div className="grid grid-cols-3 gap-3">
                  {quickScoreButtons.map((runs) => (
                    <Button
                      key={runs}
                      type="button"
                      variant={form.watch('runs') === runs ? "default" : "outline"}
                      onClick={() => setQuickScore(runs)}
                      className={`h-16 text-xl font-bold transition-all ${
                        form.watch('runs') === runs 
                          ? 'bg-green-600 hover:bg-green-700 text-white scale-105' 
                          : 'hover:scale-105'
                      } ${
                        runs === 4 ? 'border-blue-300 hover:border-blue-500' :
                        runs === 6 ? 'border-green-300 hover:border-green-500' :
                        'border-gray-300'
                      }`}
                    >
                      {runs}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Wicket Toggle */}
              <div className="border rounded-lg p-4 bg-red-50 dark:bg-red-950/20">
                <FormField
                  control={form.control}
                  name="isWicket"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between space-y-0">
                      <div>
                        <FormLabel className="text-base font-semibold text-red-700 dark:text-red-400">
                          Wicket
                        </FormLabel>
                        <p className="text-sm text-red-600 dark:text-red-500">
                          Check if this ball resulted in a wicket
                        </p>
                      </div>
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="h-6 w-6"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {form.watch('isWicket') && (
                  <div className="mt-4">
                    <FormField
                      control={form.control}
                      name="wicketType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dismissal Type</FormLabel>
                          <Select onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="bg-white dark:bg-slate-900">
                                <SelectValue placeholder="How was the batsman dismissed?" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {wicketTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type.replace('_', ' ').split(' ').map(word => 
                                    word.charAt(0).toUpperCase() + word.slice(1)
                                  ).join(' ')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>

              {/* Players */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="batsmanId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Striker</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Batsman" />
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
                            <SelectValue placeholder="Bowler" />
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

              {/* Commentary */}
              <FormField
                control={form.control}
                name="commentary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ball Commentary</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe what happened on this ball..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full h-14 text-lg font-semibold bg-green-600 hover:bg-green-700"
                disabled={addBallMutation.isPending}
              >
                {addBallMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Adding Ball...
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5 mr-2" />
                    Record Ball
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Current Over Progress */}
      {latestBalls.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">This Over</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {latestBalls.slice(-6).map((ball: any, index) => (
                <div
                  key={ball.id || index}
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                    ball.isWicket 
                      ? 'bg-red-500 border-red-600 text-white' 
                      : ball.runs === 4 
                      ? 'bg-blue-500 border-blue-600 text-white'
                      : ball.runs === 6
                      ? 'bg-green-500 border-green-600 text-white'
                      : 'bg-gray-200 border-gray-300 text-gray-800 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200'
                  }`}
                >
                  {ball.isWicket ? 'W' : ball.runs}
                </div>
              ))}
            </div>
            {latestBalls.length === 0 && (
              <div className="text-center py-6">
                <Target className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No balls recorded yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
