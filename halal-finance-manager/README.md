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


## Quant lab update
- Fetches up to 1,000 closed hourly candles per user-approved asset.
- Adds a transparent momentum-based next-hour drift heuristic using recent 6-hour and 24-hour returns plus a trend-difference term.
- Adds a strict one-step walk-forward evaluation: every forecast uses only candles available before the held-out next-hour candle.
- Reports directional hit rate only for non-weak signals, signal coverage, a trailing-majority direction benchmark, and mean absolute error of the displayed drift estimate.
- Requires at least 60 hourly closes before reporting backtest metrics; the number of tested hours and number of actual signals are shown separately.
- This remains a transparent heuristic, not a trained AI/ML model, calibrated probability, or evidence of profitability. Metrics use a small recent rolling sample and can change sharply by regime; fees, spread, slippage, latency, and execution constraints are not included.
- Forecast estimates are capped to reduce extreme display values; that cap is a UI safeguard, not a confidence interval.


## Quant Lab evaluation notes
- Requests up to 1,000 hourly candles (roughly 41 days when data is complete) and excludes the still-forming candle.
- Walk-forward evaluation uses only prior closes to form each forecast and tests the following hourly close.
- The spot-only cost-aware metric enters long positions only on bullish signals; bearish signals remain in cash.
- The displayed 0.20% round-trip cost is an illustrative assumption, not a Binance fee quote or measured spread/slippage. Replace it with your actual fee tier and realistic execution costs before relying on results.
- Historical hit rate is not a calibrated probability and does not guarantee future performance. Candle history is limited, the forecast remains heuristic, and this is not a production-validated trading system.


## Background push alerts (backend added; deployment/configuration required)

The repository now includes a Web Push service worker, Vercel serverless endpoints, Upstash Redis storage, and a GitHub Actions scheduler workflow. **These do not work until you deploy the app and configure the secrets below.** Do not put secrets in GitHub source files.

### 1. Deploy the app and API
1. Import this repository into Vercel.
2. Set the Vercel project's **Root Directory** to `halal-finance-manager`.
3. Deploy it over HTTPS. GitHub Pages/static-only hosting cannot run the `api/` backend functions.

### 2. Create free push-storage credentials
1. Create an Upstash Redis database and copy its REST URL and REST token.
2. In Vercel Project Settings → Environment Variables, add:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
3. Generate VAPID keys on a trusted computer or in Termux with Node.js:
   ```bash
   npx web-push generate-vapid-keys
   ```
   Add the generated values to Vercel Environment Variables:
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT` (for example, a real contact such as `mailto:you@example.com`)
4. Generate a long random scheduler secret, for example with `openssl rand -hex 32`, and add it as `CRON_SECRET` in Vercel. Keep the value private.
5. Redeploy after adding environment variables.

### 3. Enable the five-minute monitor
In GitHub repository Settings → Secrets and variables → Actions, add:
- `HFM_APP_BASE_URL`: the deployed HTTPS origin, with no trailing slash.
- `HFM_CRON_SECRET`: exactly the same value as Vercel's `CRON_SECRET`.

Enable GitHub Actions and run **Monitor Halal Finance push alerts** once with **Run workflow** to test it. The workflow is scheduled every five minutes, but GitHub may delay scheduled runs; this is not a guaranteed real-time trading alert service. Check the workflow run logs and Vercel function logs if an alert is not delivered.

### Push-alert behaviour and limitations
- After deployment and configuration, tap **Enable background push** on the HTTPS app and allow notifications.
- The server checks only the alert rules synced from that browser and the user-reviewed Spot symbols in its watchlist. It sends informational push messages and never places orders.
- The illustrative 0.20% round-trip cost used in the Spot backtest is not a measured Binance fee, spread, or slippage.
- Do not commit VAPID private keys, Redis tokens, or the cron secret. If any secret is exposed, rotate it immediately.
- Push delivery depends on browser/OS permission, network connectivity, the push service, and scheduled workflow availability. The app does not guarantee delivery time or market outcomes.
