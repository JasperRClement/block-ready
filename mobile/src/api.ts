import Constants from 'expo-constants';

// In Expo Go the laptop's address is known from the dev server; the backend runs on port 8000
// of the same machine. Override with EXPO_PUBLIC_API_URL if the backend lives elsewhere.
const host =
  Constants.expoConfig?.hostUri?.split(':')[0] ??
  (typeof window !== 'undefined' && window.location?.hostname) ??
  'localhost';
export const API = process.env.EXPO_PUBLIC_API_URL ?? `http://${host}:8000`;

export type Level = 0 | 1 | 2 | 3;

export type Hazard = {
  key: string;
  label: string;
  status: string;
  level: Level;
  level_name: string;
  summary: string;
  source: string;
  disclaimer: string;
};

export type Resource = {
  kind: string;
  title: string;
  name: string | null;
  address: string | null;
  distance_m: number;
};

export type Assessment = {
  address: string;
  lat: number;
  lon: number;
  in_city: boolean;
  neighborhood: string | null;
  overall_level: Level;
  overall_name: string;
  hazards: Hazard[];
  resources: Resource[];
};

export type Source = { name: string; url: string };

export type Step = {
  id: string;
  title: string;
  detail: string;
  why: string;
  priority: 'now' | 'week' | 'month';
  category: string;
  source: Source;
};

export type Household = {
  housing: 'house' | 'apartment' | 'mobile_home' | 'other';
  floor: number;
  renter: boolean;
  adults: number;
  kids: number;
  seniors: number;
  mobility_needs: boolean;
  power_dependent_medical: boolean;
  daily_medications: boolean;
  hearing_or_vision_needs: boolean;
  dogs: number;
  cats: number;
  other_pets: boolean;
  has_car: boolean;
  language: string;
  has_smartphone: boolean;
};

export const defaultHousehold: Household = {
  housing: 'house',
  floor: 1,
  renter: false,
  adults: 1,
  kids: 0,
  seniors: 0,
  mobility_needs: false,
  power_dependent_medical: false,
  daily_medications: false,
  hearing_or_vision_needs: false,
  dogs: 0,
  cats: 0,
  other_pets: false,
  has_car: true,
  language: 'English',
  has_smartphone: true,
};

export type Plan = { assessment: Assessment; steps: Step[]; speech: string };

export type Neighbor = {
  id: string;
  name: string;
  neighborhood: string;
  role: 'can_help' | 'needs_help' | 'both';
  skills: string[];
  note: string;
  has_plan: boolean;
  has_go_bag: boolean;
};

export type Post = {
  id: string;
  neighborhood: string;
  author: string;
  kind: 'offer' | 'request' | 'checkin' | 'tip';
  text: string;
  ts: number;
};

export type Community = {
  neighborhood: string;
  neighbors: Neighbor[];
  posts: Post[];
  readiness: { households: number; with_plan: number; with_go_bag: number; score: number };
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(API + path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!r.ok) {
    let msg = `Server error ${r.status}`;
    try {
      msg = (await r.json()).detail ?? msg;
    } catch {}
    throw new Error(msg);
  }
  return r.json();
}

export const getPlan = (address: string, household: Household) =>
  call<Plan>('/api/plan', { method: 'POST', body: JSON.stringify({ address, household }) });

export const getCommunity = (neighborhood: string) =>
  call<Community>(`/api/community?neighborhood=${encodeURIComponent(neighborhood)}`);

export const joinCommunity = (n: Omit<Neighbor, 'id'>) =>
  call<Neighbor>('/api/community/join', { method: 'POST', body: JSON.stringify(n) });

export const addPost = (p: Omit<Post, 'id' | 'ts'>) =>
  call<Post>('/api/community/post', { method: 'POST', body: JSON.stringify(p) });

export const speak = async (text: string) => {
  const { audio_url } = await call<{ audio_url: string }>('/api/speak', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  return API + audio_url;
};
