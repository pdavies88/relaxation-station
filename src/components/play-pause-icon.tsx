import Svg, { Path, Rect } from 'react-native-svg';

export function PlayPauseIcon({ playing, color, size = 22 }: { playing: boolean; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {playing ? (
        <>
          <Rect x={6} y={5} width={4} height={14} rx={1.5} fill={color} />
          <Rect x={14} y={5} width={4} height={14} rx={1.5} fill={color} />
        </>
      ) : (
        <Path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill={color} />
      )}
    </Svg>
  );
}
