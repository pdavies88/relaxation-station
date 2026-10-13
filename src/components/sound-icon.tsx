import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

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
      case 'chimes':
        return (
          <G {...stroke}>
            <Path d="M5 5h22M9 5v4M14 5v4M19 5v4M24 5v4" />
            <Path d="M9 10v10M14 10v14M19 10v12M24 10v8" strokeWidth={3.2} />
            <Circle cx={16.5} cy={27.5} r={1.6} />
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
      case 'heartbeat':
        return (
          <G {...stroke}>
            <Path d="M16 27s-11-6.5-11-14a6 6 0 0 1 11-3.3A6 6 0 0 1 27 13c0 7.5-11 14-11 14z" />
            <Path d="M9 16h4l1.5-3 3 6 1.5-3h4" />
          </G>
        );
      case 'fire':
        return (
          <G {...stroke}>
            <Path d="M16 4c1 5 7 7 7 14a7 7 0 0 1-14 0c0-4 2-6 4-8 0 3 1 5 3 5 0-4-1-7 0-11z" />
          </G>
        );
      case 'guitar':
        return (
          <G {...stroke}>
            <Path d="M16 2.5v15.2M14 2.5h4M13.5 24.5h5" />
            <Path d="M16 11c-3.5 0-5.5 2.3-5 5.2-3 1.2-4.3 3.5-3.7 6.3.7 3.4 4.2 5.5 8.7 5.5s8-2.1 8.7-5.5c.6-2.8-.7-5.1-3.7-6.3.5-2.9-1.5-5.2-5-5.2z" />
            <Circle cx={16} cy={20} r={2.3} />
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
      case 'car':
        return (
          <G {...stroke}>
            <Path d="M3 22v-5.5l4-7.5h18l4 7.5V22" />
            <Path d="M7.5 16.5h17M3 22h3.5M12.5 22h7M25.5 22H29" />
            <Circle cx={9.5} cy={22.5} r={3} />
            <Circle cx={22.5} cy={22.5} r={3} />
          </G>
        );
      case 'shush':
        return (
          <G {...stroke}>
            <Path d="M12.5 25.6A11 11 0 1 1 19.5 25.6" />
            <Path d="M10.5 12q1.5 1.5 3 0M18.5 12q1.5 1.5 3 0M11 20h2M19 20h2" />
            <Rect x={14} y={15.5} width={4} height={14} rx={2} />
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
