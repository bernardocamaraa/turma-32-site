type Props = { size?: number; opacity?: number; duration?: number };

/**
 * Signatures as light chalk marks on a dark wall: assinaturas.png is white
 * paper with gray strokes, so inverting it turns the paper black (invisible
 * against a dark wall) and the strokes light — then `screen` lets only
 * those light strokes brighten what's underneath, the way chalk or a
 * scratch would catch the light on concrete. Plain `opacity`/`multiply`
 * washed out here because the wall textures are already near-black, too
 * dark for a darkening blend to read. Render this as an absolutely
 * positioned sibling inside a `position: relative; overflow: hidden`
 * container, above the wall-texture layer and below the real content.
 */
export function AssinaturaOverlay({ size = 520, opacity = 0.4, duration = 90 }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'url(/assets/assinaturas.png)',
        backgroundSize: `${size}px`,
        filter: 'invert(1)',
        mixBlendMode: 'screen',
        opacity,
        pointerEvents: 'none',
        animation: `om-drift ${duration}s linear infinite`,
      }}
    />
  );
}
