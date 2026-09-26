import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Household, Plan, defaultHousehold } from './src/api';
import Onboarding from './src/Onboarding';
import { InfoScreen, NeighborsScreen, PlanScreen, RisksScreen } from './src/Screens';
import { C } from './src/ui';

type Saved = { address: string; household: Household; plan: Plan; done: string[] };
const KEY = 'readyblock:v1';

const TABS = [
  ['risks', '⚠️', 'Risks'],
  ['plan', '✅', 'Plan'],
  ['neighbors', '🏘️', 'Neighbors'],
  ['info', 'ℹ️', 'Info'],
] as const;
type Tab = (typeof TABS)[number][0];

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<Tab>('risks');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => v && setSaved(JSON.parse(v)))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  function persist(next: Saved | null) {
    setSaved(next);
    if (next) AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    else AsyncStorage.removeItem(KEY).catch(() => {});
  }

  const done = new Set(saved?.done ?? []);
  const toggle = (id: string) => {
    if (!saved) return;
    const d = new Set(done);
    d.has(id) ? d.delete(id) : d.add(id);
    persist({ ...saved, done: [...d] });
  };

  let body;
  if (!loaded) {
    body = <ActivityIndicator style={{ flex: 1 }} color={C.brand} />;
  } else if (!saved || editing) {
    body = (
      <Onboarding
        initialAddress={saved?.address}
        initialHousehold={saved?.household ?? defaultHousehold}
        onDone={(address, household, plan) => {
          persist({ address, household, plan, done: saved?.done ?? [] });
          setEditing(false);
          setTab('risks');
        }}
      />
    );
  } else {
    body = (
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          {tab === 'risks' && <RisksScreen plan={saved.plan} done={done} />}
          {tab === 'plan' && <PlanScreen plan={saved.plan} done={done} toggle={toggle} />}
          {tab === 'neighbors' && <NeighborsScreen plan={saved.plan} done={done} />}
          {tab === 'info' && (
            <InfoScreen onEdit={() => setEditing(true)} onReset={() => persist(null)} />
          )}
        </View>
        <View
          style={{
            flexDirection: 'row',
            borderTopWidth: 1,
            borderColor: C.line,
            backgroundColor: C.card,
          }}>
          {TABS.map(([id, icon, label]) => (
            <Pressable
              key={id}
              onPress={() => setTab(id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === id }}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}>
              <Text style={{ fontSize: 22, opacity: tab === id ? 1 : 0.45 }}>{icon}</Text>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: tab === id ? C.brand : C.sub,
                  marginTop: 2,
                }}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        {body}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
