/* Oryx live candlestick chart — draws Oryx.candles(symbol) on a canvas.
   Self-contained: no external widgets, updates with the site's own feed.
   Includes MA lines and a volume strip, like a pro exchange terminal. */
function drawLiveChart(cv, symbol){
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
  const data = Oryx.candles(symbol).slice(-42); /* fewer, BOLDER candles on screen, like a pro chart */
  if (!data.length) return;
  const axisW = 64, padT = 12;
  const plotW = W - axisW;
  const volH = Math.max(Math.round(H * 0.16), 30);
  const plotH = H - padT - volH - 22;
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
  /* volume strip (derived from candle ranges — steady per candle) */
  const vols = data.map(k => (k.h - k.l) + Math.abs(k.c - k.o) * 0.7 + (Math.abs(Math.sin(k.o * 977 + k.c * 131)) * (k.h - k.l + 0.0000001)));
  const vmax = Math.max(...vols) || 1;
  data.forEach((k, ix) => {
    const x = ix * step + step / 2, up = k.c >= k.o, col = up ? '#16C784' : '#EA3943';
    ctx.globalAlpha = 0.55; ctx.fillStyle = col;
    const vh = Math.max(vols[ix] / vmax * (volH - 6), 1);
    ctx.fillRect(x - bw / 2, padT + plotH + (volH - vh), bw, vh);
    ctx.globalAlpha = 1;
  });
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
  ctx.fillText(symbol + '  ·  LIVE  ·  5s candles', 10, H - 6);
  ctx.fillStyle = chg >= 0 ? '#16C784' : '#EA3943';
  ctx.fillText((chg >= 0 ? '▲ +' : '▼ ') + chg.toFixed(2) + '%', 196, H - 6);
  ctx.fillStyle = '#F5B544'; ctx.fillText('— MA10', 268, H - 6);
  ctx.fillStyle = '#4EA8FF'; ctx.fillText('— MA26', 322, H - 6);
}
