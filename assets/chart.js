/* Oryx live candlestick chart — draws Oryx.candles(symbol) on a canvas.
   Self-contained: no external widgets, updates with the site's own feed. */
function drawLiveChart(cv, symbol){
  if (!cv || !window.Oryx) return;
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, H = cv.clientHeight;
  if (!W || !H) return;
  if (cv.width !== Math.round(W * dpr)){ cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#070D1D'; ctx.fillRect(0, 0, W, H);
  const data = Oryx.candles(symbol);
  if (!data.length) return;
  const axisW = 64, padT = 12, padB = 20;
  const plotW = W - axisW, plotH = H - padT - padB;
  let min = Infinity, max = -Infinity;
  data.forEach(k => { min = Math.min(min, k.l); max = Math.max(max, k.h); });
  const pad = (max - min) * 0.08 || max * 0.001 || 1; max += pad; min -= pad;
  const Y = v => padT + (max - v) / (max - min) * plotH;
  ctx.strokeStyle = 'rgba(255,255,255,.055)'; ctx.fillStyle = '#66738F'; ctx.font = '10.5px Segoe UI'; ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++){
    const v = min + (max - min) * g / 4, y = Y(v);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(plotW, y); ctx.stroke();
    ctx.fillText(Oryx.fmtP(symbol, v), plotW + 7, y + 3);
  }
  const step = plotW / data.length, bw = Math.max(step * 0.62, 1.5);
  data.forEach((k, ix) => {
    const x = ix * step + step / 2, up = k.c >= k.o, col = up ? '#16C784' : '#EA3943';
    ctx.strokeStyle = col; ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(x, Y(k.h)); ctx.lineTo(x, Y(k.l)); ctx.stroke();
    const yO = Y(k.o), yC = Y(k.c);
    ctx.fillRect(x - bw / 2, Math.min(yO, yC), bw, Math.max(Math.abs(yC - yO), 1.2));
  });
  const last = data[data.length - 1].c, ly = Y(last), lup = last >= data[data.length - 1].o;
  ctx.strokeStyle = lup ? '#16C784' : '#EA3943'; ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(plotW, ly); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = lup ? '#16C784' : '#EA3943';
  const label = Oryx.fmtP(symbol, last), tw = ctx.measureText(label).width + 12;
  ctx.fillRect(plotW + 2, ly - 10, Math.min(tw, axisW - 3), 20);
  ctx.fillStyle = '#04150A'; ctx.font = 'bold 10.5px Segoe UI';
  ctx.fillText(label, plotW + 7, ly + 3.5);
  const chg = Oryx.changePct(symbol);
  ctx.fillStyle = '#93A1C4'; ctx.font = 'bold 11px Segoe UI';
  ctx.fillText(symbol + '  ·  LIVE  ·  5s candles', 10, H - 6);
  ctx.fillStyle = chg >= 0 ? '#16C784' : '#EA3943';
  ctx.fillText((chg >= 0 ? '▲ +' : '▼ ') + chg.toFixed(2) + '%', 190, H - 6);
}
