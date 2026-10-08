import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

/** Every column the detail screen shows. */
export type VenueDetail = {
  id: string;
  name: string;
  area_id: string;
  sub_area: string | null;
  resort_id: string | null;
  venue_kind: string;
  service_type: string[];
  dining_style: string[];
  cuisine: string | null;
  price_tier: number;
  reservations_recommended: boolean;
  is_character_dinner_dining: boolean;
  is_character_breakfast_dining: boolean;
  is_signature: boolean;
  status: string;
  lat: number | null;
  lng: number | null;
  dinner_menu_url: string | null;
  lunch_menu_url: string | null;
  breakfast_menu_url: string | null;
  snack_menu_url: string | null;
  lounge_menu_url: string | null;
  description: string | null;
  tags: string[];
  keywords: string[];
};

export type VenueContext = {
  areaName: string | null;
  resortName: string | null;
};

export function useVenue(id: string | undefined) {
  const [venue, setVenue] = useState<VenueDetail | null>(null);
  const [context, setContext] = useState<VenueContext>({
    areaName: null,
    resortName: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: e } = await supabase
          .from('venues')
          .select('*')
          .eq('id', id)
          .single();
        if (e) throw new Error(e.message);
        if (cancelled) return;

        const v = data as unknown as VenueDetail;
        setVenue(v);

        // Resolve the human-readable names in one round trip each, rather
        // than embedding joins the list screen does not need.
        const [area, resort] = await Promise.all([
          supabase.from('areas').select('name').eq('id', v.area_id).maybeSingle(),
          v.resort_id
            ? supabase.from('resorts').select('name').eq('id', v.resort_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        if (cancelled) return;
        setContext({
          areaName: (area.data as { name: string } | null)?.name ?? null,
          resortName: (resort.data as { name: string } | null)?.name ?? null,
        });
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : String(err);
        setError(
          /network|fetch/i.test(raw)
            ? 'Could not reach the server. Check your connection and try again.'
            : raw,
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return { venue, context, loading, error };
}

/** The five meal-period menus, in the order a day happens. */
export function menuLinks(v: VenueDetail): { label: string; url: string }[] {
  const all: { label: string; url: string | null }[] = [
    { label: 'Breakfast', url: v.breakfast_menu_url },
    { label: 'Lunch', url: v.lunch_menu_url },
    { label: 'Dinner', url: v.dinner_menu_url },
    { label: 'Snacks', url: v.snack_menu_url },
    { label: 'Lounge', url: v.lounge_menu_url },
  ];
  return all.filter((m): m is { label: string; url: string } => Boolean(m.url));
}
