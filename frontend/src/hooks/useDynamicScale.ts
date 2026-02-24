import { useRef, useState, useEffect } from 'react';

export interface ScaleState {
    displayMin: number;
    displayMax: number;
    gridStep: number;
    ticks: number[];
    volatilityLevel: number;
}

export interface DynamicScaleOptions {
    strikePrice?: number | null;
}

// ══════════════════════════════════════════════════
// Polymarket-стиль:
//   Скачок → шкала расширяется быстро.
//   Цена успокоилась → шкала СРАЗУ начинает сужаться
//   к текущему спокойному диапазону.
//   Старый скачок на линии СЖИМАЕТСЯ (прижимается к
//   краю), но ОСТАЁТСЯ на экране — ничего не обрезается.
//   Сетка подстраивается мгновенно.
// ══════════════════════════════════════════════════

// ── Уровни шкалы: переход по НЕТТО-ИЗМЕНЕНИЮ за 5 сек ──
//
// Метрика: netChange = |currentPrice - price5sAgo|
//   Рост 20¢ + падение 30¢ = нетто 10¢ (не 50¢ суммарно!)
//
// ВВЕРХ (быстро, 800мс задержка):
//   netChange > trigger текущего уровня → переходим вверх
//   Сетка $10  → netChange > $1   (10%) → уровень 1 ($25)
//   Сетка $25  → netChange > $2.5 (10%) → уровень 2 ($50)
//   Сетка $50  → netChange > $5   (10%) → уровень 3 ($100)
//   Сетка $100 → netChange > $20  (20%) → уровень 4 ($250)
//   Сетка $250 → netChange > $50  (20%) → уровень 5 ($500)
//   Сетка $500 → netChange > $100 (20%) → уровень 6 ($1000)
//
// ВНИЗ (5 сек затишья, по 1 уровню за раз):
//   Если 5 сек netChange ≤ trigger предыдущего уровня → шаг вниз
//   Потом ещё 5 сек тишины → ещё шаг вниз, и т.д.
//
// При переходе ВВЕРХ, минимальный displayRange тоже растёт
// (гарантия 3-5 тиков на экране):
//   Уровень 0: step $10,   minRange $40   → 4 тика
//   Уровень 1: step $25,   minRange $100  → 4 тика
//   Уровень 2: step $50,   minRange $200  → 4 тика
//   Уровень 3: step $100,  minRange $400  → 4 тика
//   Уровень 4: step $250,  minRange $1000 → 4 тика
//   Уровень 5: step $500,  minRange $2000 → 4 тика
//   Уровень 6: step $1000, minRange $4000 → 4 тика

const GRID_STEPS = [10, 25, 50, 100, 250, 500, 1000];
const LEVEL_MIN_RANGE = [40, 100, 200, 400, 1000, 2000, 4000];
const LEVEL_UP_DELAY_MS = 800;   // Быстрый переход вверх
const LEVEL_DOWN_DELAY_MS = 5000;  // 5 сек тишины для перехода вниз

function triggerPct(step: number): number {
    // Шаги от $100 и выше — нужен 20% разброс для перехода
    // Шаги ниже $100 — 10%
    return step >= 100 ? 0.20 : 0.10;
}

function computeDesiredLevel(dataSpread: number, currentLevel: number): number {
    let level = currentLevel;

    // ВВЕРХ: dataSpread > trigger% текущего шага
    while (level < GRID_STEPS.length - 1) {
        const trigger = GRID_STEPS[level] * triggerPct(GRID_STEPS[level]);
        if (dataSpread > trigger) {
            level++;
        } else {
            break;
        }
    }

    // ВНИЗ: dataSpread < trigger% шага предыдущего уровня
    while (level > 0) {
        const prevTrigger = GRID_STEPS[level - 1] * triggerPct(GRID_STEPS[level - 1]);
        if (dataSpread <= prevTrigger) {
            level--;
        } else {
            break;
        }
    }

    return level;
}

function buildTicks(min: number, max: number, step: number): number[] {
    const ticks: number[] = [];
    const first = Math.ceil(min / step) * step;
    for (let v = first; v <= max + step * 0.001; v += step) {
        ticks.push(v);
    }
    if (ticks.length > 5) {
        const filtered: number[] = [];
        for (let i = 0; i < ticks.length; i += 2) filtered.push(ticks[i]);
        return filtered;
    }
    return ticks;
}

const MIN_RANGE = 30;
const RECENT_WINDOW = 5000;    // 5 сек — "текущее" движение
const RECENT_PADDING = 0.25;    // 25% padding для текущих данных (удобно смотреть)
const DATA_PADDING = 0.03;    // 3% padding для старых данных (прижаты к краю)

// Скорости анимации
const SPEED_EXPAND = 0.12;
const SPEED_SHRINK = 0.04;       // Сжатие — заметное но плавное
const SPEED_SHIFT = 0.06;
const SPEED_URGENT = 0.25;

export function useDynamicScale(
    prices: number[],
    options: DynamicScaleOptions = {}
): ScaleState {
    const { strikePrice = null } = options;

    const [state, setState] = useState<ScaleState>({
        displayMin: 0,
        displayMax: 1,
        gridStep: 10,
        ticks: [],
        volatilityLevel: 1,
    });

    const ref = useRef({
        displayMin: 0,
        displayMax: 1,
        targetMin: 0,
        targetMax: 1,
        initialized: false,
        rafId: 0,
        dataMin: 0,
        dataMax: 0,
        recentPrices: [] as { price: number; time: number }[],
        dataSpread: 0,
        netChange: 0,          // нетто-сдвиг за 5 сек: |current - price5sAgo|
        gridLevel: 0,
        pendingLevel: -1,
        pendingDir: '' as '' | 'up' | 'down',
        levelChangeAt: 0,
    });

    useEffect(() => {
        if (prices.length === 0) return;

        const a = ref.current;
        const now = Date.now();
        const currentPrice = prices[prices.length - 1];

        // ── Все данные на экране (полный dataMin/dataMax) ──
        const startIdx = Math.max(0, prices.length - 135);
        let dataMin = Infinity;
        let dataMax = -Infinity;
        for (let i = startIdx; i < prices.length; i++) {
            if (prices[i] < dataMin) dataMin = prices[i];
            if (prices[i] > dataMax) dataMax = prices[i];
        }
        a.dataMin = dataMin;
        a.dataMax = dataMax;
        a.dataSpread = dataMax - dataMin;

        // ── Недавние данные (последние 5 сек) ──
        a.recentPrices.push({ price: currentPrice, time: now });
        while (a.recentPrices.length > 0 && now - a.recentPrices[0].time > RECENT_WINDOW) {
            a.recentPrices.shift();
        }
        let recentMin = currentPrice, recentMax = currentPrice;
        for (const p of a.recentPrices) {
            if (p.price < recentMin) recentMin = p.price;
            if (p.price > recentMax) recentMax = p.price;
        }

        // ── НЕТТО-ИЗМЕНЕНИЕ за 5 сек ──
        // |текущая цена - цена 5 сек назад|
        // Рост 20¢ + падение 30¢ = нетто 10¢, а не 50¢!
        const oldestInWindow = a.recentPrices.length > 0 ? a.recentPrices[0].price : currentPrice;
        a.netChange = Math.abs(currentPrice - oldestInWindow);

        // ── Уровень сетки по netChange ──
        const desiredLevel = computeDesiredLevel(a.netChange, a.gridLevel);
        const levelMinRange = LEVEL_MIN_RANGE[desiredLevel];

        // ── Два диапазона ──

        // 1) "Желаемый" — по текущему движению, с хорошим padding
        const recentSpread = recentMax - recentMin;
        const desiredRange = Math.max(recentSpread * (1 + RECENT_PADDING * 2), MIN_RANGE);

        // 2) "Обязательный" — чтобы ВСЕ данные влезли, с минимальным padding
        const requiredRange = a.dataSpread * (1 + DATA_PADDING * 2);

        // Итоговый: макс из (желаемый, обязательный, минимум для уровня)
        const range = Math.max(desiredRange, requiredRange, levelMinRange);

        // Центрируем на центре ВСЕХ данных
        // Волна остаётся посередине, просто сплющивается
        const dataCenter = (dataMin + dataMax) / 2;
        let targetMin = dataCenter - range / 2;
        let targetMax = dataCenter + range / 2;

        // Гарантия: все данные на экране
        const minPad = range * DATA_PADDING;
        if (dataMax > targetMax - minPad) {
            targetMax = dataMax + minPad;
            targetMin = targetMax - range;
        }
        if (dataMin < targetMin + minPad) {
            targetMin = dataMin - minPad;
            targetMax = targetMin + range;
        }

        a.targetMin = targetMin;
        a.targetMax = targetMax;

        if (!a.initialized) {
            a.displayMin = targetMin;
            a.displayMax = targetMax;
            a.initialized = true;
        }

    }, [prices, strikePrice]);

    // ══════════════════════════════════════════════════
    // RAF: display плавно догоняет target.
    //      Расширение быстрое. Сжатие плавное.
    //      Старый скачок сжимается к краю, не обрезается.
    //      Сетка мгновенно.
    // ══════════════════════════════════════════════════
    useEffect(() => {
        const a = ref.current;
        let lastFrame = performance.now();

        const animate = (frameTime: number) => {
            if (!a.initialized) {
                a.rafId = requestAnimationFrame(animate);
                return;
            }

            const dt = Math.min((frameTime - lastFrame) / 16.67, 3);
            lastFrame = frameTime;

            const targetRange = a.targetMax - a.targetMin;
            const displayRange = a.displayMax - a.displayMin;
            const targetCenter = (a.targetMin + a.targetMax) / 2;
            const displayCenter = (a.displayMin + a.displayMax) / 2;

            // ── Линия близко к краю? ──
            const edgeMargin = displayRange * 0.10;
            const nearTop = a.dataMax > a.displayMax - edgeMargin;
            const nearBot = a.dataMin < a.displayMin + edgeMargin;
            const urgent = nearTop || nearBot;

            // ── ЦЕНТР ──
            const shiftSpeed = urgent ? SPEED_URGENT : SPEED_SHIFT;
            const cFactor = 1 - Math.pow(1 - shiftSpeed, dt);
            const newCenter = displayCenter + (targetCenter - displayCenter) * cFactor;

            // ── ДИАПАЗОН ──
            let newRange: number;
            const rangeDiff = targetRange - displayRange;

            if (rangeDiff > 0.5) {
                // Расширение — быстрое
                const speed = urgent ? SPEED_URGENT : SPEED_EXPAND;
                const eFactor = 1 - Math.pow(1 - speed, dt);
                newRange = displayRange + rangeDiff * eFactor;
            } else if (rangeDiff < -0.5) {
                // Сжатие — плавное (старый скачок постепенно прижимается)
                const sFactor = 1 - Math.pow(1 - SPEED_SHRINK, dt);
                newRange = displayRange + rangeDiff * sFactor;
            } else {
                newRange = displayRange;
            }

            if (newRange < MIN_RANGE) newRange = MIN_RANGE;

            a.displayMin = newCenter - newRange / 2;
            a.displayMax = newCenter + newRange / 2;

            // ── Гарантия: данные не вылезают за экран ──
            const softPad = newRange * 0.02;
            if (a.dataMax > a.displayMax - softPad) {
                const overshoot = a.dataMax - (a.displayMax - softPad);
                a.displayMax += overshoot + softPad;
                a.displayMin = a.displayMax - newRange;
            }
            if (a.dataMin < a.displayMin + softPad) {
                const overshoot = (a.displayMin + softPad) - a.dataMin;
                a.displayMin -= overshoot + softPad;
                a.displayMax = a.displayMin + newRange;
            }

            // ── Сетка: переход по netChange (нетто за 5 сек) ──
            const now = performance.now();
            const desiredLevel = computeDesiredLevel(a.netChange, a.gridLevel);

            if (desiredLevel > a.gridLevel) {
                // ═══ ВВЕРХ: быстрый переход (800мс), можно прыгнуть на несколько уровней ═══
                if (a.pendingLevel !== desiredLevel || a.pendingDir !== 'up') {
                    a.pendingLevel = desiredLevel;
                    a.pendingDir = 'up';
                    a.levelChangeAt = now + LEVEL_UP_DELAY_MS;
                } else if (now >= a.levelChangeAt) {
                    a.gridLevel = desiredLevel; // прыгаем сразу на нужный уровень
                    a.pendingLevel = -1;
                    a.pendingDir = '';
                }
            } else if (desiredLevel < a.gridLevel) {
                // ═══ ВНИЗ: 5 сек тишины, ОДИН уровень за раз ═══
                const oneStepDown = a.gridLevel - 1;
                if (a.pendingLevel !== oneStepDown || a.pendingDir !== 'down') {
                    // Начинаем отсчёт 5 секунд тишины
                    a.pendingLevel = oneStepDown;
                    a.pendingDir = 'down';
                    a.levelChangeAt = now + LEVEL_DOWN_DELAY_MS;
                } else if (now >= a.levelChangeAt) {
                    // 5 секунд прошло, цена всё ещё спокойная — шаг вниз
                    a.gridLevel = oneStepDown;
                    a.pendingLevel = -1;
                    a.pendingDir = '';
                    // Если desiredLevel ещё ниже — в следующем кадре запустится
                    // новый 5-секундный таймер для следующего шага вниз
                }
            } else {
                // netChange соответствует текущему уровню — отменяем ожидание
                a.pendingLevel = -1;
                a.pendingDir = '';
            }

            const gridStep = GRID_STEPS[a.gridLevel];
            const ticks = buildTicks(a.displayMin, a.displayMax, gridStep);

            setState({
                displayMin: a.displayMin,
                displayMax: a.displayMax,
                gridStep,
                ticks,
                volatilityLevel: a.gridLevel + 1,
            });

            a.rafId = requestAnimationFrame(animate);
        };

        a.rafId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(a.rafId);
    }, []);

    return state;
}
