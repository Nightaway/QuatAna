# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OKX Trading System - A Vue 3/Nuxt 3 application for displaying cryptocurrency K-line (candlestick) charts with real-time OKX exchange data.

## Commands

```bash
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Build for production
npm run generate     # Generate static site
npm run preview      # Preview production build
```

## Architecture

### Tech Stack
- **Frontend**: Vue 3 + Nuxt 3 + TypeScript
- **Charts**: KLineChart (v10.0.0-alpha9) - HTML5 Canvas-based candlestick library
- **Data**: OKX REST API (historical) + WebSocket (real-time)

### Data Flow

```
pages/static.vue ──→ KLineChart.vue ──→ Local JSON file
pages/realtime.vue ──→ KLineChartRealtime.vue ──→ okxDataService.js + okxWebSocket.js ──→ OKX API
```

### Key Components

| File | Purpose |
|------|---------|
| `components/KLineChart.vue` | Static data chart (loads from JSON) |
| `components/KLineChartRealtime.vue` | Real-time WebSocket chart |
| `utils/okxDataService.js` | OKX REST API integration, data transformation, DataLoader implementation |
| `utils/okxWebSocket.js` | WebSocket connection manager (singleton, auto-reconnect, heartbeat) |

### Data Transformation

OKX API returns: `[timestamp, open, high, low, close, volume, turnover]`

KLineChart expects: `{timestamp, open, high, low, close, volume}`

Transformation handled by `okxDataService.transformOKXData()`

## SSR Considerations

KLineChart requires browser Canvas API. Components must use:
- `<ClientOnly>` wrapper in templates
- `defineAsyncComponent()` for dynamic imports
- `onMounted()` for chart initialization

## Technical Indicators

Implemented: BOLL (20,2), VOL, MACD (12,26,9), RSI (14)

Add indicators via `chart.createIndicator()` in component code.

## WebSocket Manager (okxWebSocket.js)

- Singleton pattern - single connection shared across components
- Auto-reconnect with 3-second delay
- Heartbeat ping every 20 seconds
- Subscription management with callback routing
- Always call `unsubscribe()` in `onUnmounted()`

## File-Based Routing

Nuxt auto-routes based on `pages/` directory:
- `/` → `pages/index.vue` (home/selection)
- `/static` → `pages/static.vue` (static data mode)
- `/realtime` → `pages/realtime.vue` (real-time mode)

## Sample Data

`eth_usdt_swap_daily_30d.json` contains 30 days of ETH/USDT daily candles for offline development.
