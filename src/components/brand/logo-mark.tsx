import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { buildLogoSvg } from '@/components/brand/logo-svg';
import { APP_NAME } from '@/constants/brand';

const LOGO_XML = buildLogoSvg();

export function LogoMark({ size = 72 }: { size?: number }) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`${APP_NAME} logo`}>
      <SvgXml xml={LOGO_XML} width={size} height={size} />
    </View>
  );
}
