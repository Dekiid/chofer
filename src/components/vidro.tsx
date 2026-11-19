import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { usePalette } from '@/constants/use-palette';

type Props = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Reage ao toque (botões), como no iOS. */
  interativo?: boolean;
  onLayout?: ViewProps['onLayout'];
  pointerEvents?: ViewProps['pointerEvents'];
};

// O vidro nativo só existe no iOS 26 ou mais recente; nos outros casos imita-se com translucidez e desfoque.
const NATIVO = Platform.OS === 'ios' && isLiquidGlassAvailable();

/** Superfície em vidro (liquid glass). */
export function Vidro({ children, style, interativo, onLayout, pointerEvents }: Props) {
  const c = usePalette();
  if (NATIVO) {
    return (
      <GlassView glassEffectStyle="regular" isInteractive={interativo} style={style} onLayout={onLayout} pointerEvents={pointerEvents}>
        {children}
      </GlassView>
    );
  }
  return (
    <View
      onLayout={onLayout}
      pointerEvents={pointerEvents}
      style={[
        { backgroundColor: c.vidro, borderWidth: StyleSheet.hairlineWidth, borderColor: c.vidroBorda },
        Platform.OS === 'web' && ({ backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)' } as ViewStyle),
        style,
      ]}>
      {children}
    </View>
  );
}
