"""
Predict 402 — AI Oracle Agent (OpenGradient ML + x402 + Vault402)

Architecture:
  1. Deploys BTC XGBoost workflow on OpenGradient for ML predictions.
  2. Auto-resolves rounds every 2-3s (realtime), fixes strike price.
  3. AI bot places real bets through Vault402 each round.
  4. Ask Oracle (x402 LLM) for user hints.

API:
  POST /api/user/init      → Create/Get deposit address
  GET  /api/user/balance    → Get OUSDC/OGETH balance
  POST /api/predict         → Ask LLM (x402) — user hint, NOT removed
  POST /api/bot/bet         → AI bot places real bet via Vault402
  POST /api/bot/start       → Start auto-betting bot
  POST /api/bot/stop        → Stop auto-betting bot
  GET  /api/market/status   → Round info, strike price, pools, AI signal
  GET  /api/price           → Get real BTC price
  POST /api/ai/predict      → Get ML model prediction
  GET  /api/ai/models       → List available AI models
  GET  /api/ai/status       → Workflow deployment status
"""

import os
import time
import json
import logging
import threading
import traceback
import numpy as np
import requests
from pathlib import Path
from dotenv import load_dotenv

import opengradient as og
from web3 import Web3
from eth_account import Account
from flask import Flask, request, jsonify
from flask_cors import CORS

# ──── Environment ────
load_dotenv(Path(__file__).parent / ".env")

PRIVATE_KEY       = os.getenv("PRIVATE_KEY", "")
CONTRACT_ADDRESS  = os.getenv("CONTRACT_ADDRESS", "")
VAULT_ADDRESS     = os.getenv("VAULT_ADDRESS", "")
RPC_URL           = "https://ogevmdevnet.opengradient.ai"
CHAIN_ID          = 10740
API_PORT          = int(os.getenv("API_PORT", "3402"))
DEFAULT_MODEL     = os.getenv("DEFAULT_MODEL", "gemini-2.5-flash")

OUSDC_ADDRESS = "0x48515A4b24f17cadcD6109a9D85a57ba55a619a6"

PRICE_URLS_BINANCE = {
    "btc": "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT",
    "eth": "https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT",
    "sui": "https://api.binance.com/api/v3/ticker/price?symbol=SUIUSDT",
}

AVAILABLE_MODELS = {
    # OpenAI
    "gpt-4o":            og.TEE_LLM.GPT_4O,
    "gpt-4-1":           og.TEE_LLM.GPT_4_1_2025_04_14,
    "o4-mini":           og.TEE_LLM.O4_MINI,
    # Anthropic
    "claude-sonnet":     og.TEE_LLM.CLAUDE_4_0_SONNET,
    "claude-haiku":      og.TEE_LLM.CLAUDE_3_5_HAIKU,
    # Google
    "gemini-2.5-flash":  og.TEE_LLM.GEMINI_2_5_FLASH,
    "gemini-2.5-pro":    og.TEE_LLM.GEMINI_2_5_PRO,
    # xAI
    "grok-3":            og.TEE_LLM.GROK_3_BETA,
    "grok-4-1":          og.TEE_LLM.GROK_4_1_FAST,
}

AI_MODELS = {
    "btc_xgboost": {
        "model_cid": "shoeiico/og_btcusdt_1hour_return_xgb",
        "name": "BTC XGBoost",
        "asset": "btc",
        "pair": ("BTC", "USDT"),
        "type": "XGBoost (1hr)",
        "description": "XGBoost 1-hour return prediction for BTC/USDT",
        "candle_duration": 60,
        "total_candles": 24,
        "input_tensor": "input",
        "candle_types": [og.CandleType.CLOSE, og.CandleType.HIGH, og.CandleType.LOW, og.CandleType.OPEN, og.CandleType.VOLUME],
        "scheduler_frequency": 300,
    },
}

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("agent")

ERC20_ABI = [
    {"constant": True, "inputs": [{"name": "_owner", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "balance", "type": "uint256"}], "type": "function"}
]

# ──── Contract ABIs (UP/DOWN version) ────
PREDICT_ABI = [
    {"inputs": [{"name": "_closingPrice", "type": "uint256"}, {"name": "_proofHash", "type": "string"}], "name": "resolveRound", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
    {"inputs": [{"name": "_strikePrice", "type": "uint256"}], "name": "startNewRound", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
    {"inputs": [{"name": "_strikePrice", "type": "uint256"}], "name": "startFirstRound", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
    {"inputs": [{"name": "_isUp", "type": "bool"}], "name": "placeBet", "outputs": [], "stateMutability": "payable", "type": "function"},
    {"inputs": [{"name": "_user", "type": "address"}, {"name": "_isUp", "type": "bool"}], "name": "placeBetFromVault", "outputs": [], "stateMutability": "payable", "type": "function"},
    {"inputs": [{"name": "_player", "type": "address"}, {"name": "_predictedPrice", "type": "uint256"}, {"name": "_paymentHash", "type": "string"}, {"name": "_model", "type": "string"}, {"name": "_direction", "type": "string"}], "name": "storeAiPrediction", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
    {"inputs": [], "name": "currentRoundId", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "roundEndTime", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "getStrikePrice", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "getUpPool", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "getDownPool", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "totalPool", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "", "type": "address"}], "name": "nicknames", "outputs": [{"name": "", "type": "string"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "_roundId", "type": "uint256"}], "name": "getRoundInfo", "outputs": [{"components": [{"name": "startTime", "type": "uint256"}, {"name": "endTime", "type": "uint256"}, {"name": "strikePrice", "type": "uint256"}, {"name": "closingPrice", "type": "uint256"}, {"name": "upPool", "type": "uint256"}, {"name": "downPool", "type": "uint256"}, {"name": "totalPool", "type": "uint256"}, {"name": "upShares", "type": "uint256"}, {"name": "downShares", "type": "uint256"}, {"name": "totalBets", "type": "uint256"}, {"name": "resolved", "type": "bool"}, {"name": "upWon", "type": "bool"}, {"name": "proofHash", "type": "string"}], "name": "", "type": "tuple"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "distributeDevFee", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
    {"inputs": [], "name": "accruedFees", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "timeUntilNextDevFee", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
]

VAULT_ABI = [
    {"inputs": [{"name": "_users", "type": "address[]"}, {"name": "_amounts", "type": "uint256[]"}, {"name": "_isUp", "type": "bool"}], "name": "placeBetBatch", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
    {"inputs": [{"name": "_user", "type": "address"}], "name": "getBalance", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "deposit", "outputs": [], "stateMutability": "payable", "type": "function"},
]

# ═══════════════════════════════════════════════════
#  User / Wallet Manager
# ═══════════════════════════════════════════════════

class UserManager:
    DB_FILE = Path(__file__).parent / "users.json"

    def __init__(self, w3: Web3):
        self.w3 = w3
        self.users = self._load_db()

    def _load_db(self):
        if self.DB_FILE.exists():
            with open(self.DB_FILE) as f:
                return json.load(f)
        return {}

    def _save_db(self):
        with open(self.DB_FILE, "w") as f:
            json.dump(self.users, f, indent=2)

    def get_or_create_wallet(self, player_address: str) -> dict:
        player_address = player_address.lower()
        if player_address in self.users:
            return self.users[player_address]
        acct = Account.create()
        wallet = {
            "address": acct.address,
            "private_key": acct._private_key.hex(),
            "created_at": time.time()
        }
        self.users[player_address] = wallet
        self._save_db()
        log.info(f"Created deposit wallet {wallet['address']} for player {player_address}")
        return wallet

    def get_wallet(self, player_address: str):
        return self.users.get(player_address.lower())

    def get_balances(self, wallet_address: str) -> dict:
        eth_wei = self.w3.eth.get_balance(wallet_address)
        ousdc_contract = self.w3.eth.contract(address=OUSDC_ADDRESS, abi=ERC20_ABI)
        try:
            ousdc_wei = ousdc_contract.functions.balanceOf(wallet_address).call()
        except Exception:
            ousdc_wei = 0
        return {
            "eth": float(self.w3.from_wei(eth_wei, 'ether')),
            "eth_wei": eth_wei,
            "ousdc": ousdc_wei / 1e6,
        }

# ═══════════════════════════════════════════════════
#  AI Model Oracle (OpenGradient ML Inference)
# ═══════════════════════════════════════════════════

class AIModelOracle:
    WORKFLOWS_FILE = Path(__file__).parent / "workflows.json"

    def __init__(self, private_key: str):
        self.client = og.Client(private_key=private_key)
        self.workflows = self._load_workflows()
        self.last_predictions = {}
        self._lock = threading.Lock()

    def _load_workflows(self) -> dict:
        if self.WORKFLOWS_FILE.exists():
            with open(self.WORKFLOWS_FILE) as f:
                return json.load(f)
        return {}

    def _save_workflows(self):
        with open(self.WORKFLOWS_FILE, "w") as f:
            json.dump(self.workflows, f, indent=2)

    def deploy_workflow(self, model_key: str) -> str:
        config = AI_MODELS[model_key]
        base, quote = config["pair"]
        log.info(f"[AI] Deploying workflow for {config['name']} ({config['model_cid']})...")
        input_query = og.HistoricalInputQuery(
            base=base, quote=quote,
            total_candles=config["total_candles"],
            candle_duration_in_mins=config["candle_duration"],
            order=og.CandleOrder.DESCENDING,
            candle_types=config["candle_types"],
        )
        scheduler = og.SchedulerParams(
            frequency=config["scheduler_frequency"],
            duration_hours=24,
        )
        contract_address = self.client.alpha.new_workflow(
            model_cid=config["model_cid"],
            input_query=input_query,
            input_tensor_name=config["input_tensor"],
            scheduler_params=scheduler,
        )
        self.workflows[model_key] = {
            "address": contract_address,
            "model_cid": config["model_cid"],
            "name": config["name"],
            "deployed_at": time.time(),
            "expires_at": time.time() + 24 * 3600,
        }
        self._save_workflows()
        log.info(f"[AI] Workflow deployed: {config['name']} -> {contract_address}")
        return contract_address

    def deploy_all(self):
        for model_key in AI_MODELS:
            try:
                if model_key in self.workflows:
                    wf = self.workflows[model_key]
                    if wf.get("expires_at", 0) > time.time():
                        log.info(f"[AI] Workflow {model_key} already deployed at {wf['address']}")
                        continue
                self.deploy_workflow(model_key)
                time.sleep(2)
            except Exception as e:
                log.error(f"[AI] Failed to deploy {model_key}: {e}")
                log.error(traceback.format_exc())

    def run_prediction(self, model_key: str) -> dict:
        if model_key not in self.workflows:
            raise ValueError(f"Workflow {model_key} not deployed")
        config = AI_MODELS[model_key]
        wf = self.workflows[model_key]
        contract_address = wf["address"]
        log.info(f"[AI] Running inference: {config['name']} ({contract_address[:10]}...)")
        try:
            result = self.client.alpha.run_workflow(contract_address)
        except Exception as e:
            log.warning(f"[AI] run_workflow failed ({e}), trying read_workflow_result...")
            result = self.client.alpha.read_workflow_result(contract_address)
        prediction = self._parse_model_output(result, config)
        prediction["workflow_address"] = contract_address
        prediction["model_key"] = model_key
        prediction["timestamp"] = time.time()
        with self._lock:
            self.last_predictions[model_key] = prediction
        log.info(f"[AI] {config['name']}: {prediction['direction']} "
                 f"(return: {prediction['predicted_return']:.4f}, "
                 f"confidence: {prediction['confidence']:.0f}%)")
        return prediction

    def _parse_model_output(self, output: og.ModelOutput, config: dict) -> dict:
        direction = "UP"
        predicted_return = 0.0
        confidence = 50.0
        raw_data = {}
        if hasattr(output, 'numbers') and output.numbers:
            for key, arr in output.numbers.items():
                val = float(arr.flat[0]) if arr.size > 0 else 0.0
                raw_data[key] = val
                key_lower = key.lower()
                if any(w in key_lower for w in ['return', 'prediction', 'output', 'forecast', 'pred']):
                    predicted_return = val
                elif any(w in key_lower for w in ['volatility', 'vol', 'sigma', 'variance']):
                    predicted_return = val
                elif any(w in key_lower for w in ['direction', 'signal', 'class']):
                    direction = "UP" if val > 0 else "DOWN"
        if predicted_return != 0:
            direction = "UP" if predicted_return > 0 else "DOWN"
        abs_return = abs(predicted_return)
        if abs_return > 0.01:
            confidence = min(95, 65 + abs_return * 1000)
        elif abs_return > 0.001:
            confidence = min(85, 55 + abs_return * 5000)
        else:
            confidence = 50 + abs_return * 10000
        confidence = max(40, min(98, confidence))
        return {
            "direction": direction,
            "predicted_return": predicted_return,
            "confidence": round(confidence, 1),
            "model": config["name"],
            "model_cid": config["model_cid"],
            "model_type": config["type"],
            "asset": config["asset"],
            "raw_output": raw_data,
            "is_simulation": getattr(output, 'is_simulation_result', False),
        }

    def get_cached_prediction(self, model_key: str) -> dict | None:
        with self._lock:
            return self.last_predictions.get(model_key)

    def get_prediction_for_asset(self, asset: str) -> dict | None:
        best = None
        best_time = 0
        with self._lock:
            for key, pred in self.last_predictions.items():
                if pred["asset"] == asset and pred["timestamp"] > best_time:
                    best = pred
                    best_time = pred["timestamp"]
        return best

    def get_all_predictions(self) -> dict:
        with self._lock:
            return dict(self.last_predictions)

    def prediction_loop(self):
        log.info("[AI] Starting prediction loop...")
        while True:
            for model_key in AI_MODELS:
                try:
                    if model_key in self.workflows:
                        self.run_prediction(model_key)
                except Exception as e:
                    log.error(f"[AI] Prediction error for {model_key}: {e}")
                time.sleep(5)
            time.sleep(30)

# ═══════════════════════════════════════════════════
#  x402 LLM Oracle (Ask Oracle — user hints)
# ═══════════════════════════════════════════════════

class X402Oracle:
    def __init__(self, private_key: str, default_model: str = DEFAULT_MODEL):
        self.client = og.Client(private_key=private_key)
        self.default_model = AVAILABLE_MODELS.get(default_model, og.TEE_LLM.GEMINI_2_5_FLASH)
        self.model_label = default_model

    def get_prediction(self, model_name: str | None = None) -> dict:
        model = AVAILABLE_MODELS.get(model_name, self.default_model)
        label = model_name or self.model_label
        log.info(f"[x402] User requesting BTC prediction ({label})...")
        result = self.client.llm.completion(
            model=model,
            prompt=(
                "Analyze the Bitcoin (BTC) market right now. "
                "Where will the price go in the next 5 minutes? "
                "Provide:\n"
                "1. Direction (UP or DOWN)\n"
                "2. Brief reasoning (1-2 sentences)\n"
                "Format:\nDIRECTION: UP\nREASON: Bitcoin showing bullish momentum...\n"
            ),
            max_tokens=100,
            x402_settlement_mode=og.x402SettlementMode.SETTLE_INDIVIDUAL_WITH_METADATA,
        )
        raw = result.completion_output.strip()
        direction = "UP" if "UP" in raw.upper().split("DIRECTION")[-1][:20] else "DOWN"
        reason = ""
        for line in raw.split("\n"):
            if "REASON:" in line.upper():
                reason = line.split(":", 1)[-1].strip()
                break
        if not reason:
            reason = raw

        log.info(f"[x402] Oracle: {direction} | Hash: {result.payment_hash[:10]}...")
        return {
            "direction": direction,
            "reason": reason,
            "payment_hash": result.payment_hash,
            "model": label,
            "raw_output": raw,
        }

# ═══════════════════════════════════════════════════
#  Price Fetcher
# ═══════════════════════════════════════════════════

def get_crypto_price_usd(asset: str = "btc") -> float:
    """Fetch price from Binance (same source as frontend WebSocket)."""
    try:
        url = PRICE_URLS_BINANCE.get(asset, PRICE_URLS_BINANCE["btc"])
        resp = requests.get(url, timeout=5)
        resp.raise_for_status()
        return float(resp.json()["price"])
    except Exception as e:
        log.error(f"Failed to fetch {asset.upper()} price from Binance: {e}")
        return 0.0

def get_btc_price_usd() -> float:
    return get_crypto_price_usd("btc")

# ═══════════════════════════════════════════════════
#  Bot State (multi-player auto-betting)
# ═══════════════════════════════════════════════════

BOT_STATE_FILE = os.path.join(os.path.dirname(__file__), "bot_state.json")

# BOTS: dict keyed by player address (lowercase)
# Each entry: {"active": bool, "max_bet_eth": float, "last_bet_round": int,
#              "last_prediction": dict|None, "logs": list, "total_bets": int, ...}
BOTS: dict[str, dict] = {}
_bots_lock = threading.Lock()

def _default_bot_state() -> dict:
    return {
        "active": False,
        "max_bet_eth": 0.01,
        "last_bet_round": 0,
        "last_prediction": None,
        "logs": [],
        "total_bets": 0,
        "wins": 0,
        "losses": 0,
    }

def _get_bot(player: str) -> dict:
    """Get or create bot state for a player."""
    p = player.lower()
    with _bots_lock:
        if p not in BOTS:
            BOTS[p] = _default_bot_state()
        return BOTS[p]

def _load_bot_state():
    """Restore bot state from file (survives agent restarts)."""
    global BOTS
    try:
        if os.path.exists(BOT_STATE_FILE):
            with open(BOT_STATE_FILE, "r") as f:
                saved = json.load(f)
            # Migration: old single-player format → new multi-player
            if "player" in saved and "active" in saved:
                old_player = saved.get("player")
                if old_player:
                    p = old_player.lower()
                    BOTS[p] = _default_bot_state()
                    BOTS[p].update({
                        "active": saved.get("active", False),
                        "max_bet_eth": saved.get("max_bet_eth", 0.01),
                        "last_bet_round": saved.get("last_bet_round", 0),
                        "last_prediction": saved.get("last_prediction"),
                        "logs": saved.get("logs", []),
                        "total_bets": saved.get("total_bets", 0),
                        "wins": saved.get("wins", 0),
                        "losses": saved.get("losses", 0),
                    })
                    log.info(f"[BOT] Migrated old single-player state for {p[:10]}...")
            else:
                # New multi-player format
                BOTS = saved
            active_count = sum(1 for b in BOTS.values() if b.get("active"))
            log.info(f"[BOT] Restored {len(BOTS)} bot(s), {active_count} active")
    except Exception as e:
        log.error(f"[BOT] Failed to load state: {e}")

def _save_bot_state():
    """Persist bot state to file."""
    try:
        with _bots_lock:
            data = dict(BOTS)
        with open(BOT_STATE_FILE, "w") as f:
            json.dump(data, f, default=str)
    except Exception as e:
        log.error(f"[BOT] Failed to save state: {e}")

def bot_add_log(player: str, msg: str, save: bool = False):
    ts = time.strftime("%H:%M:%S")
    entry = f"{ts} {msg}"
    bot = _get_bot(player)
    bot["logs"].append(entry)
    if len(bot["logs"]) > 50:
        bot["logs"] = bot["logs"][-50:]
    log.info(f"[BOT:{player[:8]}] {msg}")
    if save:
        _save_bot_state()

def _get_active_players() -> list[str]:
    """Return list of player addresses with active bots."""
    with _bots_lock:
        return [p for p, b in BOTS.items() if b.get("active")]

# Load saved bot state from previous run
_load_bot_state()

# ═══════════════════════════════════════════════════
#  API Server
# ═══════════════════════════════════════════════════

app = Flask(__name__)
CORS(app, origins=[
    'https://predict402.cloud',
    'http://localhost:5173',
    'http://localhost:3000',
])

w3 = Web3(Web3.HTTPProvider(RPC_URL))
user_mgr = UserManager(w3)
predict_contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=PREDICT_ABI) if CONTRACT_ADDRESS else None
vault_contract = w3.eth.contract(address=VAULT_ADDRESS, abi=VAULT_ABI) if VAULT_ADDRESS else None

ai_oracle = None
if PRIVATE_KEY:
    try:
        ai_oracle = AIModelOracle(PRIVATE_KEY)
        log.info("[AI] Oracle initialized")
    except Exception as e:
        log.error(f"[AI] Failed to init oracle: {e}")

# Market state cache (+ thread lock for safe access from auto_resolve thread)
MARKET_STATE = {
    "strike_price": 0.0,
    "round_id": 0,
    "end_time": 0,
    "up_pool": 0,
    "down_pool": 0,
}
_market_lock = threading.Lock()

# ──── User Endpoints ────

@app.route("/api/user/init", methods=["POST"])
def init_user():
    player = request.json.get("player")
    if not player:
        return jsonify({"error": "No player"}), 400
    wallet = user_mgr.get_or_create_wallet(player)
    balances = user_mgr.get_balances(wallet["address"])
    return jsonify({"deposit_address": wallet["address"], "balances": balances})

@app.route("/api/user/balance", methods=["GET"])
def get_balance():
    player = request.args.get("player")
    wallet = user_mgr.get_wallet(player)
    if not wallet:
        return jsonify({"error": "User not found"}), 404
    return jsonify(user_mgr.get_balances(wallet["address"]))

# ──── Ask Oracle (x402 LLM — user hint) ────

@app.route("/api/predict", methods=["POST"])
def predict():
    """Ask LLM via x402 — gives user a hint on direction. NOT removed."""
    player = request.json.get("player")
    model_name = request.json.get("model")
    wallet = user_mgr.get_wallet(player)
    if not wallet:
        return jsonify({"error": "Deposit wallet not found. Init first."}), 400
    bals = user_mgr.get_balances(wallet["address"])
    if bals["ousdc"] < 0.01:
        return jsonify({"error": "Insufficient OUSDC balance. Please deposit."}), 402
    try:
        user_oracle = X402Oracle(wallet["private_key"])
        data = user_oracle.get_prediction(model_name)
        return jsonify(data)
    except Exception as e:
        log.error(f"Predict error: {e}")
        return jsonify({"error": str(e)}), 500

# ──── AI Model Prediction ────

@app.route("/api/ai/predict", methods=["POST"])
def ai_predict():
    if not ai_oracle:
        return jsonify({"error": "AI Oracle not initialized"}), 503
    data = request.json or {}
    asset = data.get("asset", "btc").lower()
    model_key = data.get("model_key", "")
    fresh = data.get("fresh", False)
    try:
        if model_key:
            if model_key not in AI_MODELS:
                return jsonify({"error": f"Unknown model: {model_key}"}), 400
            if fresh or not ai_oracle.get_cached_prediction(model_key):
                prediction = ai_oracle.run_prediction(model_key)
            else:
                prediction = ai_oracle.get_cached_prediction(model_key)
        else:
            asset_models = [k for k, v in AI_MODELS.items() if v["asset"] == asset]
            if not asset_models:
                return jsonify({"error": f"No models for asset '{asset}'"}), 400
            prediction = ai_oracle.get_prediction_for_asset(asset)
            if not prediction or fresh:
                prediction = ai_oracle.run_prediction(asset_models[0])
        return jsonify(prediction)
    except Exception as e:
        log.error(f"AI predict error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/ai/models", methods=["GET"])
def ai_models():
    models = []
    for key, config in AI_MODELS.items():
        wf = ai_oracle.workflows.get(key) if ai_oracle else None
        cached = ai_oracle.get_cached_prediction(key) if ai_oracle else None
        models.append({
            "key": key, "name": config["name"],
            "model_cid": config["model_cid"], "asset": config["asset"],
            "type": config["type"], "description": config["description"],
            "deployed": wf is not None,
            "workflow_address": wf["address"] if wf else None,
            "last_prediction": cached,
        })
    return jsonify({"models": models})

@app.route("/api/ai/status", methods=["GET"])
def ai_status():
    if not ai_oracle:
        return jsonify({"status": "not_initialized", "workflows": {}})
    return jsonify({
        "status": "active",
        "workflows": ai_oracle.workflows,
        "predictions": {k: {
            "direction": v["direction"], "confidence": v["confidence"],
            "predicted_return": v["predicted_return"], "timestamp": v["timestamp"],
        } for k, v in ai_oracle.get_all_predictions().items()},
    })

# ──── Bot Control ────

@app.route("/api/bot/start", methods=["POST"])
def bot_start():
    """Start the auto-betting bot for a player."""
    data = request.json or {}
    player = data.get("player")
    max_bet = float(data.get("max_bet_eth", 0.01))
    if not player:
        return jsonify({"error": "No player address"}), 400
    bot = _get_bot(player)
    bot["active"] = True
    bot["max_bet_eth"] = max_bet
    bot_add_log(player, f"Bot started | max bet: {max_bet} ETH")
    _save_bot_state()

    # If there's an active round right now, we can try to join late
    round_id = MARKET_STATE.get("round_id", 0)
    end_time = MARKET_STATE.get("end_time", 0)
    now = int(time.time())
    if round_id > 0 and end_time > now:
         # Optionally trigger batch just for this player?
         # _process_batch_bets([player]) 
         # But safer to wait for next round cycle.
         bot_add_log(player, "Bot activated. Waiting for next round cycle...")

    active_count = len(_get_active_players())
    return jsonify({"status": "started", "running": True, "max_bet_eth": max_bet,
                    "active_bots": active_count})

@app.route("/api/bot/stop", methods=["POST"])
def bot_stop():
    """Stop the auto-betting bot for a player."""
    data = request.json or {}
    player = data.get("player")
    if not player:
        return jsonify({"error": "No player address"}), 400
    bot = _get_bot(player)
    bot["active"] = False
    bot_add_log(player, "Bot stopped by user")
    _save_bot_state()
    return jsonify({"status": "stopped", "running": False})

@app.route("/api/bot/status", methods=["GET"])
def bot_status():
    """Get bot status and recent logs for a specific player."""
    player = request.args.get("player")
    if not player:
        # Return summary of all active bots
        active = _get_active_players()
        return jsonify({"active_bots": len(active), "players": active})

    bot = _get_bot(player)

    # Get on-chain nickname
    player_nick = ""
    if predict_contract:
        try:
            player_nick = predict_contract.functions.nicknames(
                Web3.to_checksum_address(player)
            ).call()
        except:
            pass

    return jsonify({
        "running": bot["active"],
        "active": bot["active"],
        "player": player,
        "player_nickname": player_nick,
        "bot_name": "BTC XGBoost ML",
        "max_bet_eth": bot["max_bet_eth"],
        "last_bet_round": bot["last_bet_round"],
        "last_prediction": bot["last_prediction"],
        "logs": bot["logs"][-20:],
        "total_bets": bot.get("total_bets", 0),
        "wins": bot.get("wins", 0),
        "losses": bot.get("losses", 0),
    })

@app.route("/api/bot/bet", methods=["POST"])
def bot_bet_manual():
    """Manually trigger bot to place a bet this round."""
    data = request.json or {}
    player = data.get("player")
    if not player:
        return jsonify({"error": "No player address"}), 400
    bot = _get_bot(player)
    if not bot["active"]:
        return jsonify({"error": "Bot not started for this player"}), 400
    result = _process_batch_bets([player])
    if result:
        return jsonify({"status": "Batch triggered for user"})
    return jsonify({"error": "Could not place bet (see logs)"}), 500

def _process_batch_bets(specific_players: list[str] = None):
    """
    Batch Betting: Collects all active players, runs AI ONCE, puts bets in ONE tx.
    Safely handles gas reimbursement from Vault.
    """
    if not ai_oracle or not vault_contract or not predict_contract:
        log.error("BatchBet: Oracle or contracts not configured")
        return

    # 1. Identify players to bet for
    if specific_players:
        targets = specific_players
    else:
        targets = _get_active_players()
    
    if not targets:
        return

    log.info(f"[BATCH] Processing bets for {len(targets)} players...")

    # 2. Run AI Prediction (Once for everyone)
    try:
        # Use cached if fresh (<60s) or run new
        # For new round start, usually we want fresh
        prediction = ai_oracle.run_prediction("btc_xgboost")
    except Exception as e:
        log.error(f"[BATCH] AI prediction failed: {e}")
        return

    direction = prediction["direction"]
    confidence = prediction["confidence"]
    predicted_return = prediction["predicted_return"]
    is_up = direction == "UP"

    # 3. Time factor (check round time)
    now = int(time.time())
    end_time = MARKET_STATE.get("end_time", 0)
    remaining_sec = max(0, end_time - now)
    
    if remaining_sec < 45:
        log.warning(f"[BATCH] Skipping - too late in round ({remaining_sec}s left)")
        return
        
    time_factor = min(1.0, remaining_sec / 300)
    
    # 4. Prepare Batch Arrays
    batch_users = []
    batch_amounts = []
    
    # We need to calculate bets for each user
    for player in targets:
        bot = _get_bot(player)
        
        # Skip if already bet this round (unless manual force)
        if not specific_players and bot["last_bet_round"] >= MARKET_STATE["round_id"]:
            continue

        # Logic for amount
        max_bet = bot["max_bet_eth"]
        
        # Scale by confidence
        adjusted_conf = confidence * (0.5 + 0.5 * time_factor)
        if adjusted_conf >= 75:
            bet_eth = max_bet
        elif adjusted_conf >= 60:
            bet_eth = max_bet * 0.5
        else:
            bet_eth = max_bet * 0.25
        
        # Scale by time
        bet_eth = max(0.001, bet_eth * (0.4 + 0.6 * time_factor))
        bet_wei = w3.to_wei(bet_eth, 'ether')
        
        # Check Balance (Vault)
        try:
            # We add a buffer for gas fee estimation (e.g. 0.0002 ETH)
            # The contract also checks this, but we want to fail fast here to avoid revert
            vault_bal = vault_contract.functions.getBalance(Web3.to_checksum_address(player)).call()
            gas_buffer = w3.to_wei(0.0005, 'ether') 
            
            if vault_bal >= bet_wei + gas_buffer:
                batch_users.append(Web3.to_checksum_address(player))
                batch_amounts.append(bet_wei)
                
                # Log intent
                bot_add_log(player, f"Queueing Batch Bet: {direction} | {bet_eth:.4f} ETH")
            else:
                bot_add_log(player, f"Skipping: Insufficient Vault Balance ({w3.from_wei(vault_bal,'ether')} < {bet_eth}+gas)")
        except Exception as e:
            bot_add_log(player, f"Balance check error: {e}")
            
    if not batch_users:
        log.info("[BATCH] No valid bets to place.")
        return

    # 5. Send Transaction
    try:
        log.info(f"[BATCH] Sending TX for {len(batch_users)} users. Direction: {direction}")
        acct = Account.from_key(PRIVATE_KEY)
        nonce = w3.eth.get_transaction_count(acct.address, 'pending')
        
        # Gas estimation: ~100k + 100k per user?
        # Let's use estimateGas or hardcode safe limit
        gas_limit = 200000 + (len(batch_users) * 150000)
        
        tx = vault_contract.functions.placeBetBatch(
            batch_users, batch_amounts, is_up
        ).build_transaction({
            "from": acct.address,
            "nonce": nonce,
            "gas": gas_limit,
            "gasPrice": w3.eth.gas_price,
            "chainId": CHAIN_ID,
        })
        
        signed = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        
        log.info(f"[BATCH] Tx Sent: {tx_hash.hex()}")
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=45)
        
        if receipt.status == 1:
            log.info("[BATCH] Tx Success!")
            # Update state for all included users
            for i, user_cs in enumerate(batch_users):
                player_addr = user_cs.lower()
                bot = _get_bot(player_addr)
                bot["total_bets"] = bot.get("total_bets", 0) + 1
                bot["last_bet_round"] = MARKET_STATE["round_id"]
                bot["last_prediction"] = {
                    "direction": direction,
                    "confidence": adjusted_conf / 100.0,
                    "predicted_return": predicted_return,
                    "bet_amount_eth": float(w3.from_wei(batch_amounts[i], 'ether')),
                    "tx_hash": tx_hash.hex(),
                    "timestamp": time.time()
                }
                bot_add_log(player_addr, f"Batch Bet Executed! Tx: {tx_hash.hex()[:10]}...")
            _save_bot_state()
        else:
            log.error("[BATCH] Tx Failed (Reverted)")
            
    except Exception as e:
         log.error(f"[BATCH] Transaction error: {e}")


# ──── Price ────

@app.route("/api/price", methods=["GET"])
def get_verified_price():
    asset = request.args.get("asset", "btc").lower()
    try:
        price = get_crypto_price_usd(asset)
        if price == 0:
            return jsonify({"error": "Could not fetch price"}), 500
        return jsonify({"price": price, "asset": asset})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ──── Market Status ────

@app.route("/api/market/status", methods=["GET"])
def market_status():
    if not predict_contract:
        return jsonify({"error": "Contract not connected"}), 503
    try:
        # Always read current round from contract to stay in sync
        on_chain_round = predict_contract.functions.currentRoundId().call()
        if on_chain_round != MARKET_STATE["round_id"] or MARKET_STATE["end_time"] == 0:
            with _market_lock:
                MARKET_STATE["round_id"] = on_chain_round
                MARKET_STATE["end_time"] = predict_contract.functions.roundEndTime().call()
                if on_chain_round > 0:
                    MARKET_STATE["strike_price"] = predict_contract.functions.getStrikePrice().call() / 100.0

        now = int(time.time())
        remaining = max(0, MARKET_STATE["end_time"] - now)

        # Read pools
        try:
            up_pool_wei = predict_contract.functions.getUpPool().call()
            down_pool_wei = predict_contract.functions.getDownPool().call()
            with _market_lock:
                MARKET_STATE["up_pool"] = float(w3.from_wei(up_pool_wei, 'ether'))
                MARKET_STATE["down_pool"] = float(w3.from_wei(down_pool_wei, 'ether'))
        except Exception:
            pass

        ai_signal = None
        if ai_oracle:
            ai_signal = ai_oracle.get_prediction_for_asset("btc")

        with _market_lock:
            response = {
                "roundId": MARKET_STATE["round_id"],
                "strikePrice": MARKET_STATE["strike_price"],
                "endTime": MARKET_STATE["end_time"],
                "remainingSeconds": remaining,
                "currentPrice": get_btc_price_usd(),
                "upPool": MARKET_STATE["up_pool"],
                "downPool": MARKET_STATE["down_pool"],
                "aiPrediction": ai_signal,
            }

        return jsonify(response)
    except Exception as e:
        log.error(f"Market status error: {e}")
        return jsonify({"error": str(e)}), 500


# ═══════════════════════════════════════════════════
#  Auto-Resolution (Realtime — fast round transitions)
# ═══════════════════════════════════════════════════


# Pre-fetched BTC price (updated in the last seconds of each round)
_prefetched_price = {"value": 0.0, "time": 0}


def _prefetch_btc_price():
    """Pre-fetch BTC price so it's ready immediately when round ends."""
    try:
        price = get_btc_price_usd()
        if price > 0:
            _prefetched_price["value"] = price
            _prefetched_price["time"] = time.time()
    except Exception:
        pass


def _get_best_price() -> float:
    """Return pre-fetched price if fresh (< 15s), otherwise fetch new."""
    if time.time() - _prefetched_price["time"] < 15 and _prefetched_price["value"] > 0:
        return _prefetched_price["value"]
    return get_btc_price_usd()


def auto_resolve():
    """Realtime round resolver — fast transitions, retry on failure."""
    if not PRIVATE_KEY or not CONTRACT_ADDRESS:
        log.warning("Auto-resolver disabled: no PRIVATE_KEY or CONTRACT_ADDRESS")
        return

    log.info("Auto-resolver started")
    acct = Account.from_key(PRIVATE_KEY)

    last_resolved_round = 0
    resolve_attempts = 0       # retry counter per round
    max_retries = 10           # more retries before backing off
    last_dev_fee_check = 0     # check every ~10 min

    while True:
        try:
            now = int(time.time())

            # ── Daily dev fee distribution (check every 10 min) ──
            if now - last_dev_fee_check > 600:
                last_dev_fee_check = now
                try:
                    time_until = predict_contract.functions.timeUntilNextDevFee().call()
                    pending = predict_contract.functions.accruedFees().call()
                    if time_until == 0 and pending > 0:
                        log.info(f"[DEV FEE] Distributing {w3.from_wei(pending, 'ether'):.6f} ETH to owner...")
                        nonce = w3.eth.get_transaction_count(acct.address, 'pending')
                        tx = predict_contract.functions.distributeDevFee().build_transaction({
                            "from": acct.address, "nonce": nonce,
                            "gas": 100_000, "gasPrice": w3.eth.gas_price, "chainId": CHAIN_ID,
                        })
                        signed = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)
                        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
                        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)
                        if receipt.status == 1:
                            log.info(f"[DEV FEE] Distributed! tx: {tx_hash.hex()[:16]}...")
                        else:
                            log.error("[DEV FEE] Distribution tx failed")
                except Exception as e:
                    log.error(f"[DEV FEE] Check error: {e}")

            # Read on-chain state
            round_id = predict_contract.functions.currentRoundId().call()
            end_time = predict_contract.functions.roundEndTime().call()
            
            if round_id > 0:
                 diff = end_time - now
                 log.info(f"[DEBUG] R#{round_id} End={end_time} Now={now} Diff={diff}")

            # Check if contract says round is already resolved
            is_resolved = False
            if round_id > 0:
                try:
                    rinfo = predict_contract.functions.getRoundInfo(round_id).call()
                    is_resolved = rinfo[10]  # resolved field (index 10: startTime,endTime,strikePrice,closingPrice,upPool,downPool,totalPool,upShares,downShares,totalBets,resolved)
                except:
                    pass

            # Sync cache
            if round_id != MARKET_STATE["round_id"] and round_id > 0:
                with _market_lock:
                    MARKET_STATE["round_id"] = round_id
                    MARKET_STATE["end_time"] = end_time
                    strike_cents = predict_contract.functions.getStrikePrice().call()
                    MARKET_STATE["strike_price"] = strike_cents / 100.0
                log.info(f"Synced to Round #{round_id}, strike: ${MARKET_STATE['strike_price']:.2f}")

            # ── Pre-fetch: start fetching price 10s before round ends ──
            time_until_end = end_time - now
            if 0 < time_until_end <= 10 and not is_resolved:
                _prefetch_btc_price()

            # ── Case 1: Round resolved on-chain but no new round started ──
            if is_resolved and round_id > 0:
                if round_id > last_resolved_round:
                    last_resolved_round = round_id
                # Start new round immediately
                price = _get_best_price()
                if price > 0:
                    log.info(f"Round #{round_id} already resolved. Starting new round...")
                    price_cents = int(price * 100)
                    nonce = w3.eth.get_transaction_count(acct.address, 'pending')
                    tx = predict_contract.functions.startNewRound(price_cents).build_transaction({
                        "from": acct.address,
                        "nonce": nonce,
                        "gas": 300_000,
                        "gasPrice": w3.eth.gas_price,
                        "chainId": CHAIN_ID,
                    })
                    signed = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)
                    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
                    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)
                    if receipt.status == 1:
                        _sync_new_round()
                    else:
                        log.error("startNewRound failed after resolved round")

            # ── Case 2: Round expired, needs resolving ──
            # Minimal 1s buffer (block.timestamp is close enough on OG devnet)
            elif now >= end_time + 1 and end_time > 0 and round_id > 0 and not is_resolved:
                if round_id <= last_resolved_round:
                    time.sleep(1)
                    continue

                # Retry logic: max 3 attempts per round
                if resolve_attempts >= max_retries:
                    log.error(f"Round #{round_id} failed {max_retries} times, waiting 30s before retry...")
                    resolve_attempts = 0  # Reset — try again after pause
                    time.sleep(30)
                    continue

                log.info(f"Round #{round_id} expired. Resolving (attempt {resolve_attempts + 1})...")

                # Use pre-fetched price (already loaded in pre-fetch phase)
                price = _get_best_price()
                if price == 0:
                    log.error("Cannot resolve: BTC price unavailable")
                    resolve_attempts += 1
                    time.sleep(2)
                    continue

                price_cents = int(price * 100)
                proof = f"binance-{now}"

                nonce = w3.eth.get_transaction_count(acct.address, 'pending')
                gas_price = w3.eth.gas_price

                # ── Resolve round ──
                # ── Resolve round ──
                tx = predict_contract.functions.resolveRound(price_cents, proof).build_transaction({
                    "from": acct.address,
                    "nonce": nonce,
                    "gas": 2_000_000,
                    "gasPrice": int(gas_price * 1.2),
                    "chainId": CHAIN_ID,
                })
                signed = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)
                tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
                receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)

                if receipt.status == 1:
                    last_resolved_round = round_id
                    resolve_attempts = 0
                    log.info(f"Round #{round_id} resolved! BTC=${price:.2f}")

                    # ── Start new round immediately — reuse price, increment nonce ──
                    new_price_cents = int(price * 100)
                    nonce2 = nonce + 1  # Fast nonce — no extra RPC call
                    tx2 = predict_contract.functions.startNewRound(new_price_cents).build_transaction({
                        "from": acct.address,
                        "nonce": nonce2,
                        "gas": 500_000,
                        "gasPrice": int(gas_price * 1.2),
                        "chainId": CHAIN_ID,
                    })
                    signed2 = w3.eth.account.sign_transaction(tx2, PRIVATE_KEY)
                    tx_hash2 = w3.eth.send_raw_transaction(signed2.raw_transaction)
                    receipt2 = w3.eth.wait_for_transaction_receipt(tx_hash2, timeout=30)

                    if receipt2.status == 1:
                        _sync_new_round()
                    else:
                        log.error("startNewRound tx failed")
                else:
                    resolve_attempts += 1
                    log.error(f"resolveRound tx failed (attempt {resolve_attempts}/{max_retries}). TX: {tx_hash.hex()[:16]}")
                    # Try to get revert reason
                    try:
                        w3.eth.call({
                            'to': CONTRACT_ADDRESS,
                            'data': tx['data'],
                            'from': acct.address,
                        })
                    except Exception as call_err:
                        log.error(f"Revert reason: {call_err}")
                    time.sleep(3 + resolve_attempts)  # Backoff
                    continue

            # ── Case 3: No rounds yet ──
            elif round_id == 0:
                price = get_btc_price_usd()
                if price > 0:
                    price_cents = int(price * 100)
                    nonce = w3.eth.get_transaction_count(acct.address, 'pending')
                    tx = predict_contract.functions.startFirstRound(price_cents).build_transaction({
                        "from": acct.address,
                        "nonce": nonce,
                        "gas": 300_000,
                        "gasPrice": w3.eth.gas_price,
                        "chainId": CHAIN_ID,
                    })
                    signed = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)
                    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
                    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)
                    if receipt.status == 1:
                        _sync_new_round()
                    else:
                        log.error("startFirstRound failed")

        except Exception as e:
            log.error(f"Auto-resolve error: {e}")
            log.error(traceback.format_exc())

        time.sleep(1)  # Fast 1s polling for snappy transitions


def _sync_new_round():
    """Sync MARKET_STATE from on-chain data after a new round starts, trigger bot."""
    new_round = predict_contract.functions.currentRoundId().call()
    new_end = predict_contract.functions.roundEndTime().call()
    strike_cents = predict_contract.functions.getStrikePrice().call()
    strike_usd = strike_cents / 100.0

    with _market_lock:
        MARKET_STATE["round_id"] = new_round
        MARKET_STATE["end_time"] = new_end
        MARKET_STATE["strike_price"] = strike_usd
        MARKET_STATE["up_pool"] = 0
        MARKET_STATE["down_pool"] = 0
    log.info(f"New Round #{new_round} started @ ${strike_usd:.2f}")

    # Auto-bot: place bets for ALL active players
    # Auto-bot: place bets for ALL active players via BATCH
    time.sleep(2) # Wait a bit for things to settle
    threading.Thread(target=_process_batch_bets, daemon=True).start()

# ═══════════════════════════════════════════════════
#  AI Workflows Deployment
# ═══════════════════════════════════════════════════

def deploy_ai_workflows():
    if not ai_oracle:
        log.warning("[AI] Oracle not initialized, skipping workflow deployment")
        return
    log.info("[AI] Starting workflow deployment...")
    time.sleep(5)
    try:
        ai_oracle.deploy_all()
        log.info("[AI] All workflows deployed! Starting prediction loop...")
        ai_oracle.prediction_loop()
    except Exception as e:
        log.error(f"[AI] Deployment error: {e}")
        log.error(traceback.format_exc())

def _heartbeat():
    """Log a heartbeat every 60s so we can detect silent deaths."""
    while True:
        time.sleep(60)
        active_count = len(_get_active_players())
        log.info(f"[HEARTBEAT] alive | Round #{MARKET_STATE['round_id']} | "
                 f"strike=${MARKET_STATE['strike_price']:.2f} | "
                 f"bots={active_count} active")


if __name__ == "__main__":
    import sys

    # Log unhandled exceptions
    def _excepthook(exc_type, exc_value, exc_tb):
        log.critical(f"UNHANDLED EXCEPTION: {exc_type.__name__}: {exc_value}")
        log.critical("".join(traceback.format_tb(exc_tb)))
    sys.excepthook = _excepthook

    t1 = threading.Thread(target=auto_resolve, daemon=True)
    t1.start()

    t2 = threading.Thread(target=deploy_ai_workflows, daemon=True)
    t2.start()

    t3 = threading.Thread(target=_heartbeat, daemon=True)
    t3.start()

    log.info(f"Agent running on port {API_PORT}")
    app.run(host="127.0.0.1", port=API_PORT)
