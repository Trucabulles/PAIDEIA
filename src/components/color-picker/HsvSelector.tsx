import { useEffect, useRef, useState } from 'react';
import { hexToRgb, hsvToHex, rgbToHsv, type HsvColor } from './colorUtils';
import { useI18n } from '../../i18n/react';

export function HsvSelector({ value, onChange, onBeforePick }: {
  value: string; onChange: (color: string) => void; onBeforePick?: () => void;
}) {
  const { t } = useI18n();
  const [hsv, setHsv] = useState(() => rgbToHsv(hexToRgb(value) ?? { r: 255, g: 255, b: 255 }));
  const current = useRef(hsv);
  const emitted = useRef('');
  const frame = useRef<number | null>(null);
  const callback = useRef(onChange); callback.current = onChange;
  const flush = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    const color = hsvToHex(current.current);
    if (color !== emitted.current) { emitted.current = color; callback.current(color); }
  };
  useEffect(() => {
    if (value === emitted.current) return;
    const rgb = hexToRgb(value);
    if (!rgb) return;
    current.current = rgbToHsv(rgb, current.current.h);
    setHsv(current.current);
  }, [value]);
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);
  const update = (patch: Partial<HsvColor>) => {
    current.current = { ...current.current, ...patch };
    setHsv(current.current);
    if (frame.current === null) frame.current = requestAnimationFrame(flush);
  };
  const position = (element: HTMLElement, x: number, y: number) => {
    const rect = element.getBoundingClientRect();
    update({ s: Math.max(0, Math.min(1, (x - rect.left) / rect.width)), v: Math.max(0, Math.min(1, 1 - (y - rect.top) / rect.height)) });
  };
  return <div className="paideia-hsv-controls">
    <div className="paideia-hsv-sv" role="slider" tabIndex={0}
      aria-label={t("color.picker.saturationBrightness")}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hsv.s * 100)}
      aria-valuetext={t("color.picker.saturationBrightnessValue", {
        saturation: Math.round(hsv.s * 100),
        brightness: Math.round(hsv.v * 100)
      })}
      style={{ backgroundColor: hsvToHex({ h: hsv.h, s: 1, v: 1 }) }}
      onPointerDown={event => { onBeforePick?.(); event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); position(event.currentTarget, event.clientX, event.clientY); }}
      onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) position(event.currentTarget, event.clientX, event.clientY); }}
      onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) { position(event.currentTarget, event.clientX, event.clientY); flush(); event.currentTarget.releasePointerCapture(event.pointerId); } }}
      onPointerCancel={flush}
      onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault(); onBeforePick?.();
        const step = event.shiftKey ? .1 : .01;
        update({ s: Math.max(0, Math.min(1, current.current.s + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0))),
          v: Math.max(0, Math.min(1, current.current.v + (event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0))) });
      }}>
      <span className="paideia-hsv-mire" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
    </div>
    <input className="paideia-hsv-hue" aria-label={t("color.picker.hue")} title={t("color.picker.hue")} type="range" min="0" max="359.9" step="0.1" value={hsv.h}
      onPointerDown={() => onBeforePick?.()} onPointerUp={flush}
      onChange={event => update({ h: Number(event.target.value) })} />
  </div>;
}
