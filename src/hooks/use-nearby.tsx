import * as Location from 'expo-location';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

/**
 * Where the user is standing, for the "near me" sort.
 *
 * Premium, and the one feature that is genuinely worth money during a trip
 * week rather than between them.
 *
 * Nothing here runs until the user turns it on. Location is the permission
 * Apple scrutinises hardest under guideline 5.1.1 — every data type requested
 * has to be justified — so it is requested at the point of use, never on
 * launch, and a single foreground reading is taken rather than a watch. The
 * app has no reason to know where someone is while it is closed, and asking
 * for background location would mean a second, much harder permission.
 */

export type NearbyStatus =
  | 'off'
  | 'asking'
  | 'on'
  | 'denied'
  /** Location services are off device-wide, which the user fixes in Settings
   *  rather than in our permission prompt. */
  | 'unavailable';

export type Coords = { latitude: number; longitude: number };

type NearbyValue = {
  status: NearbyStatus;
  coords: Coords | null;
  enabled: boolean;
  /** Asks for permission if needed and takes a reading. */
  enable: () => Promise<boolean>;
  disable: () => void;
  /** Takes a fresh reading. No-op unless already on. */
  refresh: () => Promise<void>;
};

const NearbyContext = createContext<NearbyValue | null>(null);

export function NearbyProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<NearbyStatus>('off');
  const [coords, setCoords] = useState<Coords | null>(null);

  const read = useCallback(async () => {
    const position = await Location.getCurrentPositionAsync({
      // Balanced, not Highest. Sorting a restaurant list needs tens of metres,
      // not centimetres, and Highest spins the GPS far harder on a phone
      // someone is carrying around a theme park all day.
      accuracy: Location.Accuracy.Balanced,
    });
    setCoords({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
  }, []);

  const enable = useCallback(async () => {
    setStatus('asking');
    try {
      if (!(await Location.hasServicesEnabledAsync())) {
        setStatus('unavailable');
        return false;
      }
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) {
        setStatus('denied');
        return false;
      }
      await read();
      setStatus('on');
      return true;
    } catch {
      setStatus('unavailable');
      return false;
    }
  }, [read]);

  const disable = useCallback(() => {
    setStatus('off');
    setCoords(null);
  }, []);

  const refresh = useCallback(async () => {
    if (status !== 'on') return;
    try {
      await read();
    } catch {
      // A failed re-read keeps the last known position, which is far more
      // useful than dropping back to an unsorted list.
    }
  }, [status, read]);

  const value = useMemo<NearbyValue>(
    () => ({
      status,
      coords,
      enabled: status === 'on' && coords != null,
      enable,
      disable,
      refresh,
    }),
    [status, coords, enable, disable, refresh],
  );

  return <NearbyContext.Provider value={value}>{children}</NearbyContext.Provider>;
}

export function useNearby(): NearbyValue {
  const ctx = useContext(NearbyContext);
  if (!ctx) throw new Error('useNearby must be used inside <NearbyProvider>');
  return ctx;
}
