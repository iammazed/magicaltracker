import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { NO_FILTERS, type VenueFilters } from '@/hooks/use-venues';

/** The facets that hold a list. Everything else is a single value or a flag. */
type MultiKey = 'kinds' | 'serviceTypes' | 'priceTiers';

/**
 * Catalog filter state, lifted out of the Dining screen.
 *
 * It lives in a provider for two reasons that are really the same reason:
 * the filter sheet is a separate route (expo-router modals are screens, not
 * children, so they cannot read the Dining screen's `useState`), and the list
 * and the map are two views of one filtered set — picking "character dining"
 * on the list and then switching to the map must not silently reset it.
 */

type FiltersValue = {
  filters: VenueFilters;
  set: <K extends keyof VenueFilters>(key: K, value: VenueFilters[K]) => void;
  /**
   * Adds or removes one value from a multi-select facet.
   *
   * One function rather than three near-identical ones, because kind, service
   * type and price now behave identically: pick several, they are OR'd, and
   * picking the last one again empties the facet rather than leaving it stuck
   * on a single value.
   */
  toggle: <K extends MultiKey>(key: K, value: VenueFilters[K][number]) => void;
  /** Leaves `search` alone: clearing refinements should not wipe what someone
   *  typed, because the text field stays visible and would then disagree. */
  clear: () => void;
};

const FiltersContext = createContext<FiltersValue | null>(null);

export function CatalogFiltersProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<VenueFilters>(NO_FILTERS);

  const set = useCallback(
    <K extends keyof VenueFilters>(key: K, value: VenueFilters[K]) =>
      setFilters((f) => ({ ...f, [key]: value })),
    [],
  );

  const toggle = useCallback(
    <K extends MultiKey>(key: K, value: VenueFilters[K][number]) =>
      setFilters((f) => {
        const list = f[key] as readonly (string | number)[];
        const next = list.includes(value)
          ? list.filter((v) => v !== value)
          : [...list, value].sort();
        return { ...f, [key]: next };
      }),
    [],
  );

  const clear = useCallback(
    () => setFilters((f) => ({ ...NO_FILTERS, search: f.search, areaId: f.areaId })),
    [],
  );

  const value = useMemo(
    () => ({ filters, set, toggle, clear }),
    [filters, set, toggle, clear],
  );

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useCatalogFilters(): FiltersValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) {
    throw new Error('useCatalogFilters must be used inside <CatalogFiltersProvider>');
  }
  return ctx;
}
