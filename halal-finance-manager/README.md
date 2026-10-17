# Halal Finance Manager Pro

A mobile-first Binance Spot market monitor for **manually reviewed Shariah-screened assets**. It does not place trades and does not connect to trading or withdrawal API keys.

## Features

- Binance public Spot ticker and hourly candle data.
- User-managed watchlist that starts empty; assets should be added only after independent Shariah review.
- Volatility-based indicative 1-hour range.
- Transparent momentum/trend heuristic and walk-forward directional evaluation using up to 1,000 closed hourly candles.
- Directional hit rate for non-weak signals, signal coverage, a trailing-majority baseline, and mean absolute error for the displayed drift estimate.
- Illustrative spot-only cost-aware metric: bullish signals enter a long position and bearish signals remain in cash.
- Manual price and percentage alerts, browser notifications and vibration where supported.
- Optional Web Push backend for alerts while the browser page is closed, using Vercel functions, Upstash Redis, a service worker, and a GitHub Actions monitor scheduled every five minutes.

## Shariah limitation

The app does **not** certify any coin as halal and does not issue a fatwa. A checkbox records the user's own review; it is not independent verification. The watchlist is empty by default. Add only assets accepted under a credible Shariah screening methodology, and leave uncertain assets out.

## Run locally

Serve the `halal-finance-manager` directory with a local static web server. For example, with Node.js:

```bash
npx serve .
```

Open the URL printed by the server. Browser CORS policies, regional restrictions, or Binance API availability may affect data access. Backend push functions require a Vercel deployment and configured environment variables; they will not work from a static-only local server.

## Quant Lab: interpretation and limits

- Requests up to 1,000 hourly candles (roughly 41 days if history is complete) and excludes the still-forming candle.
- The next-hour drift estimate is a transparent momentum heuristic using recent returns and a trend-difference term; it is **not** a trained ML model or a calibrated probability.
- Walk-forward evaluation uses only candles available before each held-out candle. It reports the tested sample size and signal count separately and compares the heuristic to a trailing-majority direction baseline.
- The illustrative 0.20% round-trip cost is an assumption, not a Binance fee quote or measured spread/slippage. Replace it with your actual fee tier and realistic execution costs before interpreting results.
- Results are based on a limited rolling sample, can change across market regimes, and do not demonstrate profitability. Historical directional hit rate is not the probability that the next signal will be correct.
- The displayed volatility range is a statistical illustration, not a target, confidence guarantee, or promise of future price.

## Deploy the app and API

1. Import this repository into Vercel.
2. Set the Vercel project's **Root Directory** to `halal-finance-manager`.
3. Deploy over HTTPS. Static-only hosting such as GitHub Pages cannot run the `api/` backend functions.
4. Configure the environment variables listed below and redeploy. Environment-variable changes apply to new deployments.

## Configure background Web Push

### 1. Create Redis storage

Create an Upstash Redis database and add these variables in Vercel Project Settings → Environment Variables:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### 2. Generate VAPID keys

On a trusted computer or in Termux with Node.js, run:

```bash
npx web-push generate-vapid-keys
```

Add the generated values to Vercel:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` — use a real contact such as `mailto:you@example.com`.

### 3. Configure the scheduler secret

Generate a long random secret on your own device, for example:

```bash
openssl rand -hex 32
```

Add it to Vercel as `CRON_SECRET`. Keep it private.

### 4. Configure GitHub Actions

In GitHub repository Settings → Secrets and variables → Actions, add:

- `HFM_APP_BASE_URL`: deployed HTTPS origin with no trailing slash.
- `HFM_CRON_SECRET`: exactly the same secret value as Vercel's `CRON_SECRET`.

The workflow `Monitor Halal Finance push alerts` calls the backend every five minutes and can also be run manually from the Actions tab. GitHub may delay scheduled runs; this is not a guaranteed real-time alert service.

### 5. Verify readiness and test

Open `https://YOUR-APP-DOMAIN/api/push/status`. The response must show all three booleans as `true`:

- `storageConfigured`
- `vapidConfigured`
- `schedulerConfigured`

Then open the HTTPS app on the phone, tap **Enable background push**, allow notifications, create a test alert near the current price, and run the workflow manually once. Verify the workflow result and that a phone notification arrives with the app closed. Check GitHub Actions and Vercel function logs if it fails.

**Important:** the code has passed static syntax checks, but the deployed backend, scheduled monitor, and real push delivery must still be verified in the live environment. Do not consider background alerts operational until this test passes.

## Security and behaviour

- The app uses public Binance market data and does not need Binance API credentials. Never provide trading or withdrawal API keys to this app.
- Push messages are informational and instruct the user to review the market manually; no order is placed.
- The monitor uses only alert rules synced from the browser. Keep the app's review process independent; user confirmation is not proof of Shariah compliance.
- Do not commit VAPID private keys, Redis tokens, or the scheduler secret. Rotate any secret that is exposed.
- Push delivery depends on browser/OS permission, connectivity, the push service, and scheduler availability.

## Risk note

Crypto markets are volatile. Price movement predictions can be wrong, and historical behaviour does not guarantee future results. Consider fees, spread, slippage, liquidity, and downside risk before making a manual decision.
