/**
 * Design token reference — a dev screen, not a product screen.
 *
 * Renders every token in `Colors` against the ACTIVE scheme. Flip the phone
 * between light and dark (Control Center) to check both.
 *
 * Tokens are grouped below for ordering and labels. Any token missing from a
 * group is surfaced in an "ungrouped" warning block, so a new token added to
 * `theme.ts` can never silently go unreviewed.
 */

import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

type Group = {
  title: string;
  note: string;
  tokens: ThemeColor[];
  /** Token to render sample text in, on top of each swatch. */
  sampleOn?: ThemeColor;
};

const GROUPS: Group[] = [
  {
    title: 'Text',
    note: 'Three tiers. Deep slate-teal, never pure black.',
    tokens: ['text', 'textSecondary', 'textFaint'],
  },
  {
    title: 'Surfaces',
    note: 'Tinted ground, cards floating above it.',
    tokens: ['background', 'backgroundElement', 'backgroundSelected'],
  },
  {
    title: 'Borders',
    note: 'borderSoft for internal rules, border for container edges.',
    tokens: ['border', 'borderSoft'],
  },
  {
    title: 'Action',
    note: 'Primary buttons and links. Text on accent uses onAccent.',
    tokens: ['accent', 'accentPressed', 'onAccent'],
    sampleOn: 'onAccent',
  },
  {
    title: 'Reward',
    note: 'Achievement unlocks and premium. The warm note the ramp lacks.',
    tokens: ['gold', 'goldSurface'],
  },
  {
    title: 'Semantic',
    note: 'Outside the brand ramp on purpose — a delete confirm must not read as premium.',
    tokens: ['success', 'warning', 'danger'],
  },
  {
    title: 'Brand ramp',
    note: 'Ordered teal → violet. Index into BrandRamp for sequential things. White text only.',
    tokens: ['brandTeal', 'brandTealDeep', 'brandBlue', 'brandNavy', 'brandIndigo', 'brandViolet'],
  },
];

const ALL_TOKENS = Object.keys(Colors.light) as ThemeColor[];
const GROUPED = new Set(GROUPS.flatMap((g) => g.tokens));
const UNGROUPED = ALL_TOKENS.filter((t) => !GROUPED.has(t));

function Swatch({ token, sampleOn }: { token: ThemeColor; sampleOn?: ThemeColor }) {
  const theme = useTheme();

  return (
    <View style={styles.swatchRow}>
      <View
        style={[
          styles.chip,
          { backgroundColor: theme[token], borderColor: theme.border },
        ]}>
        {sampleOn ? (
          <ThemedText type="small" style={{ color: theme[sampleOn] }}>
            Aa
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.swatchMeta}>
        <ThemedText type="smallBold">{token}</ThemedText>
        <ThemedText type="code" themeColor="textSecondary">
          {theme[token]}
        </ThemedText>
      </View>
    </View>
  );
}

export default function ThemeScreen() {
  const scheme = useColorScheme();
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View>
          <ThemedText type="subtitle">Design tokens</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Active scheme: {scheme}. Flip your phone between light and dark to check both.
          </ThemedText>

          {GROUPS.map((group) => (
            <View key={group.title} style={styles.group}>
              <ThemedText type="smallBold" style={styles.groupTitle}>
                {group.title.toUpperCase()}
              </ThemedText>
              <ThemedText type="small" themeColor="textFaint" style={styles.groupNote}>
                {group.note}
              </ThemedText>
              <View
                style={[
                  styles.card,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                ]}>
                {group.tokens.map((token) => (
                  <Swatch key={token} token={token} sampleOn={group.sampleOn} />
                ))}
              </View>
            </View>
          ))}

          {UNGROUPED.length > 0 ? (
            <View style={styles.group}>
              <ThemedText type="smallBold" themeColor="warning">
                UNGROUPED TOKENS
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.groupNote}>
                Added to theme.ts but not to a group in this screen. Add them to GROUPS so they
                stay reviewed.
              </ThemedText>
              <View
                style={[
                  styles.card,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.warning },
                ]}>
                {UNGROUPED.map((token) => (
                  <Swatch key={token} token={token} />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
    gap: Spacing.two,
  },
  group: {
    marginTop: Spacing.four,
    gap: Spacing.one,
  },
  groupTitle: {
    letterSpacing: 1,
  },
  groupNote: {
    marginBottom: Spacing.two,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.large,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  swatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chip: {
    width: 52,
    height: 40,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchMeta: {
    gap: Spacing.half,
  },
});
