import AppTabs from '@/components/app-tabs';

/**
 * Tab navigator. Routes in this group get a tab only if they have a matching
 * `NativeTabs.Trigger` in `src/components/app-tabs.tsx`.
 *
 * Screens that should push OVER the tabs (detail screens, modals, /theme) live
 * outside this group, as siblings in `src/app/`, and are declared on the root
 * Stack in `src/app/_layout.tsx`.
 */
export default function TabsLayout() {
  return <AppTabs />;
}
