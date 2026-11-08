/**
 * Une case à cocher avec sa phrase (08/11) : l'accord qu'on coche pour créer
 * un compte ou pour payer (conditions, début immédiat, rétractation). La
 * phrase se lit à côté de la case. Les liens vers les textes se mettent
 * dessous, hors de la case, pour qu'un toucher sur un lien ne la coche pas.
 */
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { F } from '../theme/fonts';
import { T } from './T';
import { Icon } from './Icon';
import { Tap } from './Tap';

export function Accord({ testID, checked, onChange, children }: { testID: string; checked: boolean; onChange: (v: boolean) => void; children: string }) {
  const { c } = useTheme();
  return (
    <Tap
      testID={testID}
      onPress={() => onChange(!checked)}
      feedback="select"
      scaleTo={1}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={children}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: 44 }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          marginTop: 1,
          borderRadius: 7,
          borderWidth: 1.5,
          borderColor: checked ? c.ink : c.control,
          backgroundColor: checked ? c['primary-bg'] : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked && <Icon name="check" size={15} color={c['primary-fg']} strokeWidth={2.4} flat />}
      </View>
      <T v="body" style={{ flex: 1, ...F.s500 }}>
        {children}
      </T>
    </Tap>
  );
}
