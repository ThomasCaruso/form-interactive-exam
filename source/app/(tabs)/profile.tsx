import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { signInAvailable, useAuth } from '../../src/auth/client';
import { ContextSheet } from '../../src/components/ContextSheet';
import { EditorialScreen, editorial } from '../../src/components/Editorial';
import { FormIcon } from '../../src/components/FormIcon';
import { GlassSurface } from '../../src/components/GlassSurface';
import { DaySheet } from '../../src/components/plan/DaySheet';
import { YourWeek } from '../../src/components/plan/YourWeek';
import { MotionPressable } from '../../src/components/MotionPressable';
import { onboardingPalette } from '../../src/data/onboarding';
import { formatMoney } from '../../src/domain/selectors';
import { colorMatches } from '../../src/domain/styleBrief';
import type { DayKey, ProfileSection } from '../../src/domain/types';
import { useToday } from '../../src/hooks/useToday';
import { useFormStore } from '../../src/state/store';
import { colors } from '../../src/theme/tokens';
import { family } from '../../src/theme/typography';

export default function ProfileScreen() {
  const router = useRouter();
  const profile = useFormStore(s => s.profile);
  const signedIn = useAuth(s => !!s.session);
  const [sheet, setSheet] = useState<'preferences' | 'account' | null>(null);
  const [day, setDay] = useState<DayKey | null>(null);
  const today = useToday();
  const brief = profile.styleBrief?.trim();
  const visible = (section: ProfileSection) => !profile.hiddenProfileSections?.includes(section);
  const edit = (section?: ProfileSection) => { setSheet(null); router.push({ pathname: '/edit-profile', params: section ? { section } : {} }); };
  const summary = [visible('direction') ? profile.styles.join(' · ') : '', visible('budget') ? 'Up to ' + formatMoney(profile.budgetCents) + ' per look' : ''].filter(Boolean).join(' · ');
  const palette = onboardingPalette.filter(item => profile.favoriteColors?.some(color => colorMatches(color, item.value)));
  return <EditorialScreen>
    <View style={styles.masthead}><Text style={styles.wordmark}>FORM / YOU</Text><MotionPressable accessibilityRole="button" accessibilityLabel="Customize You" onPress={() => router.push('/customize-profile')} style={styles.more}><FormIcon name="more" size={20} color={colors.ink2} /></MotionPressable></View>
    <View style={styles.identity}><Text accessibilityRole="header" style={styles.name}>{profile.name.trim() || 'Your FORM'}.</Text><Text style={styles.subline}>Your taste shapes what we find.</Text></View>

    {visible('week') && <YourWeek today={today} onOpenDay={setDay} onMonth={() => router.push('/plan')} />}

    <GlassSurface quiet style={styles.note}>
      <Text style={styles.noteLabel}>Your style brief</Text>
      <Text numberOfLines={5} style={styles.brief}>{brief || 'A little more you.'}</Text>
      <Text style={styles.invitation}>{brief ? 'This guides your next outfit suggestions. Edit it whenever your style changes.' : 'Tell FORM what you love and what you avoid. Your words guide the next selection.'}</Text>
      <MotionPressable accessibilityRole="button" accessibilityLabel={brief ? 'Edit my style brief' : 'Personalize my style'} onPress={() => router.push('/edit-style-brief')} style={styles.noteAction}><Text style={styles.primaryText}>{brief ? 'Edit my style brief' : 'Personalize my style'}</Text><FormIcon name="arrow" size={16} color={colors.paper} /></MotionPressable>
    </GlassSurface>

    <View style={styles.links}>
      <MotionPressable accessibilityRole="button" accessibilityLabel="Open your Try On studio" onPress={() => router.navigate('/tryon')} style={styles.link}><View style={{ flex: 1 }}><Text style={styles.linkTitle}>Your Try On studio</Text><Text style={styles.linkDetail}>Your photos, proportions and the way you like clothes to feel</Text></View><FormIcon name="chevron" size={16} color={colors.muted} /></MotionPressable>
      <MotionPressable accessibilityRole="button" accessibilityLabel="Open your preferences" onPress={() => setSheet('preferences')} style={styles.link}><View style={{ flex: 1 }}><Text style={styles.linkTitle}>Your preferences</Text><Text numberOfLines={2} style={styles.linkDetail}>{summary || 'Colors, brands, budget and fit—yours to adjust'}</Text></View><FormIcon name="chevron" size={16} color={colors.muted} /></MotionPressable>
      <MotionPressable accessibilityRole="button" accessibilityLabel="Open your saved collection" onPress={() => router.navigate('/saved')} style={[styles.link, styles.linkBorder]}><Text style={[styles.linkTitle, { flex: 1 }]}>Your collection</Text><FormIcon name="chevron" size={16} color={colors.muted} /></MotionPressable>
    </View>
    <MotionPressable accessibilityRole="button" onPress={() => setSheet('account')} style={styles.account}><Text style={styles.accountText}>Account & privacy</Text></MotionPressable>

    <ContextSheet visible={sheet === 'preferences'} title="Your preferences" onClose={() => setSheet(null)}>
      <Text style={editorial.secondary}>Already part of your selection. Change something whenever you want.</Text>
      {visible('direction') && <MotionPressable accessibilityRole="button" accessibilityLabel="Edit your style direction, colors and brands" onPress={() => edit('direction')} style={styles.sheetRow}><View style={{ flex: 1 }}><Text style={styles.linkTitle}>Style & palette</Text><Text style={styles.linkDetail}>{profile.styles.join(' · ') || 'Open to discovery'}</Text><View style={styles.palette}>{palette.map(item => <View key={item.name} accessible accessibilityLabel={item.name} style={[styles.swatch, { backgroundColor: item.hex }]} />)}</View><Text style={styles.linkDetail}>{profile.favoriteColors?.join(' · ') || 'Open to every color'}</Text><Text style={styles.linkDetail}>{profile.brands.length ? profile.brands.join(' · ') : 'Open to every brand'}</Text>{!!profile.avoidedColors?.length && <Text style={styles.linkDetail}>Avoiding {profile.avoidedColors.join(', ')}</Text>}{!!profile.avoidedBrands?.length && <Text style={styles.linkDetail}>Avoiding {profile.avoidedBrands.join(', ')}</Text>}</View><FormIcon name="chevron" size={16} color={colors.muted} /></MotionPressable>}
      {visible('budget') && <MotionPressable accessibilityRole="button" accessibilityLabel="Edit outfit budget" onPress={() => edit('budget')} style={styles.sheetRow}><View style={{ flex: 1 }}><Text style={styles.linkTitle}>Spending comfort</Text><Text style={styles.linkDetail}>{formatMoney(profile.budgetCents)} for a complete look</Text></View><FormIcon name="chevron" size={16} color={colors.muted} /></MotionPressable>}
      {visible('fit') && <MotionPressable accessibilityRole="button" accessibilityLabel="Edit sizes and measurements" onPress={() => edit('fit')} style={styles.sheetRow}><View style={{ flex: 1 }}><Text style={styles.linkTitle}>Fit & sizes</Text><Text style={styles.linkDetail}>{[profile.height, profile.topSize && 'Top ' + profile.topSize, profile.waist && 'Waist ' + profile.waist, profile.inseam && 'Inseam ' + profile.inseam, profile.shoe && 'Shoe ' + profile.shoe].filter(Boolean).join(' · ') || 'Optional, whenever you’re ready'}</Text></View><FormIcon name="chevron" size={16} color={colors.muted} /></MotionPressable>}
      <View style={styles.sheetFooter}><MotionPressable accessibilityRole="button" onPress={() => edit()} style={styles.quietButton}><Text style={styles.accountText}>All preferences</Text></MotionPressable><MotionPressable accessibilityRole="button" onPress={() => { setSheet(null); router.push('/customize-profile'); }} style={styles.quietButton}><Text style={styles.accountText}>Customize this space</Text></MotionPressable></View>
    </ContextSheet>
    <DaySheet day={day} today={today} onClose={() => setDay(null)} />
    <ContextSheet visible={sheet === 'account'} title="Your FORM, your control" onClose={() => setSheet(null)}>
      <Text style={editorial.body}>{signedIn ? 'You’re signed in.' : 'You’re using FORM on this device.'}</Text>
      <Text style={styles.linkTitle}>Kept on this device</Text><Text style={editorial.secondary}>Your style brief, preferences, saved collection, personal fitting details and photos are stored locally. They aren’t synced between devices. Requesting an AI try-on preview shares the selected photos with your connected image studio.</Text>
      <Text style={editorial.secondary}>The current stylist matches supported words in your brief to catalog attributes. A cloud AI stylist is not connected, and your brief isn’t sent to an AI service.</Text>
      {(signedIn || signInAvailable) && <MotionPressable accessibilityRole="button" onPress={() => { setSheet(null); router.push('/login'); }} style={styles.accountAction}><Text style={styles.actionText}>{signedIn ? 'Manage account' : 'Sign in options'}</Text><FormIcon name="arrow" size={17} color={colors.ink2} /></MotionPressable>}
    </ContextSheet>
  </EditorialScreen>;
}
const styles = StyleSheet.create({
  masthead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, wordmark: { fontFamily: family.sans, fontSize: 10, letterSpacing: 2.4, color: colors.muted }, more: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  identity: { marginTop: 12, marginBottom: 22, paddingHorizontal: 6 }, name: { fontFamily: family.serif, fontSize: 38, lineHeight: 45, letterSpacing: -0.8, color: colors.ink }, subline: { fontFamily: family.sans, fontSize: 13, lineHeight: 21, color: colors.muted, marginTop: 8 },
  note: { paddingHorizontal: 8, paddingTop: 25, paddingBottom: 8, borderRadius: 4 }, noteLabel: { fontFamily: family.sans, fontSize: 12, lineHeight: 19, color: colors.muted }, brief: { fontFamily: family.serif, fontSize: 23, lineHeight: 29, color: colors.ink, marginTop: 10 }, invitation: { fontFamily: family.sans, fontSize: 13, lineHeight: 21, color: colors.muted, marginTop: 10 }, noteAction: { minHeight: 48, alignSelf: 'flex-start', marginTop: 16, paddingHorizontal: 15, borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 20, backgroundColor: colors.ink }, primaryText: { fontFamily: family.sansMedium, fontSize: 13, color: colors.paper }, actionText: { fontFamily: family.sansMedium, fontSize: 12, color: colors.ink2 },
  links: { marginTop: 18, paddingHorizontal: 6 }, link: { minHeight: 72, paddingVertical: 18, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 20, borderRadius: 4 }, linkBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }, linkTitle: { fontFamily: family.sans, fontSize: 14, lineHeight: 22, color: colors.ink2 }, linkDetail: { fontFamily: family.sans, fontSize: 11, lineHeight: 18, color: colors.muted, marginTop: 6 }, account: { minHeight: 48, alignSelf: 'flex-start', marginTop: 23, paddingHorizontal: 14, justifyContent: 'center' }, accountText: { fontFamily: family.sans, fontSize: 11, lineHeight: 18, color: colors.muted },
  sheetRow: { minHeight: 70, paddingHorizontal: 12, paddingVertical: 14, borderRadius: 4, flexDirection: 'row', alignItems: 'center', gap: 16 }, palette: { flexDirection: 'row', gap: 7, marginTop: 14, marginBottom: 3 }, swatch: { width: 20, height: 20, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line2 }, sheetFooter: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }, quietButton: { minHeight: 48, paddingHorizontal: 12, justifyContent: 'center' }, accountAction: { minHeight: 48, paddingHorizontal: 18, borderRadius: 24, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.card },
});
