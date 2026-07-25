import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { AuthProvider, useAuth } from '../src/auth';
import { DialogProvider } from '../src/dialog';
import { Loading } from '../src/components/ui';
import { colors } from '../src/theme';

function RootNavigator() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthFlow = segments[0] === 'login';

    if (!user && !inAuthFlow) router.replace('/login');
    else if (user && inAuthFlow) router.replace('/');
  }, [user, loading, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <Loading label="Starting CricSquad…" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="player/[id]" options={{ title: 'Player dues' }} />
      <Stack.Screen name="match/[id]" options={{ title: 'Select squad' }} />
      <Stack.Screen name="charges/adhoc" options={{ title: 'Raise a charge' }} />
      <Stack.Screen name="payments/bulk" options={{ title: 'Bulk mark as paid' }} />
      <Stack.Screen name="statement/[id]" options={{ title: 'Review statement' }} />
      <Stack.Screen name="invoice/new" options={{ title: 'New invoice' }} />
      <Stack.Screen name="invoice/[id]" options={{ title: 'Invoice' }} />
      <Stack.Screen name="tournament/[id]" options={{ title: 'Tournament' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <DialogProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </DialogProvider>
    </AuthProvider>
  );
}
