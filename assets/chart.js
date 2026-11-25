/* Oryx live candlestick chart — draws Oryx.candlesTF(symbol, timeframe) on a canvas.
   Self-contained: no external widgets, updates with the site's own feed.
   User-selectable timeframe + multi indicators: MA, EMA, Bollinger Bands,
   RSI, MACD and candlestick-pattern labels (Hammer, Shooting Star, Doji,
   Engulfing), like a pro exchange terminal. */
function drawLiveChart(cv, symbol, startIdx, visible, tfSec, indOpt){
  if (!cv || typeof Oryx === 'undefined') return;
  const ind = Object.assign({ ma:true, ema:false, bb:false, rsi:false, macd:false, pat:true }, indOpt || {});
  const tf = Math.max(1, parseInt(tfSec, 10) || 5);
  const tfText = tf < 60 ? tf + 's' : tf < 3600 ? (tf / 60) + 'm' : tf < 86400 ? (tf / 3600) + 'h' : '1D';
  const LIGHT = document.documentElement.classList.contains('light');
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, H = cv.clientHeight;
  if (!W || !H) return;
  if (cv.width !== Math.round(W * dpr)){ cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#070D1D'; ctx.fillRect(0, 0, W, H);
  const all = Oryx.candlesTF ? Oryx.candlesTF(symbol, tf) : Oryx.candles(symbol), vis = visible || 30;
  const start = Math.max(0, Math.min(startIdx || 0, Math.max(0, all.length - vis)));
  const live = start + vis >= all.length;
  const data = all.slice(start, start + vis); /* big, clear candles — scroll back for history */
  if (!data.length) return;
  const closes = all.map(k => k.c);

  /* ---------- indicator series (computed on the full history, drawn on the visible window) ---------- */
  function smaSeries(vals, period){
    const out = Array(vals.length).fill(null); let sum = 0;
    for (let i = 0; i < vals.length; i++){ sum += vals[i]; if (i >= period) sum -= vals[i - period]; if (i >= period - 1) out[i] = sum / period; }
    return out;
  }
  function emaSeries(vals, period){
    const out = Array(vals.length).fill(null); if (vals.length < period) return out;
    let seed = 0; for (let i = 0; i < period; i++) seed += vals[i];
    let ema = seed / period; out[period - 1] = ema; const k = 2 / (period + 1);
    for (let i = period; i < vals.length; i++){ ema = vals[i] * k + ema * (1 - k); out[i] = ema; }
    return out;
  }
  function rsiSeries(vals, period){
    const out = Array(vals.length).fill(null); if (vals.length <= period) return out;
    let gain = 0, loss = 0;
    for (let i = 1; i <= period; i++){ const d = vals[i] - vals[i - 1]; if (d >= 0) gain += d; else loss -= d; }
    gain /= period; loss /= period;
    out[period] = loss === 0 ? 100 : 100 - (100 / (1 + gain / loss));
    for (let i = period + 1; i < vals.length; i++){
      const d = vals[i] - vals[i - 1], g = d > 0 ? d : 0, l = d < 0 ? -d : 0;
      gain = (gain * (period - 1) + g) / period; loss = (loss * (period - 1) + l) / period;
      out[i] = loss === 0 ? 100 : 100 - (100 / (1 + gain / loss));
    }
    return out;
  }
  function bollinger(vals, period, mult){
    const mid = smaSeries(vals, period), up = Array(vals.length).fill(null), lo = Array(vals.length).fill(null);
    for (let i = period - 1; i < vals.length; i++){
      let s = 0; for (let j = i - period + 1; j <= i; j++){ const d = vals[j] - mid[i]; s += d * d; }
      const sd = Math.sqrt(s / period); up[i] = mid[i] + mult * sd; lo[i] = mid[i] - mult * sd;
    }
    return { mid, up, lo };
  }
  function macdSeries(vals){
    const e12 = emaSeries(vals, 12), e26 = emaSeries(vals, 26);
    const macd = Array(vals.length).fill(null), signal = Array(vals.length).fill(null), hist = Array(vals.length).fill(null), pts = [];
    for (let i = 0; i < vals.length; i++){ if (e12[i] != null && e26[i] != null){ macd[i] = e12[i] - e26[i]; pts.push(i); } }
    if (pts.length >= 9){
      let seed = 0; for (let j = 0; j < 9; j++) seed += macd[pts[j]];
      let sig = seed / 9; signal[pts[8]] = sig; const k = 2 / (9 + 1);
      for (let j = 9; j < pts.length; j++){ const i = pts[j]; sig = macd[i] * k + sig * (1 - k); signal[i] = sig; }
      for (const i of pts){ if (signal[i] != null) hist[i] = macd[i] - signal[i]; }
    }
    return { macd, signal, hist };
  }
  const sma10 = ind.ma ? smaSeries(closes, 10) : null;
  const sma26 = ind.ma ? smaSeries(closes, 26) : null;
  const ema12 = (ind.ema || ind.macd) ? emaSeries(closes, 12) : null;
  const ema26 = (ind.ema || ind.macd) ? emaSeries(closes, 26) : null;
  const bb = ind.bb ? bollinger(closes, 20, 2) : null;
  const rsi = ind.rsi ? rsiSeries(closes, 14) : null;
  const macd = ind.macd ? macdSeries(closes) : null;

  const axisW = 64, padT = 12;
  const plotW = W - axisW;
  const oscCount = (ind.rsi ? 1 : 0) + (ind.macd ? 1 : 0);
  const oscH = oscCount ? Math.max(58, Math.min(112, H * 0.26)) : 0;
  const plotH = H - padT - 22 - oscH;
  const mainBottom = padT + plotH;
  let min = Infinity, max = -Infinity;
  data.forEach(k => { min = Math.min(min, k.l); max = Math.max(max, k.h); });
  [sma10, sma26, ind.ema ? ema12 : null, ind.ema ? ema26 : null, bb ? bb.up : null, bb ? bb.lo : null].forEach(series => {
    if (!series) return;
    for (let ix = 0; ix < data.length; ix++){ const v = series[start + ix]; if (v != null && isFinite(v)){ min = Math.min(min, v); max = Math.max(max, v); } }
  });
  const pad = (max - min) * 0.08 || max * 0.001 || 1; max += pad; min -= pad;
  const Y = v => padT + (max - v) / (max - min) * plotH;
  const step = plotW / data.length, bw = Math.max(step * 0.62, 1.5);
  const X = ix => ix * step + step / 2;
  ctx.strokeStyle = LIGHT ? 'rgba(15,35,80,0.09)' : 'rgba(255,255,255,.055)'; ctx.fillStyle = LIGHT ? '#64748B' : '#66738F'; ctx.font = '10.5px Segoe UI'; ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++){
    const v = min + (max - min) * g / 4, y = Y(v);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(plotW, y); ctx.stroke();
    ctx.fillText(Oryx.fmtP(symbol, v), plotW + 7, y + 3);
  }
  /* Bollinger fill (behind the candles) */
  if (bb){
    ctx.beginPath(); let started = false;
    for (let ix = 0; ix < data.length; ix++){ const v = bb.up[start + ix]; if (v == null) continue; if (!started){ ctx.moveTo(X(ix), Y(v)); started = true; } else ctx.lineTo(X(ix), Y(v)); }
    for (let ix = data.length - 1; ix >= 0; ix--){ const v = bb.lo[start + ix]; if (v == null) continue; ctx.lineTo(X(ix), Y(v)); }
    if (started){ ctx.closePath(); ctx.fillStyle = 'rgba(56,189,248,.07)'; ctx.fill(); }
  }
  /* candles */
  data.forEach((k, ix) => {
    const x = X(ix), up = k.c >= k.o, col = up ? '#16C784' : '#EA3943';
    ctx.strokeStyle = col; ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(x, Y(k.h)); ctx.lineTo(x, Y(k.l)); ctx.stroke();
    const yO = Y(k.o), yC = Y(k.c);
    ctx.fillRect(x - bw / 2, Math.min(yO, yC), bw, Math.max(Math.abs(yC - yO), 1.2));
  });
  /* overlay indicator lines */
  function drawSeries(series, color, width, dashed){
    if (!series) return;
    ctx.strokeStyle = color; ctx.lineWidth = width || 1.4; if (dashed) ctx.setLineDash([5, 4]);
    ctx.beginPath(); let started = false;
    for (let ix = 0; ix < data.length; ix++){
      const v = series[start + ix];
      if (v == null || !isFinite(v)){ started = false; continue; }
      const x = X(ix), y = Y(v);
      if (!started){ ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
  }
  if (ind.ma){ drawSeries(sma10, '#F5B544', 1.4); drawSeries(sma26, '#4EA8FF', 1.4); }
  if (ind.ema){ drawSeries(ema12, '#C084FC', 1.4); drawSeries(ema26, '#FB7185', 1.4); }
  if (bb){ drawSeries(bb.up, 'rgba(56,189,248,.85)', 1.2); drawSeries(bb.lo, 'rgba(56,189,248,.85)', 1.2); drawSeries(bb.mid, 'rgba(56,189,248,.45)', 1.1, true); }
  /* candlestick patterns — shape-based: Hammer, Shooting Star, Doji, Engulfing */
  if (ind.pat){
    function patternAt(ix){
      const k = data[ix], range = k.h - k.l;
      if (range <= 0) return null;
      const body = Math.abs(k.c - k.o);
      const upSh = k.h - Math.max(k.o, k.c), loSh = Math.min(k.o, k.c) - k.l;
      if (body <= range * 0.1) return { name:'Doji', col:'#F5B544', above:true };
      if (body <= range * 0.35 && loSh >= body * 2 && upSh <= body * 0.5) return { name:'Hammer', col:'#16C784', above:false };
      if (body <= range * 0.35 && upSh >= body * 2 && loSh <= body * 0.5) return { name:'Shooting Star', col:'#EA3943', above:true };
      if (ix > 0){
        const p = data[ix - 1];
        if (p.c < p.o && k.c > k.o && k.o <= p.c && k.c >= p.o) return { name:'Bull Engulfing', col:'#16C784', above:false };
        if (p.c > p.o && k.c < k.o && k.o >= p.c && k.c <= p.o) return { name:'Bear Engulfing', col:'#EA3943', above:true };
      }
      return null;
    }
    ctx.font = 'bold 10px Segoe UI'; ctx.textAlign = 'center';
    data.forEach((k, ix) => {
      const pt = patternAt(ix); if (!pt) return;
      const x = X(ix);
      const tw = ctx.measureText(pt.name).width;
      const cx = Math.max(tw / 2 + 3, Math.min(x, plotW - tw / 2 - 3));
      ctx.fillStyle = pt.col;
      if (pt.above){
        const y = Math.max(Y(k.h) - 8, padT + 8);
        ctx.beginPath(); ctx.arc(cx, y - 4, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillText('▼ ' + pt.name, cx, y - 10);
      } else {
        const y = Math.min(Y(k.l) + 8, mainBottom - 16);
        ctx.beginPath(); ctx.arc(cx, y + 4, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillText('▲ ' + pt.name, cx, y + 16);
      }
    });
    ctx.textAlign = 'left';
  }
  /* oscillator panels (RSI / MACD) */
  function drawOscLine(series, y0, h, minV, maxV, color, width){
    const y = v => y0 + (maxV - v) / ((maxV - minV) || 1) * h;
    ctx.strokeStyle = color; ctx.lineWidth = width || 1.4; ctx.beginPath(); let started = false;
    for (let ix = 0; ix < data.length; ix++){
      const v = series[start + ix];
      if (v == null || !isFinite(v)){ started = false; continue; }
      const x = X(ix), yy = y(v);
      if (!started){ ctx.moveTo(x, yy); started = true; } else ctx.lineTo(x, yy);
    }
    ctx.stroke(); ctx.lineWidth = 1;
  }
  function oscFrame(y0, h, title){
    ctx.strokeStyle = LIGHT ? 'rgba(15,35,80,0.14)' : 'rgba(255,255,255,.10)';
    ctx.strokeRect(0.5, y0 + 0.5, plotW - 1, h - 1);
    ctx.fillStyle = LIGHT ? '#5B6B8C' : '#93A1C4'; ctx.font = 'bold 10px Segoe UI';
    ctx.fillText(title, 8, y0 + 12);
  }
  function drawRSI(y0, h){
    oscFrame(y0, h, 'RSI 14');
    const y = v => y0 + (100 - v) / 100 * h;
    ctx.strokeStyle = LIGHT ? 'rgba(15,35,80,0.16)' : 'rgba(255,255,255,.12)'; ctx.setLineDash([4, 4]);
    [70, 30].forEach(v => { ctx.beginPath(); ctx.moveTo(0, y(v)); ctx.lineTo(plotW, y(v)); ctx.stroke(); });
    ctx.setLineDash([]);
    drawOscLine(rsi, y0, h, 0, 100, '#F5B544', 1.5);
    const lastR = rsi[start + data.length - 1];
    if (lastR != null){ ctx.fillStyle = '#F5B544'; ctx.font = 'bold 10px Segoe UI'; ctx.fillText(lastR.toFixed(1), plotW - 34, y0 + 12); }
  }
  function drawMACD(y0, h){
    oscFrame(y0, h, 'MACD');
    let mn = Infinity, mx = -Infinity;
    for (let ix = 0; ix < data.length; ix++){
      const i = start + ix;
      [macd.macd[i], macd.signal[i], macd.hist[i]].forEach(v => { if (v != null && isFinite(v)){ mn = Math.min(mn, v); mx = Math.max(mx, v); } });
    }
    if (!isFinite(mn)){ mn = -1; mx = 1; }
    if (mx === mn){ mx += 1; mn -= 1; }
    const y = v => y0 + (mx - v) / (mx - mn) * h;
    ctx.strokeStyle = LIGHT ? 'rgba(15,35,80,0.16)' : 'rgba(255,255,255,.12)';
    ctx.beginPath(); ctx.moveTo(0, y(0)); ctx.lineTo(plotW, y(0)); ctx.stroke();
    const bw2 = Math.max(step * 0.45, 1.2);
    for (let ix = 0; ix < data.length; ix++){
      const v = macd.hist[start + ix]; if (v == null) continue;
      ctx.fillStyle = v >= 0 ? 'rgba(22,199,132,.65)' : 'rgba(234,57,67,.65)';
      const x = X(ix);
      ctx.fillRect(x - bw2 / 2, Math.min(y(0), y(v)), bw2, Math.max(Math.abs(y(v) - y(0)), 1));
    }
    drawOscLine(macd.macd, y0, h, mn, mx, '#4EA8FF', 1.4);
    drawOscLine(macd.signal, y0, h, mn, mx, '#F5B544', 1.4);
  }
  if (oscCount){
    let oy = mainBottom + 6;
    const eachH = (oscH - 6) / oscCount;
    if (ind.rsi){ drawRSI(oy, eachH - 4); oy += eachH; }
    if (ind.macd){ drawMACD(oy, eachH - 4); oy += eachH; }
  }
  /* last price */
  const last = data[data.length - 1].c, ly = Y(last), lup = last >= data[data.length - 1].o;
  ctx.strokeStyle = lup ? '#16C784' : '#EA3943'; ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(plotW, ly); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = lup ? '#16C784' : '#EA3943';
  const label = Oryx.fmtP(symbol, last), tw = ctx.measureText(label).width + 12;
  ctx.fillRect(plotW + 2, ly - 10, Math.min(tw, axisW - 3), 20);
  ctx.fillStyle = '#04150A'; ctx.font = 'bold 10.5px Segoe UI';
  ctx.fillText(label, plotW + 7, ly + 3.5);
  /* legend */
  const chg = Oryx.changePct(symbol);
  ctx.font = 'bold 11px Segoe UI'; ctx.textAlign = 'left';
  const mainLegend = symbol + '  ·  ' + (live ? 'LIVE' : 'HISTORY') + '  ·  ' + tfText + ' candles';
  ctx.fillStyle = LIGHT ? '#5B6B8C' : '#93A1C4';
  ctx.fillText(mainLegend, 10, H - 6);
  let lx = 10 + ctx.measureText(mainLegend).width + 14;
  const chgText = (chg >= 0 ? '▲ +' : '▼ ') + chg.toFixed(2) + '%';
  ctx.fillStyle = chg >= 0 ? '#16C784' : '#EA3943';
  ctx.fillText(chgText, lx, H - 6); lx += ctx.measureText(chgText).width + 12;
  function legendItem(text, color){
    if (lx > plotW - 36) return;
    ctx.fillStyle = color; ctx.fillText(text, lx, H - 6);
    lx += ctx.measureText(text).width + 10;
  }
  if (ind.ma){ legendItem('— MA10', '#F5B544'); legendItem('— MA26', '#4EA8FF'); }
  if (ind.ema){ legendItem('— EMA12', '#C084FC'); legendItem('— EMA26', '#FB7185'); }
  if (ind.bb) legendItem('— BB', '#38BDF8');
  if (ind.rsi) legendItem('RSI', '#F5B544');
  if (ind.macd) legendItem('MACD', '#4EA8FF');
}
