const API = "https://api.binance.com";
const STORE = { coins: "hfm-approved-coins-v1", alerts: "hfm-alerts-v1" };
let coins = read(STORE.coins, []);
let alerts = read(STORE.alerts, []);
let prices = {};
let tickers = {};
let busy = false;

function read(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; } }
function save() { localStorage.setItem(STORE.coins, JSON.stringify(coins)); localStorage.setItem(STORE.alerts, JSON.stringify(alerts)); }
function fmt(n) { if (!Number.isFinite(n)) return "—"; return n >= 100 ? n.toLocaleString(undefined,{maximumFractionDigits:2}) : n >= 1 ? n.toLocaleString(undefined,{maximumFractionDigits:4}) : n.toLocaleString(undefined,{maximumFractionDigits:8}); }
function pct(n) { return (n >= 0 ? "+" : "") + n.toFixed(2) + "%"; }
function toast(message) { const el = document.querySelector("#toast"); el.textContent = message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 3500); }
function notify(title, body) {
  toast(title + " — " + body);
  try { if ("vibrate" in navigator) navigator.vibrate([180,80,180]); } catch {}
  if ("Notification" in window && Notification.permission === "granted") { try { new Notification(title, { body, icon: "./icon.svg" }); } catch {} }
}
async function getJSON(path) { const r = await fetch(API + path); if (!r.ok) throw new Error("Binance HTTP " + r.status); return r.json(); }
async function refresh() {
  if (busy) return; busy = true;
  document.querySelector("#connection-label").textContent = "Refreshing…";
  try {
    const data = await getJSON("/api/v3/ticker/24hr");
    tickers = Object.fromEntries(data.map(t => [t.symbol, t]));
    document.querySelector("#connection-label").textContent = "Connected";
    document.querySelector("#connection-label").previousElementSibling?.classList.add("live-dot");
    const symbols = coins.map(c => c.symbol);
    for (const symbol of symbols) {
      if (!tickers[symbol]) { prices[symbol] = { error: "Not found / unavailable" }; continue; }
      try {
        const klines = await getJSON("/api/v3/klines?symbol=" + encodeURIComponent(symbol) + "&interval=1h&limit=200");
        const closes = klines.map(k => Number(k[4]));
        const returns = [];
        for (let i=1;i<closes.length;i++) if (closes[i-1] > 0) returns.push(Math.log(closes[i]/closes[i-1]));
        const mean = returns.reduce((a,b)=>a+b,0) / (returns.length || 1);
        const variance = returns.reduce((a,b)=>a+(b-mean)**2,0) / Math.max(1,returns.length-1);
        const sigma = Math.sqrt(variance);
        const last = Number(tickers[symbol].lastPrice);
        const forecast = buildForecast(closes);
        const backtest = runWalkForwardBacktest(closes);
        prices[symbol] = { last, change: Number(tickers[symbol].priceChangePercent), volume: Number(tickers[symbol].quoteVolume), sigma, rangeLow: last*Math.exp(-1.96*sigma), rangeHigh: last*Math.exp(1.96*sigma), forecast, backtest, updated: Date.now() };
      } catch (e) { prices[symbol] = { ...(prices[symbol]||{}), last:Number(tickers[symbol].lastPrice), change:Number(tickers[symbol].priceChangePercent), error:"Historical candles unavailable" }; }
    }
    checkAlerts();
    render();
    renderQuantLab();
    document.querySelector("#updated-at").textContent = new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"});
  } catch (e) {
    document.querySelector("#connection-label").textContent = "Data unavailable";
    toast("Market data unavailable. Check connection or Binance API access.");
  } finally { busy = false; }
}

function mean(values) { return values.length ? values.reduce((a,b)=>a+b,0)/values.length : 0; }
function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
function buildForecast(closes) {
  if (closes.length < 30) return null;
  const returns = [];
  for (let i=1;i<closes.length;i++) if (closes[i-1] > 0 && closes[i] > 0) returns.push(Math.log(closes[i]/closes[i-1]));
  const recent6 = returns.slice(-6), recent24 = returns.slice(-24);
  const prior24 = returns.slice(-48,-24);
  const momentum6 = mean(recent6), momentum24 = mean(recent24);
  const trend = mean(recent24) - mean(prior24);
  const raw = 0.45*momentum6 + 0.35*momentum24 + 0.20*trend;
  const sigma = Math.sqrt(mean(recent24.map(r=>(r-momentum24)**2)));
  const expectedPct = clamp((Math.exp(raw)-1)*100, -3, 3);
  const score = sigma > 0 ? clamp(raw / sigma, -1, 1) : 0;
  const direction = score > 0.12 ? "Upward bias" : score < -0.12 ? "Downward bias" : "No clear edge";
  return { direction, expectedPct, score, momentum6: (Math.exp(momentum6*6)-1)*100, momentum24: (Math.exp(momentum24*24)-1)*100, sigmaPct: sigma*100 };
}
function runWalkForwardBacktest(closes) {
  // One-step directional baseline: at each point, use only the previous 6 hourly returns.
  // No future candles enter a forecast. Excludes flat/near-flat forecasts from hit-rate denominator.
  if (closes.length < 40) return null;
  let correct=0, total=0, signalReturn=0, signals=0;
  for (let i=25;i<closes.length-1;i++) {
    const history=[];
    for(let j=Math.max(1,i-5);j<=i;j++) if(closes[j-1]>0) history.push(Math.log(closes[j]/closes[j-1]));
    const forecast=mean(history);
    const actual=closes[i+1]>0?Math.log(closes[i+1]/closes[i]):0;
    if (Math.abs(forecast)<0.00005) continue;
    total++;
    if ((forecast>0 && actual>0)||(forecast<0 && actual<0)) correct++;
    signalReturn += Math.sign(forecast)*actual;
    signals++;
  }
  return { samples: total, accuracy: total ? correct/total*100 : null, avgSignalReturn: signals ? (Math.exp(signalReturn/signals)-1)*100 : null };
}
function renderQuantLab() {
  const el = document.querySelector("#quant-rows");
  if (!el) return;
  const available = coins.filter(c=>prices[c.symbol]?.forecast);
  if (!available.length) {
    el.innerHTML = '<div class="quant-empty">Add an independently reviewed asset and wait for hourly candle data. Forecasts are heuristic estimates, not AI certainty.</div>';
    return;
  }
  el.innerHTML = available.map(c=>{
    const p=prices[c.symbol], f=p.forecast, b=p.backtest;
    const cls=f.score>0.12?"positive":f.score< -0.12?"negative":"";
    return '<article class="quant-card"><div class="quant-card-head"><b>'+escapeHTML(c.symbol)+'</b><span class="tag">'+escapeHTML(f.direction)+'</span></div><div class="quant-big '+cls+'">'+(f.expectedPct>=0?"+":"")+f.expectedPct.toFixed(3)+'%</div><div class="quant-caption">Heuristic next-hour drift estimate · not a target</div><div class="quant-metrics"><span>6h momentum <b>'+f.momentum6.toFixed(2)+'%</b></span><span>24h momentum <b>'+f.momentum24.toFixed(2)+'%</b></span><span>Backtest directional hit rate <b>'+(b&&b.accuracy!==null?b.accuracy.toFixed(1)+'%':'Not enough data')+'</b></span><span>Test samples <b>'+(b?b.samples:'—')+'</b></span></div></article>';
  }).join("");
}

function render() {
  const body = document.querySelector("#coin-rows");
  document.querySelector("#watch-count").textContent = coins.length;
  document.querySelector("#online-count").textContent = coins.filter(c => Number.isFinite(prices[c.symbol]?.last)).length;
  document.querySelector("#active-count").textContent = alerts.filter(a=>a.active).length;
  document.querySelector("#alert-count").textContent = alerts.filter(a=>a.active).length;
  if (!coins.length) body.innerHTML = '<tr><td colspan="7" class="empty">No approved coins added. Complete your Shariah review, then add a symbol above.</td></tr>';
  else body.innerHTML = coins.map(c => {
    const p = prices[c.symbol] || {};
    const ch = Number.isFinite(p.change) ? p.change : NaN;
    const changeClass = ch >= 0 ? "positive" : "negative";
    return '<tr><td><span class="asset-name">'+escapeHTML(c.symbol.replace(/USDT$/,""))+'</span><span class="asset-sub">'+escapeHTML(c.symbol)+' · user-reviewed</span></td><td>'+(Number.isFinite(p.last)?fmt(p.last):'<span class="asset-sub">'+(p.error||"Loading…")+'</span>')+'</td><td class="'+changeClass+'">'+(Number.isFinite(ch)?pct(ch):"—")+'</td><td>'+(Number.isFinite(p.sigma)?(p.sigma*100).toFixed(2)+"% / hour":"—")+'</td><td>'+(Number.isFinite(p.rangeLow)?fmt(p.rangeLow)+" – "+fmt(p.rangeHigh):"—")+'</td><td><span class="tag">Approved by user</span></td><td><button class="tiny-btn" data-remove="'+escapeHTML(c.symbol)+'">Remove</button></td></tr>';
  }).join("");
  const select = document.querySelector("#alert-symbol");
  select.innerHTML = coins.length ? coins.map(c=>'<option value="'+escapeHTML(c.symbol)+'">'+escapeHTML(c.symbol)+'</option>').join("") : '<option value="">Add an approved coin first</option>';
  const list = document.querySelector("#alert-list");
  list.innerHTML = alerts.length ? alerts.map(a=>'<div class="alert-row"><div><b>'+escapeHTML(a.symbol)+' · '+escapeHTML(alertDescription(a))+'</b><small>'+(a.active?"Active":"Triggered")+'</small></div><button class="tiny-btn" data-alert-remove="'+a.id+'">Remove</button></div>').join("") : '<p class="empty">No alerts configured.</p>';
}
function alertDescription(a) {
  const p = prices[a.symbol]?.last;
  if (a.type==="below") return "price ≤ "+fmt(a.value);
  if (a.type==="above") return "price ≥ "+fmt(a.value);
  if (a.type==="move-down") return "falls "+a.value+"% from setup price";
  return "rises "+a.value+"% from setup price";
}
function checkAlerts() {
  for (const a of alerts) {
    if (!a.active) continue;
    const p = prices[a.symbol]?.last;
    if (!Number.isFinite(p)) continue;
    let hit = false;
    if (a.type==="below") hit = p <= a.value;
    if (a.type==="above") hit = p >= a.value;
    if (a.type==="move-down") hit = p <= a.base*(1-a.value/100);
    if (a.type==="move-up") hit = p >= a.base*(1+a.value/100);
    if (hit) { a.active=false; a.triggeredAt=Date.now(); save(); notify("Halal Finance alert: "+a.symbol, "Price "+fmt(p)+" reached your configured condition. Review the market manually."); }
  }
}
function escapeHTML(v) { return String(v).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
document.querySelector("#add-form").addEventListener("submit", async e=>{
  e.preventDefault();
  const input = document.querySelector("#symbol-input");
  const symbol = input.value.trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
  if (!document.querySelector("#halal-confirm").checked) return toast("Confirm your independent Shariah review before adding an asset.");
  if (!symbol.endsWith("USDT")) return toast("Enter a Binance Spot USDT pair, for example BTCUSDT.");
  if (coins.some(c=>c.symbol===symbol)) return toast("This coin is already in your watchlist.");
  try {
    const info = await getJSON("/api/v3/exchangeInfo?symbol="+encodeURIComponent(symbol));
    const match = info.symbols?.find(s=>s.symbol===symbol && s.status==="TRADING" && s.isSpotTradingAllowed);
    if (!match) return toast("This symbol is not an available Spot trading pair.");
    coins.push({symbol, reviewedAt:new Date().toISOString(), reviewConfirmed:true});
    save(); input.value=""; document.querySelector("#halal-confirm").checked=false;
    await refresh(); toast(symbol+" added. Reminder: the app records your review; it does not certify halal status.");
  } catch { toast("Could not verify this Spot pair. Check the symbol and try again."); }
});
document.querySelector("#alert-form").addEventListener("submit",e=>{
  e.preventDefault();
  const symbol=document.querySelector("#alert-symbol").value;
  if(!symbol || !coins.some(c=>c.symbol===symbol)) return toast("Add an approved coin first.");
  const type=document.querySelector("#alert-type").value;
  const value=Number(document.querySelector("#alert-value").value);
  if(!Number.isFinite(value)||value<=0) return toast("Enter a value greater than zero.");
  if((type==="move-down"||type==="move-up")&&value>=100) return toast("Percentage movement must be below 100%.");
  const base=prices[symbol]?.last;
  if(!Number.isFinite(base)) return toast("Wait for live price data before creating this alert.");
  alerts.unshift({id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),symbol,type,value,base,active:true,createdAt:Date.now()});
  save(); render(); document.querySelector("#alert-value").value=""; toast("Alert saved. Keep this page open for browser-session monitoring.");
});
document.addEventListener("click",e=>{
  const remove=e.target.closest("[data-remove]");
  const removeAlert=e.target.closest("[data-alert-remove]");
  if(remove){coins=coins.filter(c=>c.symbol!==remove.dataset.remove);alerts=alerts.filter(a=>a.symbol!==remove.dataset.remove);delete prices[remove.dataset.remove];save();render();toast("Coin and its alerts removed.");}
  if(removeAlert){alerts=alerts.filter(a=>a.id!==removeAlert.dataset.alertRemove);save();render();}
});
document.querySelector("#scan-btn").addEventListener("click",refresh);
document.querySelector("#notify-btn").addEventListener("click",async()=>{
  if(!("Notification" in window)) return toast("This browser does not support web notifications.");
  const permission=await Notification.requestPermission();
  toast(permission==="granted"?"Notifications enabled for this browser.":"Notification permission was not granted.");
});
render(); refresh(); setInterval(refresh,30000);
