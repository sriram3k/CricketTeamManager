import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useAuth } from '../../src/auth';
import { colors } from '../../src/theme';

/** Tab icons are glyphs so the app needs no icon-font dependency. */
function Glyph({ char, color }: { char: string; color: string }) {
  return <Text style={{ fontSize: 20, color }}>{char}</Text>;
}

export default function TabsLayout() {
  const { isAdmin } = useAuth();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isAdmin ? 'Squad' : 'My dues',
          tabBarIcon: ({ color }) => <Glyph char="🏏" color={color} />,
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: 'Payments',
          // A player has no club-wide payment powers, so the tab is hidden.
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color }) => <Glyph char="💰" color={color} />,
        }}
      />
      <Tabs.Screen
        name="reconcile"
        options={{
          title: 'Reconcile',
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color }) => <Glyph char="🏦" color={color} />,
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: 'Invoices',
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color }) => <Glyph char="🧾" color={color} />,
        }}
      />
    </Tabs>
  );
}
