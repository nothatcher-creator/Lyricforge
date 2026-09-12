export const US_PER_MS = 1000;
export const US_PER_SEC = 1_000_000;
export function msToUs(ms){ return Math.round(Number(ms) * US_PER_MS); }
export function usToMs(us){ return Number(us) / US_PER_MS; }
export function secToUs(sec){ return Math.round(Number(sec) * US_PER_SEC); }
export function usToSec(us){ return Number(us) / US_PER_SEC; }
export function frameTimeUs(frameIndex, fps){ return Math.round((frameIndex * US_PER_SEC) / fps); }
export function clampUs(value, min=0, max=Number.MAX_SAFE_INTEGER){ return Math.max(min, Math.min(max, Math.round(value))); }
export function formatClock(us, precise=true){
  const totalMs = Math.max(0, Math.round(us / 1000));
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  const base = h > 0 ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return precise ? `${base}.${String(ms).padStart(3,'0')}` : base;
}
