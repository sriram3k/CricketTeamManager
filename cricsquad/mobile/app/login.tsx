import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth';
import { ApiError } from '../src/api';
import { Button, ErrorBanner, Field } from '../src/components/ui';
import { colors, spacing, type } from '../src/theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setErrors({});
    setBanner(null);

    // Validate locally first so the obvious cases never hit the network.
    const local: Record<string, string> = {};
    if (!email.trim()) local.email = 'Enter your email address';
    if (!password) local.password = 'Enter your password';
    if (Object.keys(local).length > 0) {
      setErrors(local);
      return;
    }

    setSubmitting(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        // A 401 has no field to attach to, so it becomes the banner.
        if (Object.keys(err.fieldErrors).length === 0) setBanner(err.message);
      } else {
        setBanner('Could not reach CricSquad. Check your connection and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Text style={styles.brandMark}>CricSquad</Text>
            <Text style={styles.brandSub}>Squad, dues and club finances</Text>
          </View>

          <ErrorBanner message={banner} />

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="admin@cricsquad.example"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secureTextEntry
            autoComplete="password"
            placeholder="••••••••"
            onSubmitEditing={onSubmit}
            returnKeyType="go"
          />

          <Button label="Sign in" onPress={onSubmit} loading={submitting} />

          <Text style={[type.caption, styles.hint]}>
            Players see their own dues. Admins get the full club view.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, flexGrow: 1, justifyContent: 'center' },
  brand: { marginBottom: spacing.xxl, alignItems: 'center' },
  brandMark: { fontSize: 34, fontWeight: '800', color: colors.primary, letterSpacing: -0.5 },
  brandSub: { ...type.caption, marginTop: spacing.xs },
  hint: { textAlign: 'center', marginTop: spacing.lg },
});
