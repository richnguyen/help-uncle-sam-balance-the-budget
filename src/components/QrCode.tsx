import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/** A QR code for a link, drawn as one SVG path (crisp on a projector, and it scales). */
export function QrCode({ url, size = 160, label }: { url: string; size?: number; label: string }) {
  const { n, d } = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(url);
    q.make();
    const n = q.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
    return { n, d };
  }, [url]);
  return (
    <svg className="qr" role="img" aria-label={label} width={size} height={size} viewBox={`0 0 ${n + 8} ${n + 8}`} shapeRendering="crispEdges">
      <rect width={n + 8} height={n + 8} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
