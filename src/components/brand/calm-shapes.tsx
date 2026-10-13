import { Circle, Ellipse, G, Path } from 'react-native-svg';

/**
 * Soft, flat glyphs drawn on a 48×48 grid for the hero background. Each returns SVG children
 * (not a full <Svg>), so many can share one canvas.
 */
type CalmShape = () => React.ReactElement;

const Moon: CalmShape = () => <Path d="M30 8a17 17 0 1 0 10 30A14 14 0 0 1 30 8z" fill="#FFD98A" />;

const Star: CalmShape = () => (
  <Path d="M24 8l4.2 10 10.8.9-8.2 7.1 2.5 10.6L24 31l-9.3 5.6 2.5-10.6L9 18.9l10.8-.9z" fill="#FFE7A8" />
);

const Cloud: CalmShape = () => (
  <G>
    <Circle cx={18} cy={26} r={8} fill="#C9C2FF" />
    <Circle cx={27} cy={21} r={10} fill="#D6D0FF" />
    <Circle cx={35} cy={27} r={7} fill="#C9C2FF" />
    <Ellipse cx={26} cy={31} rx={15} ry={5} fill="#D6D0FF" />
  </G>
);

const Leaf: CalmShape = () => (
  <G>
    <Path d="M10 38C10 20 22 10 40 9c-1 18-12 29-30 29z" fill="#8FD9B6" />
    <Path d="M12 36L34 15" stroke="#5FB892" strokeWidth={2} strokeLinecap="round" />
  </G>
);

const Wave: CalmShape = () => (
  <G fill="none" strokeLinecap="round" strokeWidth={3}>
    <Path d="M6 20c6-6 12-6 18 0s12 6 18 0" stroke="#8ED3E8" />
    <Path d="M6 30c6-6 12-6 18 0s12 6 18 0" stroke="#A9DEEE" />
  </G>
);

const Lotus: CalmShape = () => (
  <G>
    <Path d="M24 10c5 6 6 14 0 24-6-10-5-18 0-24z" fill="#F7B2CC" />
    <Path d="M24 34C17 32 10 26 9 18c8 1 13 7 15 16z" fill="#F4A0BF" />
    <Path d="M24 34c7-2 14-8 15-16-8 1-13 7-15 16z" fill="#F4A0BF" />
    <Ellipse cx={24} cy={37} rx={13} ry={3} fill="#8FD9B6" />
  </G>
);

const Raindrop: CalmShape = () => <Path d="M24 8c6 9 11 15 11 22a11 11 0 0 1-22 0c0-7 5-13 11-22z" fill="#9FC4FF" />;

const Sparkle: CalmShape = () => (
  <Path d="M24 6c1.5 8 4 10.5 12 12-8 1.5-10.5 4-12 12-1.5-8-4-10.5-12-12 8-1.5 10.5-4 12-12z" fill="#E4DCFF" />
);

export const CALM_SHAPES: CalmShape[] = [Moon, Cloud, Star, Leaf, Wave, Lotus, Raindrop, Sparkle];
