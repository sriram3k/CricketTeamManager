import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type } from './theme';

/**
 * Cross-platform dialogs.
 *
 * `Alert.alert` from react-native is a no-op under react-native-web — the
 * dialog never appears and, worse, the button callbacks never fire, so a
 * confirmation silently cancels the action it was guarding. This renders a real
 * Modal instead, which behaves identically on web, iOS and Android.
 *
 * Both helpers return a promise so callers can `await` the user's answer rather
 * than threading callbacks through button arrays.
 */

interface NotifyOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
}

interface ConfirmOptions extends NotifyOptions {
  cancelLabel?: string;
  /** Renders the confirm button in the danger style. */
  destructive?: boolean;
}

interface DialogApi {
  notify(options: NotifyOptions): Promise<void>;
  confirm(options: ConfirmOptions): Promise<boolean>;
}

const DialogContext = createContext<DialogApi | null>(null);

interface DialogState extends ConfirmOptions {
  mode: 'notify' | 'confirm';
  resolve: (value: boolean) => void;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);

  const close = useCallback(
    (result: boolean) => {
      state?.resolve(result);
      setState(null);
    },
    [state],
  );

  const api = useMemo<DialogApi>(
    () => ({
      notify: (options) =>
        new Promise<void>((resolve) => {
          setState({ ...options, mode: 'notify', resolve: () => resolve() });
        }),
      confirm: (options) =>
        new Promise<boolean>((resolve) => {
          setState({ ...options, mode: 'confirm', resolve });
        }),
    }),
    [],
  );

  return (
    <DialogContext.Provider value={api}>
      {children}
      <Modal
        visible={state !== null}
        transparent
        animationType="fade"
        // Android hardware back and web Escape both count as a cancel.
        onRequestClose={() => close(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={type.heading}>{state?.title}</Text>
            {state?.message ? (
              <Text style={[type.body, { marginTop: spacing.sm }]}>{state.message}</Text>
            ) : null}

            <View style={styles.actions}>
              {state?.mode === 'confirm' ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => close(false)}
                  style={({ pressed }) => [
                    styles.action,
                    styles.cancel,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.cancelLabel}>{state.cancelLabel ?? 'Cancel'}</Text>
                </Pressable>
              ) : null}

              <Pressable
                accessibilityRole="button"
                onPress={() => close(true)}
                style={({ pressed }) => [
                  styles.action,
                  state?.destructive ? styles.danger : styles.confirm,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.confirmLabel}>
                  {state?.confirmLabel ?? (state?.mode === 'confirm' ? 'Confirm' : 'OK')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used inside DialogProvider');
  return ctx;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(18, 33, 27, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheet: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  action: {
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  confirm: { backgroundColor: colors.primary },
  danger: { backgroundColor: colors.danger },
  cancel: { backgroundColor: colors.primarySoft },
  pressed: { opacity: 0.8 },
  confirmLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cancelLabel: { color: colors.primary, fontSize: 15, fontWeight: '600' },
});
