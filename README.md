# Predict 402 — Verifiable AI Prediction Market

## 📌 Problem we solve
Traditional crypto prediction markets rely on centralized oracles or slow crowdsourced consensus, leaving users vulnerable to manipulation. Retail traders often lack the time and analytical tools to stay ahead of market volatility 24/7. **Predict 402** solves this by introducing a fully autonomous prediction market where bets are placed, and rounds are resolved entirely using zero-trust AI models.

## 🚀 What is Predict 402?
Predict 402 is a decentralized, AI-agentic betting platform deployed on the **OpenGradient** blockchain. We allow users to predict the short-term price movements (UP or DOWN) of Bitcoin in 5-minute rounds. Alternatively, users can deposit funds into their on-chain Vault and let the **BitQuant AI Bot** automatically trade on their behalf based on real-time neural network predictions.

**Key Features:**
- 🧠 **Verifiable AI On-Chain**: Built on the **OpenGradient Testnet**, utilizing Trusted Execution Environments (TEE) so users can cryptographically verify that the AI model generated the prediction without human interference.
- ⚡ **Autonomous Resolution**: No centralized human admin decides who won. Our keeper bot fetches the price, signs it, and triggers smart contracts to distribute the pool securely.
- 🤖 **BitQuant Vault**: An auto-betting AI companion that manages a player's sub-balance and places intelligent bets even when the player is offline.

## 🏗 Технологический стек
- **Frontend**: React, Vite, Wagmi, Viem (TypeScript).
- **Backend (Agent)**: Python, Flask, Web3.py. Выполняет роль оракула и кипера (авто-резолв раундов).
- **Blockchain**: OpenGradient Testnet (EVM-compatible).
- **Contracts**: Solidity (Hardhat).
- **Deploy**: Nginx (Frontend) + Systemd Service (Backend).

## 🚀 Архитектура и развертывание
### Как это работает на сервере:
```
[ Пользователь ]  -->  [ Nginx (порт 80) ]
                            │
                            ├─> [ Статические файлы ] (/var/www/html/)
                            │      HTML, JS, CSS (то, что мы собрали и залили)
                            │
                            └─> [ Backend API ] (localhost:3402)
                                   Python агент (agent.py) — принимает ставки
```

1. **Frontend**:
   - Мы собираем код React (`npm run build`) в папку `dist/`.
   - Затем заливаем эти файлы на сервер в `/var/www/html/`.
   - **Nginx** просто смотрит в эту папку и отдает файлы пользователям.

2. **Backend (Agent)**:
   - Слушает состояние контракта каждые 2 секунды.
   - Когда раунд заканчивается, делает запрос к Binance API (или другому источнику) для получения цены закрытия.
   - Отправляет транзакцию `resolveRound` + `startNewRound` в блокчейн.
   - Публикует AI-прогнозы для пользователей (в разработке).

3. **Smart Contracts**:
### Contract Addresses (OpenGradient Testnet v2)
- **Predict402**: `0x36F5182A244A9446854429A47BCc29bb25059aE5`
- **Vault402Binary**: `0x45E2C3375152b01089f04B20Ac21AD4Db1D9C3E2`
   - `Predict402.sol`: Логика игры (ставки, раунды, выплаты).
   - `Vault402Binary.sol`: Хранилище ликвидности (депозиты пользователей для автоматических ставок).

## 📂 Структура проекта
- `backend/` — Python агент (оракул).
  - `agent.py` — основной файл логики.
- `contracts/` — Смарт-контракты.
  - `Predict402.sol`, `Vault402.sol`.
  - `scripts/` — скрипты деплоя и обслуживания.
- `frontend/` — React приложение.
  - `src/components/` — UI компоненты.
  - `src/pages/` — Страницы (Home, History, Leaderboard).
  - `src/hooks/` — Кастомные хуки (useRound, useContract).

## ⚙️ Установка и запуск (Локально)
1. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
2. **Backend**:
   ```bash
   cd backend
   pip install -r requirements.txt
   python agent.py
   ```
