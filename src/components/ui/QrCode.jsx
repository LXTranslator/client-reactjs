import { useMemo } from 'react';
import { encodeQr } from '../../lib/qrcode.js';

/**
 * Renders a value as a QR code, inline.
 *
 * An inline `<svg>` rather than an image, and that is not a style choice: the
 * deployed content security policy sets `img-src 'self' data:` and
 * `connect-src 'self'`, so a remote QR service is blocked outright and even a
 * generated `data:` image is more machinery than drawing the squares directly.
 *
 * The whole grid is drawn as a single `<path>`. Several thousand `<rect>`
 * elements is a lot of DOM for something that never changes.
 *
 * @param {{value: string, size?: number, label: string}} props Component props.
 * @returns {JSX.Element} The QR code.
 */
export function QrCode({ value, size = 220, label }) {
  const { path, modules } = useMemo(() => {
    const qr = encodeQr(value);
    const segments = [];

    for (let row = 0; row < qr.size; row += 1) {
      for (let column = 0; column < qr.size; column += 1) {
        if (qr.modules[row][column]) segments.push(`M${column} ${row}h1v1h-1z`);
      }
    }

    return { path: segments.join(''), modules: qr.size };
  }, [value]);

  // Four modules of quiet zone, which the specification requires and scanners
  // rely on to find the symbol at all.
  const quiet = 4;
  const extent = modules + quiet * 2;

  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${extent} ${extent}`}
      shapeRendering="crispEdges"
      style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
    >
      <rect width={extent} height={extent} fill="#ffffff" />
      <g transform={`translate(${quiet} ${quiet})`}>
        <path d={path} fill="#1b2430" />
      </g>
    </svg>
  );
}
