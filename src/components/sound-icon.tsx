import Svg, { Circle, G, Path } from 'react-native-svg';

/** A simple line icon for each soundscape, drawn on a 32×32 grid in the given color. */
export function SoundIcon({ id, color, size = 32 }: { id: string; color: string; size?: number }) {
  const stroke = { stroke: color, strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const cloud = 'M9 20a5 5 0 0 1 1-9.9A7 7 0 0 1 23.5 12 4.5 4.5 0 0 1 23 21H9.5z';

  const glyph = (() => {
    switch (id) {
      case 'rain':
        return (
          <G {...stroke}>
            <Path d={cloud} />
            <Path d="M11 24l-1 3M16 24l-1 3M21 24l-1 3" />
          </G>
        );
      case 'thunderstorm':
        return (
          <G {...stroke}>
            <Path d={cloud} />
            <Path d="M16.5 21l-2.5 4h3.5l-2.5 4" />
          </G>
        );
      case 'ocean':
        return (
          <G {...stroke}>
            <Path d="M4 13c3-3 6-3 9 0s6 3 9 0 4-2 6-1" />
            <Path d="M4 20c3-3 6-3 9 0s6 3 9 0 4-2 6-1" />
          </G>
        );
      case 'lullaby':
        return (
          <G {...stroke}>
            <Path d="M12 23V8l14-3v15" />
            <Circle cx={9} cy={23} r={3} />
            <Circle cx={23} cy={20} r={3} />
          </G>
        );
      case 'wind':
        return (
          <G {...stroke}>
            <Path d="M4 12h15a3.5 3.5 0 1 0-3.5-3.5" />
            <Path d="M4 18h20a3.5 3.5 0 1 1-3.5 3.5" />
            <Path d="M4 24h9" />
          </G>
        );
      case 'fire':
        return (
          <G {...stroke}>
            <Path d="M16 4c1 5 7 7 7 14a7 7 0 0 1-14 0c0-4 2-6 4-8 0 3 1 5 3 5 0-4-1-7 0-11z" />
          </G>
        );
      case 'night':
        return (
          <G {...stroke}>
            <Path d="M19 6a10 10 0 1 0 7 17A8 8 0 0 1 19 6z" />
            <Path d="M7 7v3M5.5 8.5h3" />
          </G>
        );
      case 'fan':
        return (
          <G {...stroke}>
            <Circle cx={16} cy={16} r={2} />
            <Path d="M16 14c-1-5 0-9 3-9s3 6-3 9zM18 16c5-1 9 0 9 3s-6 3-9-3zM16 18c1 5 0 9-3 9s-3-6 3-9zM14 16c-5 1-9 0-9-3s6-3 9 3z" />
          </G>
        );
      case 'brown-noise':
        return (
          <G {...stroke}>
            <Path d="M5 16v0M9 12v8M13 8v16M17 11v10M21 6v20M25 12v8M29 15v2" />
          </G>
        );
      case 'bells':
        return (
          <G {...stroke}>
            <Path d="M16 5c-5 0-8 4-8 9v5l-2 4h20l-2-4v-5c0-5-3-9-8-9z" />
            <Path d="M13 26a3 3 0 0 0 6 0" />
          </G>
        );
      default:
        return <Circle cx={16} cy={16} r={10} {...stroke} />;
    }
  })();

  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityElementsHidden importantForAccessibility="no">
      {glyph}
    </Svg>
  );
}
