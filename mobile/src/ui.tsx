import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import type { Level } from './api';

export const C = {
  bg: '#F6F4EF',
  card: '#FFFFFF',
  ink: '#1D1B18',
  sub: '#6B665E',
  line: '#E6E1D8',
  brand: '#C2410C',
  brandSoft: '#FDEBDD',
  ok: '#15803D',
};

export const levelColor: Record<Level, { fg: string; bg: string; label: string }> = {
  0: { fg: '#15803D', bg: '#E3F4E8', label: 'Not mapped' },
  1: { fg: '#A16207', bg: '#FBF1D3', label: 'Low' },
  2: { fg: '#C2410C', bg: '#FDEBDD', label: 'Moderate' },
  3: { fg: '#B91C1C', bg: '#FDE2E2', label: 'High' },
};

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function H1({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[s.h1, style]}>{children}</Text>;
}

export function H2({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[s.h2, style]}>{children}</Text>;
}

export function P({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[s.p, style]}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost';
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.btn,
        kind === 'ghost' && s.btnGhost,
        (pressed || disabled) && { opacity: 0.6 },
        style,
      ]}>
      <Text style={[s.btnText, kind === 'ghost' && { color: C.brand }]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[s.chip, active && s.chipOn]}>
      <Text style={[s.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ level }: { level: Level }) {
  const c = levelColor[level];
  return (
    <View style={[s.badge, { backgroundColor: c.bg }]}>
      <Text style={[s.badgeText, { color: c.fg }]}>{c.label}</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.line,
  },
  h1: { fontSize: 28, fontWeight: '800', color: C.ink, marginBottom: 6 },
  h2: { fontSize: 18, fontWeight: '700', color: C.ink, marginBottom: 6 },
  p: { fontSize: 16, lineHeight: 22, color: C.sub },
  btn: {
    backgroundColor: C.brand,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: C.brand },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: C.line,
    backgroundColor: C.card,
    marginRight: 8,
    marginBottom: 8,
  },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontSize: 15, color: C.ink, fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 13, fontWeight: '700' },
  input: {
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.line,
    borderRadius: 14,
    padding: 14,
    fontSize: 17,
    color: C.ink,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  label: { fontSize: 15, fontWeight: '700', color: C.ink, marginTop: 18, marginBottom: 8 },
});
