import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { NO_FILTERS, type VenueFilters } from '@/hooks/use-venues';

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
  /** Price is multi-select — "$ or $$" is a question people actually ask. */
  togglePrice: (tier: number) => void;
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

  const togglePrice = useCallback(
    (tier: number) =>
      setFilters((f) => ({
        ...f,
        priceTiers: f.priceTiers.includes(tier)
          ? f.priceTiers.filter((t) => t !== tier)
          : [...f.priceTiers, tier].sort(),
      })),
    [],
  );

  const clear = useCallback(
    () => setFilters((f) => ({ ...NO_FILTERS, search: f.search, areaId: f.areaId })),
    [],
  );

  const value = useMemo(
    () => ({ filters, set, togglePrice, clear }),
    [filters, set, togglePrice, clear],
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
