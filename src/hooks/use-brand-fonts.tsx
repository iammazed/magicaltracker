import { BerkshireSwash_400Regular } from '@expo-google-fonts/berkshire-swash/400Regular';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Pacifico_400Regular } from '@expo-google-fonts/pacifico/400Regular';
import { useFonts } from 'expo-font';
import { createContext, useContext } from 'react';

/**
 * The three wordmark faces.
 *
 * Loaded at runtime rather than through the `expo-font` config plugin: the
 * plugin needs a prebuild, so plugin-bundled fonts are simply absent in Expo
 * Go and the wordmark would silently fall back to the system face.
 *
 * Imported from the per-weight subpaths, not the package roots. Each package's
 * index.js `require`s every weight it ships, so importing from the root makes
 * Metro bundle all of them — about 800 KB of Figtree the app never renders.
 *
 * **Nothing gates rendering on this.** An earlier version refused to render
 * the navigator until the fonts resolved, which turned any font failure into a
 * black screen with no error — the splash had already been dismissed, so there
 * was nothing left to look at. Fonts are decoration; the app is not. The
 * wordmark falls back to the system face for the frame or two before they
 * arrive, and keeps working forever if they never do.
 */

type BrandFonts = { ready: boolean; error: Error | null };

const BrandFontsContext = createContext<BrandFonts>({ ready: false, error: null });

export function BrandFontsProvider({ children }: { children: React.ReactNode }) {
  const [loaded, error] = useFonts({
    BerkshireSwash_400Regular,
    Pacifico_400Regular,
    Figtree_600SemiBold,
  });

  return (
    <BrandFontsContext.Provider value={{ ready: loaded, error: error ?? null }}>
      {children}
    </BrandFontsContext.Provider>
  );
}

/** `ready` is false until the faces are registered. Ask before naming one in
 *  a `fontFamily`, so an unregistered family is never referenced. */
export function useBrandFonts(): BrandFonts {
  return useContext(BrandFontsContext);
}
