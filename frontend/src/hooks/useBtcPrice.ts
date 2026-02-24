// ══════════════════════════════════════════════════════════════════
// BTC Price Feed — 3 sources, weighted average
//  1. Binance WebSocket (weight 2) — главный, задержка ~50ms
//  2. Binance REST   (weight 1) — fallback если WS упал
//  3. CoinGecko REST (weight 1) — бесплатный, без ключа
//  4. Kraken REST    (weight 1) — резерв
// Финальная цена = среднее взвешенное из живых источников
// ══════════════════════════════════════════════════════════════════

const listeners = new Set<(price: number) => void>();
let lastPrice = 0;
let wsLastMsg = 0;
let ws: WebSocket | null = null;
let restInterval: ReturnType<typeof setInterval> | null = null;
let cgInterval: ReturnType<typeof setInterval> | null = null;
let krakenInterval: ReturnType<typeof setInterval> | null = null;

// Актуальные цены из каждого источника
const sources = {
  binanceWs: 0,
  binanceRest: 0,
  coingecko: 0,
  kraken: 0,
  binanceWsTime: 0,
  binanceRestTime: 0,
  coingeckoTime: 0,
  krakenTime: 0,
};

// Вычислить средневзвешенную цену из живых источников (не старше 10 сек)
function computeAverage(): number {
  const now = Date.now();
  const TTL = 10_000;
  const vals: { p: number; w: number }[] = [];

  if (sources.binanceWs > 0 && now - sources.binanceWsTime < TTL)
    vals.push({ p: sources.binanceWs, w: 3 }); // WS — самый точный
  if (sources.binanceRest > 0 && now - sources.binanceRestTime < TTL)
    vals.push({ p: sources.binanceRest, w: 1 });
  if (sources.coingecko > 0 && now - sources.coingeckoTime < TTL)
    vals.push({ p: sources.coingecko, w: 1 });
  if (sources.kraken > 0 && now - sources.krakenTime < TTL)
    vals.push({ p: sources.kraken, w: 1 });

  if (vals.length === 0) return lastPrice;
  const totalW = vals.reduce((s, v) => s + v.w, 0);
  return vals.reduce((s, v) => s + v.p * v.w, 0) / totalW;
}

function emit() {
  const avg = computeAverage();
  if (avg > 0) {
    lastPrice = avg;
    wsLastMsg = Date.now();
    listeners.forEach(fn => fn(avg));
  }
}

// ── 1. Binance WebSocket ──
const wsOnlyListeners = new Set<(price: number) => void>();

function connectWS() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;
  try {
    ws = new WebSocket('wss://stream.binance.com:443/ws/btcusdt@aggTrade');
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        const p = parseFloat(data.p);
        if (p > 0) {
          sources.binanceWs = p;
          sources.binanceWsTime = Date.now();
          emit();
          // Отдельный канал для графика — только WS, без средневзвешенной
          wsOnlyListeners.forEach(fn => fn(p));
        }
      } catch { /* ignore */ }
    };
    ws.onclose = () => { setTimeout(connectWS, 1500); };
    ws.onerror = () => { ws?.close(); };
  } catch { setTimeout(connectWS, 2000); }
}

// ── 2. Binance REST (каждые 3 сек если WS молчит) ──
async function fetchBinanceRest() {
  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT', { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    const p = parseFloat(data.price);
    if (p > 0) {
      sources.binanceRest = p;
      sources.binanceRestTime = Date.now();
      // не вызываем emit() — обновления идут только через WS
    }
  } catch { /* ignore */ }
}

// ── 3. CoinGecko REST (каждые 8 сек) ──
async function fetchCoinGecko() {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();
    const p = data?.bitcoin?.usd;
    if (p && p > 0) {
      sources.coingecko = p;
      sources.coingeckoTime = Date.now();
    }
  } catch { /* ignore */ }
}

// ── 4. Kraken REST (каждые 6 сек) ──
async function fetchKraken() {
  try {
    const res = await fetch(
      'https://api.kraken.com/0/public/Ticker?pair=XBTUSD',
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();
    const p = parseFloat(data?.result?.XXBTZUSD?.c?.[0]);
    if (p > 0) {
      sources.kraken = p;
      sources.krakenTime = Date.now();
    }
  } catch { /* ignore */ }
}

function ensureConnection() {
  // WS primary
  if (!ws || ws.readyState > WebSocket.OPEN) connectWS();

  // Binance REST fallback (если WS молчит > 5сек)
  if (!restInterval) {
    restInterval = setInterval(() => {
      if (Date.now() - wsLastMsg > 5000) fetchBinanceRest();
    }, 15000);
  }

  // CoinGecko каждые 60 сек
  if (!cgInterval) {
    fetchCoinGecko(); // сразу при старте
    cgInterval = setInterval(fetchCoinGecko, 60000);
  }

  // Kraken каждые 30 сек
  if (!krakenInterval) {
    fetchKraken(); // сразу при старте
    krakenInterval = setInterval(fetchKraken, 30000);
  }
}

export function subscribeToRawPrice(callback: (price: number) => void): () => void {
  listeners.add(callback);
  ensureConnection();
  if (lastPrice > 0) callback(lastPrice);
  return () => { listeners.delete(callback); };
}

export function getLastPrice(): number {
  return lastPrice;
}

// Для отладки — источники цен
export function getPriceSources() {
  return {
    binanceWs: sources.binanceWs,
    binanceRest: sources.binanceRest,
    coingecko: sources.coingecko,
    kraken: sources.kraken,
    average: computeAverage(),
  };
}

// Только Binance WS — для графика (тротлинг до 1 раз/сек, без джиттера от средневзвешенной)
let wsThrottleTime = 0;
export function subscribeToBinanceWs(callback: (price: number) => void): () => void {
  // Оборачиваем callback в тротлинг
  const throttled = (p: number) => {
    const now = Date.now();
    if (now - wsThrottleTime < 1000) return;
    wsThrottleTime = now;
    callback(p);
  };
  wsOnlyListeners.add(throttled);
  ensureConnection();
  if (sources.binanceWs > 0) callback(sources.binanceWs);
  return () => { wsOnlyListeners.delete(throttled); };
}
