/* Oryx live candlestick chart — draws Oryx.candles(symbol) on a canvas.
   Self-contained: no external widgets, updates with the site's own feed.
   Includes MA lines and candlestick-pattern labels (Hammer, Shooting Star,
   Doji, Engulfing), like a pro exchange terminal. */
function drawLiveChart(cv, symbol, startIdx, visible){
  if (!cv || typeof Oryx === 'undefined') return;
  const LIGHT = document.documentElement.classList.contains('light');
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, H = cv.clientHeight;
  if (!W || !H) return;
  if (cv.width !== Math.round(W * dpr)){ cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#070D1D'; ctx.fillRect(0, 0, W, H);
  const all = Oryx.candles(symbol), vis = visible || 30;
  const start = Math.max(0, Math.min(startIdx || 0, Math.max(0, all.length - vis)));
  const live = start + vis >= all.length;
  const data = all.slice(start, start + vis); /* big, clear candles — scroll back for history */
  if (!data.length) return;
  const axisW = 64, padT = 12;
  const plotW = W - axisW;
  const plotH = H - padT - 22;
  let min = Infinity, max = -Infinity;
  data.forEach(k => { min = Math.min(min, k.l); max = Math.max(max, k.h); });
  const pad = (max - min) * 0.08 || max * 0.001 || 1; max += pad; min -= pad;
  const Y = v => padT + (max - v) / (max - min) * plotH;
  ctx.strokeStyle = LIGHT ? 'rgba(15,35,80,0.09)' : 'rgba(255,255,255,.055)'; ctx.fillStyle = LIGHT ? '#64748B' : '#66738F'; ctx.font = '10.5px Segoe UI'; ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++){
    const v = min + (max - min) * g / 4, y = Y(v);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(plotW, y); ctx.stroke();
    ctx.fillText(Oryx.fmtP(symbol, v), plotW + 7, y + 3);
  }
  const step = plotW / data.length, bw = Math.max(step * 0.62, 1.5);
  /* candles */
  data.forEach((k, ix) => {
    const x = ix * step + step / 2, up = k.c >= k.o, col = up ? '#16C784' : '#EA3943';
    ctx.strokeStyle = col; ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(x, Y(k.h)); ctx.lineTo(x, Y(k.l)); ctx.stroke();
    const yO = Y(k.o), yC = Y(k.c);
    ctx.fillRect(x - bw / 2, Math.min(yO, yC), bw, Math.max(Math.abs(yC - yO), 1.2));
  });
  /* moving-average lines */
  function maLine(period, color){
    if (data.length < period) return;
    ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.beginPath();
    let started = false;
    for (let ix = period - 1; ix < data.length; ix++){
      let s = 0; for (let j = ix - period + 1; j <= ix; j++) s += data[j].c;
      const x = ix * step + step / 2, y = Y(s / period);
      if (!started){ ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke(); ctx.lineWidth = 1;
  }
  maLine(10, '#F5B544');
  maLine(26, '#4EA8FF');
  /* candlestick patterns — shape-based: Hammer, Shooting Star, Doji, Engulfing */
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
    const x = ix * step + step / 2;
    const tw = ctx.measureText(pt.name).width;
    const cx = Math.max(tw / 2 + 3, Math.min(x, plotW - tw / 2 - 3));
    ctx.fillStyle = pt.col;
    if (pt.above){
      const y = Math.max(Y(k.h) - 8, padT + 8);
      ctx.beginPath(); ctx.arc(cx, y - 4, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillText('▼ ' + pt.name, cx, y - 10);
    } else {
      const y = Math.min(Y(k.l) + 8, H - 14);
      ctx.beginPath(); ctx.arc(cx, y + 4, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillText('▲ ' + pt.name, cx, y + 16);
    }
  });
  ctx.textAlign = 'left';
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
  ctx.fillStyle = LIGHT ? '#5B6B8C' : '#93A1C4'; ctx.font = 'bold 11px Segoe UI';
  ctx.fillText(symbol + '  ·  ' + (live ? 'LIVE' : 'HISTORY') + '  ·  5s candles', 10, H - 6);
  ctx.fillStyle = chg >= 0 ? '#16C784' : '#EA3943';
  ctx.fillText((chg >= 0 ? '▲ +' : '▼ ') + chg.toFixed(2) + '%', 196, H - 6);
  ctx.fillStyle = '#F5B544'; ctx.fillText('— MA10', 268, H - 6);
  ctx.fillStyle = '#4EA8FF'; ctx.fillText('— MA26', 322, H - 6);
}
