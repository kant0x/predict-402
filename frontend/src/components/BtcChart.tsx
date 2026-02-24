import { useEffect, useRef } from 'react';
import { subscribeToRawPrice } from '../hooks/useBtcPrice';

/* ════════════════════════════════════════════════════════════
   BtcChart — Custom Canvas + Catmull-Rom Spline Smoothing
   ─ Polymarket style: orange line + gradient fill
   ─ Smooth curves (NO straight segments like Lightweight Charts)
   ─ Auto-scaling grid with simple step logic
   ─ Strike price dashed line
   ─ Real-time via Binance WebSocket
   ════════════════════════════════════════════════════════════ */

interface BtcChartProps {
    strikePrice?: number | null;
}

// ── Visual ──
const BG = '#0e1018';
const LINE_COLOR = '#f7931a';
const LINE_WIDTH = 2;
const GRID_COLOR = 'rgba(255,255,255,0.04)';
const TEXT_COLOR = 'rgba(255,255,255,0.25)';
const STRIKE_COLOR = 'rgba(255,255,255,0.3)';

// ── Settings ──
const TIME_WINDOW = 300_000;      // 5 min display window
const SAMPLE_MS = 1000;           // 1 sample per second (synced with Kraken)
const RENDER_DELAY = 2000;        // 2 sec delay — буфер для плавности
const INTERP_RES = 6;             // Catmull-Rom interpolation sub-steps
const EMA_ALPHA = 0.04;           // live tip smoothing

interface PricePoint { time: number; price: number; }

// ── Catmull-Rom interpolation ──
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const v0 = (p2 - p0) * 0.5;
    const v1 = (p3 - p1) * 0.5;
    const t2 = t * t, t3 = t2 * t;
    return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;
}

// Catmull-Rom интерполяция (плавные кривые, НО без SMA — старые точки НЕ меняются)
function interpolatePoints(raw: PricePoint[]): PricePoint[] {
    if (raw.length < 4) return raw;
    const result: PricePoint[] = [];
    for (let i = 0; i < raw.length - 1; i++) {
        const p0 = raw[Math.max(0, i - 1)], p1 = raw[i];
        const p2 = raw[i + 1], p3 = raw[Math.min(raw.length - 1, i + 2)];
        result.push(p1);
        for (let t = 1; t < INTERP_RES; t++) {
            const u = t / INTERP_RES;
            result.push({
                time: p1.time + (p2.time - p1.time) * u,
                price: catmullRom(p0.price, p1.price, p2.price, p3.price, u),
            });
        }
    }
    result.push(raw[raw.length - 1]);
    return result;
}

// ── Auto grid step ──
const GRID_STEPS = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
function pickGridStep(range: number): number {
    // Aim for 3-5 grid lines
    for (const s of GRID_STEPS) {
        if (range / s <= 6) return s;
    }
    return GRID_STEPS[GRID_STEPS.length - 1];
}

export function BtcChart({ strikePrice }: BtcChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const s = useRef({
        history: [] as PricePoint[],
        strike: null as number | null,
        price: 0,
        yMin: 0, yMax: 0,
        targetMin: 0, targetMax: 0,
        scaleInit: false,
        squeezeTimer: 0,       // когда сжатие разрешено (timestamp)
        squeezeArmed: false,    // таймер запущен
        lastPt: 0, prevFrame: 0,
        mouseX: null as number | null,
        raf: 0,
        liveEma: 0, liveEmaInit: false,
    }).current;

    useEffect(() => { s.strike = strikePrice ?? null; }, [strikePrice]);

    useEffect(() => {
        let destroyed = false;

        // Load history
        const loadHistory = async () => {
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    const res = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1s&limit=310');
                    if (!res.ok) { await new Promise(r => setTimeout(r, 500)); continue; }
                    const raw = await res.json();
                    if (!raw.length) continue;
                    const pts: PricePoint[] = raw.map((k: any) => ({ time: k[6], price: parseFloat(k[4]) }));
                    if (s.history.length > 0) {
                        const firstLive = s.history[0].time;
                        const older = pts.filter(p => p.time < firstLive);
                        s.history = [...older, ...s.history];
                    } else {
                        s.history = pts;
                    }
                    if (pts.length && s.price === 0) s.price = pts[pts.length - 1].price;
                    return;
                } catch { await new Promise(r => setTimeout(r, 500)); }
            }
        };
        loadHistory();

        // ── Main render loop ──
        const draw = (ts: number) => {
            if (destroyed) return;
            const rawDt = s.prevFrame ? ts - s.prevFrame : 16.67;
            s.prevFrame = ts;
            const dt = rawDt > 500 ? 1 : Math.min(rawDt / 16.67, 3);

            const canvas = canvasRef.current, container = containerRef.current;
            if (!canvas || !container) { s.raf = requestAnimationFrame(draw); return; }

            const price = s.price;
            const now = Date.now(), h = s.history;
            // Время рендера — на 2 сек позади реалтайма (буфер плавности)
            const renderNow = now - RENDER_DELAY;

            // Points are now added in the subscribeToRawPrice callback to prevent flatlining in background tabs

            if (h.length < 2 || price === 0) { s.raf = requestAnimationFrame(draw); return; }

            // Canvas setup
            const dpr = window.devicePixelRatio || 1;
            const rect = container.getBoundingClientRect();
            if (!rect.width) { s.raf = requestAnimationFrame(draw); return; }
            const tw = Math.round(rect.width * dpr), th = Math.round(rect.height * dpr);
            if (canvas.width !== tw || canvas.height !== th) {
                canvas.width = tw; canvas.height = th;
                canvas.style.width = rect.width + 'px'; canvas.style.height = rect.height + 'px';
            }
            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) { s.raf = requestAnimationFrame(draw); return; }

            ctx.fillStyle = BG; ctx.fillRect(0, 0, tw, th);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const w = rect.width, ht = rect.height;
            const pad = { top: 18, bottom: 28, left: 0, right: 68 };
            const chartW = w - pad.left - pad.right;
            const chartH = ht - pad.top - pad.bottom;
            const strike = s.strike;
            const winStart = renderNow - TIME_WINDOW;
            const toX = (t: number) => pad.left + ((t - winStart) / TIME_WINDOW) * chartW;

            // Visible slice (только до renderNow)
            let lo = 0, hi2 = h.length - 1;
            const searchT = winStart - 3000;
            while (lo <= hi2) { const m = (lo + hi2) >> 1; h[m].time < searchT ? lo = m + 1 : hi2 = m - 1; }
            const vs = Math.max(0, lo - 1);
            // Отрезаем до renderNow + немного вперёд (для EMA target)
            const renderSlice: PricePoint[] = [];
            for (let i = vs; i < h.length && h[i].time <= renderNow + 500; i++) {
                renderSlice.push(h[i]);
            }

            // Интерполяция (без SMA! старые точки НЕ меняются при новых данных)
            const smoothed = interpolatePoints(renderSlice);

            // ── Auto-scaling ──
            let dataMin = Infinity, dataMax = -Infinity;
            for (const p of smoothed) {
                if (p.price < dataMin) dataMin = p.price;
                if (p.price > dataMax) dataMax = p.price;
            }
            // Include live tip
            if (!s.liveEmaInit && price > 0) { s.liveEma = price; s.liveEmaInit = true; }
            else if (price > 0) { s.liveEma += (price - s.liveEma) * EMA_ALPHA * dt; }
            if (s.liveEma < dataMin) dataMin = s.liveEma;
            if (s.liveEma > dataMax) dataMax = s.liveEma;

            const spread = dataMax - dataMin;
            const minRange = 30;
            const range = Math.max(spread * 1.4, minRange); // 20% padding each side
            const center = (dataMin + dataMax) / 2;
            s.targetMin = center - range / 2;
            s.targetMax = center + range / 2;

            if (!s.scaleInit) {
                s.yMin = s.targetMin; s.yMax = s.targetMax; s.scaleInit = true;
            } else {
                // Smooth scale transitions
                const EXPAND_SPEED = 0.15;
                const SQUEEZE_SPEED = 0.15;
                const SQUEEZE_DELAY = 1000; // 1 сек задержка перед сжатием

                const minDiff = s.targetMin - s.yMin, maxDiff = s.targetMax - s.yMax;
                const needExpand = minDiff < -0.5 || maxDiff > 0.5; // target шире display
                const needSqueeze = minDiff > 0.5 || maxDiff < -0.5; // target уже display

                if (needExpand) {
                    // Расширение — мгновенно, без задержки
                    s.squeezeArmed = false;
                    const minSpd = minDiff < 0 ? EXPAND_SPEED : 0;
                    const maxSpd = maxDiff > 0 ? EXPAND_SPEED : 0;
                    s.yMin += minDiff * (1 - Math.pow(1 - (minDiff < 0 ? EXPAND_SPEED : 0.01), dt));
                    s.yMax += maxDiff * (1 - Math.pow(1 - (maxDiff > 0 ? EXPAND_SPEED : 0.01), dt));
                } else if (needSqueeze) {
                    // Сжатие — с задержкой 1 сек
                    if (!s.squeezeArmed) {
                        s.squeezeArmed = true;
                        s.squeezeTimer = ts + SQUEEZE_DELAY;
                    }
                    if (ts >= s.squeezeTimer) {
                        // Задержка прошла — сжимаем быстро
                        s.yMin += minDiff * (1 - Math.pow(1 - SQUEEZE_SPEED, dt));
                        s.yMax += maxDiff * (1 - Math.pow(1 - SQUEEZE_SPEED, dt));
                    }
                    // Иначе ждём — ничего не двигаем
                } else {
                    s.squeezeArmed = false;
                }
            }

            const scaleR = (s.yMax - s.yMin) || 1;
            const toY = (p: number) => pad.top + chartH * (1 - (p - s.yMin) / scaleR);

            // ── Grid ──
            const gridStep = pickGridStep(s.yMax - s.yMin);
            ctx.font = '10px "JetBrains Mono",monospace';
            ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
            const firstTick = Math.ceil(s.yMin / gridStep) * gridStep;
            for (let p = firstTick; p <= s.yMax; p += gridStep) {
                const y = toY(p);
                if (y < pad.top - 5 || y > ht - pad.bottom + 5) continue;
                ctx.strokeStyle = GRID_COLOR; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
                ctx.fillStyle = TEXT_COLOR;
                const dec = gridStep < 1 ? 2 : gridStep < 10 ? 1 : 0;
                ctx.fillText('$' + p.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec }), w - 4, y);
            }

            // ── Time axis ──
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.font = '9px "JetBrains Mono",monospace';
            const LABEL_TICK = 30_000; // label every 30s
            for (let t = Math.ceil(winStart / LABEL_TICK) * LABEL_TICK; t <= now; t += LABEL_TICK) {
                const tx = toX(t);
                if (tx < pad.left + 20 || tx > w - pad.right - 10) continue;
                ctx.strokeStyle = GRID_COLOR; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(tx, pad.top); ctx.lineTo(tx, ht - pad.bottom); ctx.stroke();
                const d = new Date(t);
                ctx.fillStyle = 'rgba(255,255,255,0.18)';
                ctx.fillText(
                    d.getSeconds() === 0
                        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    tx, ht - pad.bottom + 5
                );
            }

            // ── Strike line ──
            if (strike) {
                const sy = toY(strike);
                if (sy >= pad.top - 5 && sy <= ht - pad.bottom + 5) {
                    ctx.save(); ctx.strokeStyle = STRIKE_COLOR; ctx.lineWidth = 1; ctx.setLineDash([6, 4]);
                    ctx.beginPath(); ctx.moveTo(pad.left, sy); ctx.lineTo(w - pad.right, sy); ctx.stroke(); ctx.restore();
                    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = 'bold 9px "JetBrains Mono"'; ctx.textAlign = 'right';
                    ctx.fillText('STRIKE $' + strike.toFixed(2), w - pad.right - 6, sy - 7);
                }
            }

            // ── Build curve points ──
            const pts: { x: number; y: number }[] = [];
            let lastPx = -Infinity;
            for (let i = 0; i < smoothed.length; i++) {
                const px = toX(smoothed[i].time);
                if (px - lastPx >= 1.5 || i === 0 || i === smoothed.length - 1) {
                    pts.push({ x: px, y: toY(smoothed[i].price) });
                    lastPx = px;
                }
            }
            // Live tip
            const liveX = toX(now);
            const liveY = toY(s.liveEma);
            pts.push({ x: liveX, y: liveY });

            // ── Draw smooth curve ──
            if (pts.length >= 2) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(pad.left - 2, pad.top - 2, chartW + 4, chartH + 4);
                ctx.clip();

                ctx.beginPath(); ctx.lineWidth = LINE_WIDTH; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
                ctx.strokeStyle = LINE_COLOR;

                // Extend from left edge
                ctx.moveTo(pad.left, pts[0].y);
                ctx.lineTo(pts[0].x, pts[0].y);

                if (pts.length <= 2) {
                    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
                } else {
                    for (let i = 0; i < pts.length - 1; i++) {
                        const x0 = pts[i].x, y0 = pts[i].y;
                        const x1 = pts[i + 1].x, y1 = pts[i + 1].y;
                        const cpx1 = x0 + (x1 - x0) / 3;
                        const cpx2 = x0 + (x1 - x0) * 2 / 3;
                        ctx.bezierCurveTo(cpx1, y0, cpx2, y1, x1, y1);
                    }
                }
                ctx.stroke();

                // Gradient fill
                ctx.lineTo(liveX, ht - pad.bottom);
                ctx.lineTo(pad.left, ht - pad.bottom);
                ctx.closePath();
                const grad = ctx.createLinearGradient(0, pad.top, 0, ht - pad.bottom);
                grad.addColorStop(0, 'rgba(247,147,26,0.12)');
                grad.addColorStop(0.5, 'rgba(247,147,26,0.03)');
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = grad; ctx.fill();

                ctx.restore();
            }

            // ── Crosshair on hover ──
            const mx = s.mouseX;
            if (mx !== null && mx > pad.left && mx < w - pad.right) {
                ctx.beginPath(); ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
                ctx.moveTo(mx, pad.top); ctx.lineTo(mx, ht - pad.bottom); ctx.stroke(); ctx.setLineDash([]);
                const hoverT = winStart + ((mx - pad.left) / chartW) * TIME_WINDOW;
                let ci = 0, cd = Infinity;
                for (let i = 0; i < smoothed.length; i++) {
                    const d = Math.abs(smoothed[i].time - hoverT);
                    if (d < cd) { cd = d; ci = i; }
                }
                const cp = smoothed[ci];
                if (cp) {
                    const cy = toY(cp.price);
                    ctx.beginPath(); ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.setLineDash([3, 3]);
                    ctx.moveTo(pad.left, cy); ctx.lineTo(w - pad.right, cy); ctx.stroke(); ctx.setLineDash([]);
                    ctx.beginPath(); ctx.fillStyle = '#fff'; ctx.arc(toX(cp.time), cy, 3, 0, Math.PI * 2); ctx.fill();
                    const ttX = mx > w * 0.6 ? mx - 95 : mx + 10;
                    ctx.fillStyle = 'rgba(20,20,30,0.9)'; ctx.beginPath(); ctx.roundRect(ttX, cy - 28, 82, 22, 3); ctx.fill();
                    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.stroke();
                    ctx.fillStyle = '#fff'; ctx.font = '10px "JetBrains Mono"'; ctx.textAlign = 'left';
                    ctx.fillText('$' + cp.price.toFixed(2), ttX + 6, cy - 14);
                }
            }

            s.raf = requestAnimationFrame(draw);
        };

        s.raf = requestAnimationFrame(draw);
        return () => { destroyed = true; cancelAnimationFrame(s.raf); };
    }, []);

    // ── Price subscription ──
    useEffect(() => {
        const unsub = subscribeToRawPrice((p) => {
            if (p > 0) {
                s.price = p;
                const now = Date.now();
                if (now - s.lastPt >= SAMPLE_MS) {
                    s.lastPt = now;
                    const h = s.history;
                    const cutoff = now - TIME_WINDOW - RENDER_DELAY - 10_000;
                    let rc = 0;
                    while (rc < h.length && h[rc].time < cutoff) rc++;
                    if (rc > 0) h.splice(0, rc);
                    h.push({ time: now, price: p });
                }
            }
        });
        return () => { unsub(); };
    }, []);

    return (
        <div ref={containerRef}
            style={{ width: '100%', height: '100%', position: 'relative', cursor: 'crosshair', background: BG }}
            onMouseMove={(e) => { const r = containerRef.current?.getBoundingClientRect(); if (r) s.mouseX = e.clientX - r.left; }}
            onMouseLeave={() => { s.mouseX = null; }}>
            <canvas ref={canvasRef} style={{ display: 'block' }} />
        </div>
    );
}
