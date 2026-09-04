import { Camera, ChevronDown, MapPin, X, type LucideProps } from 'lucide-react';

const ICONS = {
  'map-pin': MapPin,
  camera: Camera,
  x: X,
  'chevron-down': ChevronDown,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 18, ...rest }: { name: IconName } & LucideProps) {
  const C = ICONS[name];
  return <C size={size} aria-hidden {...rest} />;
}
