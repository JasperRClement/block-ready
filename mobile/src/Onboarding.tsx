import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Household, Plan, defaultHousehold, getPlan } from './api';
import { Button, C, Chip, H1, P, s } from './ui';

const LANGS = ['English', 'Español', 'Հայերեն', '한국어', 'Tagalog', 'فارسی'];

export default function Onboarding({
  initialAddress = '',
  initialHousehold = defaultHousehold,
  onDone,
}: {
  initialAddress?: string;
  initialHousehold?: Household;
  onDone: (address: string, household: Household, plan: Plan) => void;
}) {
  const [step, setStep] = useState(0);
  const [address, setAddress] = useState(initialAddress);
  const [h, setH] = useState<Household>(initialHousehold);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof Household>(k: K, v: Household[K]) => setH({ ...h, [k]: v });

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const plan = await getPlan(address.trim(), h);
      onDone(address.trim(), h, plan);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
      setStep(0);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: C.brand, fontWeight: '800', fontSize: 15, marginBottom: 8 }}>
          READYBLOCK · GLENDALE
        </Text>

        {step === 0 && (
          <>
            <H1>Know your risks. Make your plan.</H1>
            <P>
              Enter your home address. We check official hazard maps from CAL FIRE, FEMA and the
              California Geological Survey.
            </P>
            <Text style={s.label}>Home address</Text>
            <TextInput
              style={s.input}
              value={address}
              onChangeText={setAddress}
              placeholder="e.g. 613 E Broadway"
              placeholderTextColor="#A8A29E"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => address.trim() && setStep(1)}
              accessibilityLabel="Home address in Glendale"
            />
            {!!error && <Text style={{ color: '#B91C1C', marginTop: 10, fontSize: 15 }}>{error}</Text>}
            <Button title="Next" disabled={!address.trim()} onPress={() => setStep(1)} style={{ marginTop: 20 }} />
            <P style={{ marginTop: 16, fontSize: 13 }}>
              Your address stays on this device and our server. It is never shared with neighbors.
            </P>
          </>
        )}

        {step === 1 && (
          <>
            <H1>Tell us about your home</H1>
            <P>This changes which steps matter most for you.</P>

            <Text style={s.label}>Type of home</Text>
            <View style={s.wrap}>
              {(
                [
                  ['house', 'House'],
                  ['apartment', 'Apartment / condo'],
                  ['mobile_home', 'Mobile home'],
                  ['other', 'Other'],
                ] as const
              ).map(([v, l]) => (
                <Chip key={v} label={l} active={h.housing === v} onPress={() => set('housing', v)} />
              ))}
            </View>
            {h.housing === 'apartment' && (
              <Counter label="Which floor?" value={h.floor} min={1} onChange={(v) => set('floor', v)} />
            )}
            <Toggle label="I rent" value={h.renter} onChange={(v) => set('renter', v)} />

            <Text style={s.label}>Who lives here?</Text>
            <Counter label="Adults" value={h.adults} min={1} onChange={(v) => set('adults', v)} />
            <Counter label="Children" value={h.kids} onChange={(v) => set('kids', v)} />
            <Counter label="Seniors (65+)" value={h.seniors} onChange={(v) => set('seniors', v)} />

            <Button title="Next" onPress={() => setStep(2)} style={{ marginTop: 20 }} />
            <Button title="Back" kind="ghost" onPress={() => setStep(0)} />
          </>
        )}

        {step === 2 && (
          <>
            <H1>Needs, pets and language</H1>
            <P>Everything is optional.</P>

            <Text style={s.label}>Does anyone…</Text>
            <Toggle label="Have trouble walking or use a wheelchair?" value={h.mobility_needs} onChange={(v) => set('mobility_needs', v)} />
            <Toggle label="Use medical equipment that needs power (oxygen, CPAP)?" value={h.power_dependent_medical} onChange={(v) => set('power_dependent_medical', v)} />
            <Toggle label="Take daily medication?" value={h.daily_medications} onChange={(v) => set('daily_medications', v)} />
            <Toggle label="Have hearing or vision loss?" value={h.hearing_or_vision_needs} onChange={(v) => set('hearing_or_vision_needs', v)} />

            <Text style={s.label}>Pets</Text>
            <Counter label="Dogs" value={h.dogs} onChange={(v) => set('dogs', v)} />
            <Counter label="Cats" value={h.cats} onChange={(v) => set('cats', v)} />
            <Toggle label="Other animals" value={h.other_pets} onChange={(v) => set('other_pets', v)} />

            <Text style={s.label}>Getting around</Text>
            <Toggle label="We have a car" value={h.has_car} onChange={(v) => set('has_car', v)} />

            <Text style={s.label}>Preferred language</Text>
            <View style={s.wrap}>
              {LANGS.map((l) => (
                <Chip key={l} label={l} active={h.language === l} onPress={() => set('language', l)} />
              ))}
            </View>

            {busy ? (
              <View style={{ alignItems: 'center', marginTop: 24 }}>
                <ActivityIndicator size="large" color={C.brand} />
                <P style={{ marginTop: 10 }}>Checking hazard maps…</P>
              </View>
            ) : (
              <>
                <Button title="Build my plan" onPress={submit} style={{ marginTop: 24 }} />
                <Button title="Back" kind="ghost" onPress={() => setStep(1)} />
              </>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={[s.row, { paddingVertical: 10, justifyContent: 'space-between' }]}>
      <Text style={{ fontSize: 16, color: C.ink, flex: 1, paddingRight: 12 }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: C.brand }} accessibilityLabel={label} />
    </Pressable>
  );
}

function Counter({
  label,
  value,
  min = 0,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={[s.row, { paddingVertical: 6, justifyContent: 'space-between' }]}>
      <Text style={{ fontSize: 16, color: C.ink }}>{label}</Text>
      <View style={s.row}>
        <RoundBtn label="−" a11y={`Fewer ${label}`} onPress={() => onChange(Math.max(min, value - 1))} />
        <Text style={{ fontSize: 18, fontWeight: '700', width: 36, textAlign: 'center', color: C.ink }}>{value}</Text>
        <RoundBtn label="+" a11y={`More ${label}`} onPress={() => onChange(value + 1)} />
      </View>
    </View>
  );
}

function RoundBtn({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={a11y}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: C.line,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: C.card,
      }}>
      <Text style={{ fontSize: 22, color: C.ink }}>{label}</Text>
    </Pressable>
  );
}
