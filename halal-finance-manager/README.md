# Halal Finance Manager Pro

A mobile-first Binance Spot market monitor for **manually reviewed Shariah-approved assets**. It does not place trades.

## Current starter features
- Binance public Spot ticker and hourly candle data.
- User-managed watchlist. A coin must be independently reviewed before the user adds it.
- Volatility-based indicative 1-hour range.
- Manual price and percentage alerts.
- Browser notification permission and vibration where supported.
- Local browser storage for the watchlist and alert rules.

## Important Shariah limitation
The app does not certify any coin as halal and ships with an empty watchlist. The checkbox records the user's own review; it is not a religious ruling. Add only assets approved under a credible Shariah screening methodology. If status is uncertain, do not add the asset.

## Run locally
Open `index.html` through a local static web server. For example, with Node installed:

```bash
npx serve .
```

Open the `halal-finance-manager` directory's served URL. Browser CORS policies, regional access, or Binance API availability may affect data access.

## Deploy with GitHub Pages
1. In the repository settings, open **Pages**.
2. Choose **Deploy from a branch** and select `main` and `/ (root)` only if you move these files to the repository root, or use a static hosting configuration that serves this subdirectory.
3. Because this app currently lives in `halal-finance-manager/`, the simplest path is to deploy the folder using a static host configured to use that directory as its publish root.

## Alert and prediction limitations
- This version uses public market data and a simple recent hourly log-return volatility estimate.
- The displayed interval is a statistical illustration, not a validated forecast, target, or probability of profit.
- It does not yet include a trained ML model, rigorous walk-forward backtesting, or a continuously running backend.
- Browser-session alerts require the page to remain open. Standard browser notifications and vibration depend on browser and device permissions.
- Reliable alerts while the page is closed require HTTPS, a service worker, a push subscription, and a deployed backend/push worker.
- No Binance API secret is needed. Never provide trading or withdrawal API keys to this app.

## Risk note
Crypto markets are volatile. Historical behaviour does not guarantee future results. Account for fees, spread, slippage, liquidity, and downside risk before acting on any signal.
