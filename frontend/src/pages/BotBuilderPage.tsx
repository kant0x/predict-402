import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useDeposit, ORACLE_API } from '../context/DepositContext';
import { BotCard } from '../components/BotCard';
import { BotConfigPanel } from '../components/BotConfigPanel';
import type { BotConfig, BotStatus } from '../components/BotCard';

const DEFAULT_PROMPT = `You are a cryptocurrency trading analyst specializing in Bitcoin.
Analyze current BTC/USDT market conditions and predict whether
Bitcoin will go UP or DOWN in the next 5 minutes.

Consider: recent price momentum, volatility patterns, support/resistance levels.

Respond with EXACTLY this JSON format:
{"direction": "UP" or "DOWN", "confidence": 0-100, "reason": "brief explanation"}`;

function createDefaultBot(): BotConfig {
  return {
    id: crypto.randomUUID(),
    name: 'New Bot',
    strategy: 'llm',
    model: 'gemini-2.5-flash',
    temperature: 0.2,
    maxTokens: 200,
    systemPrompt: DEFAULT_PROMPT,
    maxBetEth: 0.01,
    minConfidence: 60,
    betScaling: { high: 100, mid: 50, low: 0 },
    createdAt: Date.now(),
  };
}

function getStorageKey(address: string) {
  return `predict402_bots_${address.toLowerCase()}`;
}

function loadBots(address: string): BotConfig[] {
  try {
    const raw = localStorage.getItem(getStorageKey(address));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveBots(address: string, bots: BotConfig[]) {
  localStorage.setItem(getStorageKey(address), JSON.stringify(bots));
}

const emptyStatus: BotStatus = { running: false, wins: 0, losses: 0, logs: [] };

export function BotBuilderPage() {
  const { address, isConnected } = useAccount();
  const { depositAddress, balances } = useDeposit();

  const [bots, setBots] = useState<BotConfig[]>([]);
  const [statuses, setStatuses] = useState<Record<string, BotStatus>>({});
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [hoverCreate, setHoverCreate] = useState(false);

  // Load bots from localStorage
  useEffect(() => {
    if (address) setBots(loadBots(address));
  }, [address]);

  // Save bots to localStorage whenever they change
  useEffect(() => {
    if (address && bots.length >= 0) saveBots(address, bots);
  }, [address, bots]);

  // Poll bot statuses every 5 seconds
  const fetchStatuses = useCallback(async () => {
    if (!address || bots.length === 0) return;
    for (const bot of bots) {
      try {
        const res = await fetch(`${ORACLE_API}/api/bot/status?player=${address}&bot_id=${bot.id}`);
        if (res.ok) {
          const data = await res.json();
          setStatuses(prev => ({
            ...prev,
            [bot.id]: {
              running: data.running ?? false,
              wins: data.wins ?? 0,
              losses: data.losses ?? 0,
              logs: data.logs ?? [],
            },
          }));
        }
      } catch {
        // silent — bot may not exist on backend yet
      }
    }
  }, [address, bots]);

  useEffect(() => {
    fetchStatuses();
    const interval = setInterval(fetchStatuses, 5000);
    return () => clearInterval(interval);
  }, [fetchStatuses]);

  const handleCreate = () => {
    const newBot = createDefaultBot();
    setBots(prev => [...prev, newBot]);
    setSelectedBotId(newBot.id);
  };

  const handleSave = (updated: BotConfig) => {
    setBots(prev => prev.map(b => b.id === updated.id ? updated : b));
  };

  const handleDelete = (id: string) => {
    setBots(prev => prev.filter(b => b.id !== id));
    if (selectedBotId === id) setSelectedBotId(null);
  };

  const handleStart = async (bot: BotConfig) => {
    if (!address) return;
    try {
      await fetch(`${ORACLE_API}/api/bot/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player: address,
          bot_id: bot.id,
          max_bet_eth: bot.maxBetEth,
          strategy: bot.strategy,
          model: bot.model,
          temperature: bot.temperature,
          max_tokens: bot.maxTokens,
          system_prompt: bot.systemPrompt,
          min_confidence: bot.minConfidence,
          bet_scaling: bot.betScaling,
        }),
      });
      fetchStatuses();
    } catch (e) {
      console.error('Bot start error:', e);
    }
  };

  const handleStop = async (botId: string) => {
    if (!address) return;
    try {
      await fetch(`${ORACLE_API}/api/bot/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: address, bot_id: botId }),
      });
      fetchStatuses();
    } catch (e) {
      console.error('Bot stop error:', e);
    }
  };

  if (!isConnected) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: 'calc(100vh - 64px)', background: '#0a0a0a', gap: '16px',
      }}>
        <div style={{ fontSize: '2.5rem' }}>🤖</div>
        <div style={{ fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 600 }}>Prediction Bots</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Connect your wallet to create and manage trading bots</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 64px)', background: '#0a0a0a',
      padding: '24px 32px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.5rem' }}>🤖</span>
          <h1 style={{
            fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)',
            margin: 0, letterSpacing: '-0.02em',
          }}>PREDICTION BOTS</h1>
        </div>
        <button
          onClick={handleCreate}
          onMouseEnter={() => setHoverCreate(true)}
          onMouseLeave={() => setHoverCreate(false)}
          style={{
            padding: '10px 20px', borderRadius: '8px', cursor: 'pointer',
            background: hoverCreate ? 'rgba(91, 138, 114, 0.18)' : 'rgba(91, 138, 114, 0.1)',
            border: '1px solid rgba(91, 138, 114, 0.3)',
            color: 'var(--accent-success)', fontSize: '0.85rem', fontWeight: 600,
            fontFamily: 'inherit', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>+</span> Create Bot
        </button>
      </div>

      {/* Bot Grid */}
      {bots.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          color: 'var(--text-muted)', fontSize: '0.9rem',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.3 }}>🤖</div>
          <div style={{ marginBottom: '8px', color: 'var(--text-secondary)' }}>No bots yet</div>
          <div>Click <strong style={{ color: 'var(--accent-success)' }}>+ Create Bot</strong> to build your first trading bot</div>
        </div>
      ) : (
        <>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '8px',
          }}>
            {bots.map(bot => (
              <BotCard
                key={bot.id}
                bot={bot}
                status={statuses[bot.id] || emptyStatus}
                balance={balances}
                isSelected={selectedBotId === bot.id}
                onConfigure={() => setSelectedBotId(selectedBotId === bot.id ? null : bot.id)}
                onStart={() => handleStart(bot)}
                onStop={() => handleStop(bot.id)}
              />
            ))}
          </div>

          {/* Config Panel (expanded) */}
          {selectedBotId && bots.find(b => b.id === selectedBotId) && (
            <BotConfigPanel
              bot={bots.find(b => b.id === selectedBotId)!}
              status={statuses[selectedBotId] || emptyStatus}
              balance={balances}
              depositAddress={depositAddress}
              onSave={handleSave}
              onStart={() => handleStart(bots.find(b => b.id === selectedBotId)!)}
              onStop={() => handleStop(selectedBotId)}
              onDelete={() => handleDelete(selectedBotId)}
              onClose={() => setSelectedBotId(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
