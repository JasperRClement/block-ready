import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import {
  Community,
  Plan,
  Post,
  Step,
  addPost,
  getCommunity,
  joinCommunity,
  speak,
} from './api';
import { Badge, Button, C, Card, Chip, H1, H2, P, levelColor, s } from './ui';

const scroll = { padding: 20, paddingBottom: 40 };

// --------------------------------------------------------------------------------------------
// Risks
// --------------------------------------------------------------------------------------------

const ICON: Record<string, string> = {
  wildfire: '🔥',
  flood: '🌊',
  fault: '🌎',
  liquefaction: '💧',
  landslide: '⛰️',
  dam: '🏞️',
  debris_flow: '🪨',
  fire_stations: '🚒',
  hospitals: '🏥',
  police_stations: '🚓',
  parks: '🌳',
  libraries: '📚',
};

const HEADLINE = [
  'Your address is not in a mapped hazard zone',
  'Your address has a low mapped risk',
  'Your address has a moderate mapped risk',
  'Your address is in a high-risk zone',
];

export function RisksScreen({ plan, done }: { plan: Plan; done: Set<string> }) {
  const a = plan.assessment;
  const c = levelColor[a.overall_level];
  const sorted = [...a.hazards].sort((x, y) => y.level - x.level);
  const nowSteps = plan.steps.filter((st) => st.priority === 'now');
  const nowDone = nowSteps.filter((st) => done.has(st.id)).length;
  return (
    <ScrollView contentContainerStyle={scroll}>
      <P style={{ fontSize: 14 }}>{a.neighborhood ? `${a.neighborhood} · ` : ''}Glendale</P>
      <H1 style={{ fontSize: 24 }}>{a.address.split(',')[0]}</H1>

      <Card style={{ backgroundColor: c.bg, borderColor: c.bg }}>
        <Text style={{ color: c.fg, fontWeight: '800', fontSize: 13, letterSpacing: 1 }}>
          OVERALL · {c.label.toUpperCase()}
        </Text>
        <Text style={{ color: C.ink, fontSize: 20, fontWeight: '800', marginTop: 4 }}>
          {HEADLINE[a.overall_level]}
        </Text>
        <P style={{ marginTop: 6, color: C.ink }}>
          {nowDone}/{nowSteps.length} urgent steps done. Every home in Glendale should prepare for
          earthquakes.
        </P>
      </Card>

      <H2 style={{ marginTop: 8 }}>Hazards at your address</H2>
      {sorted.map((hz) => (
        <Card key={hz.key}>
          <View style={[s.row, { justifyContent: 'space-between', marginBottom: 6 }]}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: C.ink, flex: 1 }}>
              {ICON[hz.key]} {hz.label}
            </Text>
            <Badge level={hz.level} />
          </View>
          <P>{hz.summary}</P>
          <Text style={{ fontSize: 12, color: '#A8A29E', marginTop: 6 }}>Source: {hz.source}</Text>
        </Card>
      ))}

      <H2 style={{ marginTop: 8 }}>Nearest help</H2>
      <Card>
        {a.resources.map((r, i) => (
          <View
            key={r.kind + i}
            style={[
              s.row,
              { paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: C.line },
            ]}>
            <Text style={{ fontSize: 22, width: 36 }}>{ICON[r.kind] ?? '📍'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: C.ink }}>{r.name}</Text>
              <Text style={{ fontSize: 13, color: C.sub }}>{r.title}</Text>
            </View>
            <Text style={{ fontSize: 14, color: C.sub }}>{miles(r.distance_m)}</Text>
          </View>
        ))}
        <Text style={{ fontSize: 12, color: '#A8A29E', marginTop: 6 }}>
          Straight-line distance. Source: City of Glendale GIS.
        </Text>
      </Card>
      <P style={{ fontSize: 12, marginTop: 4 }}>
        Hazard maps are regulatory zones, not a site inspection. Being outside a zone does not
        mean there is no risk.
      </P>
    </ScrollView>
  );
}

const miles = (m: number) => `${(m / 1609).toFixed(1)} mi`;

// --------------------------------------------------------------------------------------------
// Plan
// --------------------------------------------------------------------------------------------

const GROUPS: [Step['priority'], string][] = [
  ['now', 'Do first'],
  ['week', 'This week'],
  ['month', 'This month'],
];

export function PlanScreen({
  plan,
  done,
  toggle,
}: {
  plan: Plan;
  done: Set<string>;
  toggle: (id: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const pct = Math.round((100 * plan.steps.filter((st) => done.has(st.id)).length) / plan.steps.length);
  return (
    <ScrollView contentContainerStyle={scroll}>
      <H1>Your plan</H1>
      <P>Made for your address and household. Tap a step to see why it matters.</P>

      <View style={{ height: 10, backgroundColor: C.line, borderRadius: 5, marginTop: 14 }}>
        <View style={{ height: 10, width: `${pct}%`, backgroundColor: C.ok, borderRadius: 5 }} />
      </View>
      <Text style={{ color: C.sub, marginTop: 6, marginBottom: 8 }}>{pct}% ready</Text>

      <ListenButton text={plan.speech} />

      {GROUPS.map(([p, title]) => {
        const items = plan.steps.filter((st) => st.priority === p);
        if (!items.length) return null;
        return (
          <View key={p} style={{ marginTop: 16 }}>
            <H2>{title}</H2>
            {items.map((st) => {
              const isDone = done.has(st.id);
              return (
                <Card key={st.id} style={isDone ? { opacity: 0.6 } : undefined}>
                  <View style={s.row}>
                    <Pressable
                      onPress={() => toggle(st.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isDone }}
                      accessibilityLabel={st.title}
                      hitSlop={10}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        borderWidth: 2,
                        borderColor: isDone ? C.ok : C.line,
                        backgroundColor: isDone ? C.ok : '#fff',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                      }}>
                      {isDone && <Text style={{ color: '#fff', fontWeight: '900' }}>✓</Text>}
                    </Pressable>
                    <Pressable style={{ flex: 1 }} onPress={() => setOpen(open === st.id ? null : st.id)}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: '700',
                          color: C.ink,
                          textDecorationLine: isDone ? 'line-through' : 'none',
                        }}>
                        {st.title}
                      </Text>
                    </Pressable>
                  </View>
                  {open === st.id && (
                    <View style={{ marginTop: 10, marginLeft: 40 }}>
                      <P>{st.detail}</P>
                      <Text style={{ marginTop: 8, fontSize: 14, color: C.ink }}>
                        <Text style={{ fontWeight: '700' }}>Why for you: </Text>
                        {st.why}
                      </Text>
                      <Pressable onPress={() => Linking.openURL(st.source.url)}>
                        <Text style={{ color: C.brand, marginTop: 8, fontWeight: '600' }}>
                          Source: {st.source.name} ↗
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
        );
      })}
    </ScrollView>
  );
}

function ListenButton({ text }: { text: string }) {
  const player = useRef<AudioPlayer | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [err, setErr] = useState('');

  useEffect(() => () => player.current?.remove(), []);

  async function onPress() {
    setErr('');
    if (state === 'playing') {
      player.current?.pause();
      setState('idle');
      return;
    }
    setState('loading');
    try {
      await setAudioModeAsync({ playsInSilentMode: true });
      const url = await speak(text);
      player.current?.remove();
      player.current = createAudioPlayer({ uri: url });
      player.current.addListener('playbackStatusUpdate', (st) => {
        if (st.didJustFinish) setState('idle');
      });
      player.current.play();
      setState('playing');
    } catch (e: any) {
      setErr(e.message ?? 'Could not play audio');
      setState('idle');
    }
  }

  return (
    <>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={{
          backgroundColor: C.ink,
          borderRadius: 14,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
        {state === 'loading' ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ fontSize: 22, color: '#fff' }}>{state === 'playing' ? '⏸' : '🔊'}</Text>
        )}
        <View style={{ marginLeft: 12 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
            {state === 'playing' ? 'Pause' : 'Listen to my plan'}
          </Text>
          <Text style={{ color: '#D6D3D1', fontSize: 13 }}>Read aloud with ElevenLabs</Text>
        </View>
      </Pressable>
      {!!err && <Text style={{ color: '#B91C1C', marginTop: 6 }}>{err}</Text>}
    </>
  );
}

// --------------------------------------------------------------------------------------------
// Neighbors
// --------------------------------------------------------------------------------------------

const KIND: Record<Post['kind'], string> = {
  offer: '🤝 Offer',
  request: '🙋 Request',
  checkin: '✅ Check-in',
  tip: '💡 Tip',
};

export function NeighborsScreen({ plan, done }: { plan: Plan; done: Set<string> }) {
  const hood = plan.assessment.neighborhood ?? 'Glendale';
  const [data, setData] = useState<Community | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [text, setText] = useState('');
  const [kind, setKind] = useState<Post['kind']>('offer');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'can_help' | 'needs_help' | 'both'>('can_help');
  const [joined, setJoined] = useState(false);

  async function load() {
    setLoading(true);
    setErr('');
    try {
      setData(await getCommunity(hood));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [hood]);

  async function join() {
    await joinCommunity({
      name: name.trim(),
      neighborhood: hood,
      role,
      skills: [],
      note: '',
      has_plan: done.size > 0,
      has_go_bag: done.has('gobag'),
    });
    setJoined(true);
    load();
  }

  async function send() {
    await addPost({ neighborhood: hood, author: name.trim() || 'A neighbor', kind, text: text.trim() });
    setText('');
    load();
  }

  const r = data?.readiness;
  return (
    <ScrollView
      contentContainerStyle={scroll}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <H1>{hood} neighbors</H1>
      <P>Prepare together. Neighbors are often the first help after a disaster.</P>
      {!!err && <Text style={{ color: '#B91C1C', marginTop: 8 }}>{err}</Text>}

      {r && (
        <Card style={{ marginTop: 14, backgroundColor: C.brandSoft, borderColor: C.brandSoft }}>
          <Text style={{ fontWeight: '800', color: C.brand, fontSize: 13, letterSpacing: 1 }}>
            BLOCK READINESS
          </Text>
          <Text style={{ fontSize: 40, fontWeight: '900', color: C.ink }}>{r.score}%</Text>
          <P style={{ color: C.ink }}>
            {r.with_plan} of {r.households} households have a plan · {r.with_go_bag} have a go-bag
          </P>
        </Card>
      )}

      {!joined && (
        <Card>
          <H2>Join your neighbor network</H2>
          <P>Only your first name and neighborhood are shown. Never your address.</P>
          <TextInput
            style={[s.input, { marginTop: 10 }]}
            placeholder="First name"
            placeholderTextColor="#A8A29E"
            value={name}
            onChangeText={setName}
          />
          <View style={[s.wrap, { marginTop: 10 }]}>
            <Chip label="I can help" active={role === 'can_help'} onPress={() => setRole('can_help')} />
            <Chip label="I may need help" active={role === 'needs_help'} onPress={() => setRole('needs_help')} />
            <Chip label="Both" active={role === 'both'} onPress={() => setRole('both')} />
          </View>
          <Button title="Join" disabled={!name.trim()} onPress={join} />
        </Card>
      )}

      <H2 style={{ marginTop: 8 }}>Buddies nearby</H2>
      {data?.neighbors.map((n) => (
        <Card key={n.id}>
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink }}>{n.name}</Text>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: n.role === 'needs_help' ? '#B91C1C' : C.ok,
              }}>
              {n.role === 'needs_help' ? 'May need help' : n.role === 'both' ? 'Helps & may need help' : 'Can help'}
            </Text>
          </View>
          {!!n.note && <P style={{ marginTop: 4 }}>{n.note}</P>}
          {!!n.skills.length && (
            <View style={[s.wrap, { marginTop: 8 }]}>
              {n.skills.map((sk) => (
                <View key={sk} style={{ backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginRight: 6, marginBottom: 6 }}>
                  <Text style={{ fontSize: 13, color: C.ink }}>{sk}</Text>
                </View>
              ))}
            </View>
          )}
          <Text style={{ fontSize: 13, color: C.sub, marginTop: 6 }}>
            {n.has_plan ? '✓ Has plan' : '○ No plan yet'} · {n.has_go_bag ? '✓ Go-bag' : '○ No go-bag'}
          </Text>
        </Card>
      ))}

      <H2 style={{ marginTop: 8 }}>Neighbor board</H2>
      <Card>
        <View style={s.wrap}>
          {(Object.keys(KIND) as Post['kind'][]).map((k) => (
            <Chip key={k} label={KIND[k]} active={kind === k} onPress={() => setKind(k)} />
          ))}
        </View>
        <TextInput
          style={[s.input, { minHeight: 70 }]}
          multiline
          placeholder="Offer help, ask for supplies, share a prep tip…"
          placeholderTextColor="#A8A29E"
          value={text}
          onChangeText={setText}
        />
        <Button title="Post" disabled={!text.trim()} onPress={send} />
        <Text style={{ fontSize: 12, color: C.sub, marginTop: 8 }}>
          For emergencies call 911. Evacuation orders come only from official alerts, not this board.
        </Text>
      </Card>
      {data?.posts.map((p) => (
        <Card key={p.id}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: C.brand }}>{KIND[p.kind]}</Text>
          <Text style={{ fontSize: 16, color: C.ink, marginTop: 4 }}>{p.text}</Text>
          <Text style={{ fontSize: 13, color: C.sub, marginTop: 6 }}>
            {p.author} · {ago(p.ts)}
          </Text>
        </Card>
      ))}
    </ScrollView>
  );
}

function ago(ts: number) {
  const m = Math.max(1, Math.round((Date.now() / 1000 - ts) / 60));
  return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`;
}

// --------------------------------------------------------------------------------------------
// Official info
// --------------------------------------------------------------------------------------------

const OFFICIAL: [string, string, string][] = [
  ['Alert LA County', 'Emergency alerts and evacuation orders for your address', 'https://ready.lacounty.gov/alert-la-county/'],
  ['Ready LA County', 'County preparedness guides in many languages', 'https://ready.lacounty.gov'],
  ['Cal OES', 'California Governor’s Office of Emergency Services', 'https://www.caloes.ca.gov'],
  ['MyShake', 'Earthquake early warning app from Cal OES', 'https://myshake.berkeley.edu'],
  ['American Red Cross', 'How to prepare, shelters and recovery help', 'https://www.redcross.org/get-help/how-to-prepare-for-emergencies.html'],
  ['CAL FIRE Ready for Wildfire', 'Defensible space and evacuation checklists', 'https://www.readyforwildfire.org'],
  ['City of Glendale', 'City services, including the Glendale Fire Department', 'https://www.glendaleca.gov'],
];

export function InfoScreen({ onEdit, onReset }: { onEdit: () => void; onReset: () => void }) {
  return (
    <ScrollView contentContainerStyle={scroll}>
      <Card style={{ backgroundColor: '#FDE2E2', borderColor: '#FDE2E2' }}>
        <Text style={{ fontSize: 20, fontWeight: '900', color: '#B91C1C' }}>Emergency? Call 911.</Text>
        <P style={{ color: C.ink, marginTop: 4 }}>
          If you are told to evacuate, go right away. This app helps you prepare before an
          emergency. It does not show live fires or evacuation orders.
        </P>
      </Card>
      <H1 style={{ fontSize: 24 }}>Trusted sources</H1>
      <P>Official information only. All guidance in your plan links back to one of these.</P>
      <View style={{ marginTop: 12 }}>
        {OFFICIAL.map(([name, desc, url]) => (
          <Pressable key={name} onPress={() => Linking.openURL(url)}>
            <Card>
              <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink }}>{name} ↗</Text>
              <P style={{ fontSize: 14 }}>{desc}</P>
            </Card>
          </Pressable>
        ))}
      </View>
      <Button title="Edit my home & household" kind="ghost" onPress={onEdit} />
      <Button title="Start over" kind="ghost" onPress={onReset} />
    </ScrollView>
  );
}
