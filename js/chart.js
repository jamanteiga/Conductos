/**
 * RENDERIZADORES CANVAS — CONDUCTOS HVAC
 * 1. Ábaco de dimensionado (D vs R, log-log)
 * 2. Sección transversal del conducto
 */
import { abacoLines, sizeCircular, frictionFactor } from './engine.js';

const R_MIN = 0.1, R_MAX = 10;    // Pa/m
const D_MIN = 0.05, D_MAX = 1.5;  // m

// ── ÁBACO ─────────────────────────────────────────────────────────────────────
export class AbacoChart {
  constructor(canvas, onClick) {
    this.canvas    = canvas;
    this.ctx       = canvas.getContext('2d');
    this.onClick   = onClick || (() => {});
    this.pad       = { top: 16, right: 20, bottom: 48, left: 56 };
    this.point     = null;
    this.lines     = null;
    this._loupePos = null;   // { x, y } CSS px — null = sin lupa
    this._rafId    = null;
    this.resize();
    this._bind();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width  = rect.width  * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.W = rect.width; this.H = rect.height;
    this.cw = this.W - this.pad.left - this.pad.right;
    this.ch = this.H - this.pad.top  - this.pad.bottom;
    this._cache = null;
  }

  xOf(R) { return this.pad.left + Math.log10(R / R_MIN) / Math.log10(R_MAX / R_MIN) * this.cw; }
  yOf(D) { return this.pad.top  + (1 - Math.log10(D / D_MIN) / Math.log10(D_MAX / D_MIN)) * this.ch; }
  invX(px) { return R_MIN * Math.pow(10, (px - this.pad.left) / this.cw * Math.log10(R_MAX / R_MIN)); }
  invY(py) { return D_MIN * Math.pow(10, (1 - (py - this.pad.top) / this.ch) * Math.log10(D_MAX / D_MIN)); }
  inChart(x,y) { return x>=this.pad.left && x<=this.pad.left+this.cw && y>=this.pad.top && y<=this.pad.top+this.ch; }

  setLines(lines) { this.lines = lines; this._cache = null; }

  draw(point) {
    if (point !== undefined) this.point = point;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    if (!this._cache) this._buildCache();
    ctx.drawImage(this._cacheCanvas, 0, 0);
    if (this.point) this._drawPoint(this.point);
    if (this._loupePos) this._drawLoupe(this._loupePos.x, this._loupePos.y);
  }

  _buildCache() {
    this._cacheCanvas = document.createElement('canvas');
    this._cacheCanvas.width  = this.canvas.width;
    this._cacheCanvas.height = this.canvas.height;
    const dpr = window.devicePixelRatio || 1;
    const c2  = this._cacheCanvas.getContext('2d');
    c2.scale(dpr, dpr);
    const save = this.ctx; this.ctx = c2;
    this._drawBg();
    this._drawGrid();
    this._drawVelZones();
    if (this.lines) this._drawIsoQ();
    this._drawAxes();
    this.ctx = save;
    this._cache = true;   // marcar caché válido
  }

  _drawBg() {
    this.ctx.fillStyle = '#f8f9fa';
    this.ctx.fillRect(0, 0, this.W, this.H);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(this.pad.left, this.pad.top, this.cw, this.ch);
  }

  _drawGrid() {
    const ctx = this.ctx;
    ctx.strokeStyle = '#e9ecef'; ctx.lineWidth = 0.7;
    // Vertical (R)
    [-1,0,1].forEach(e => [1,2,3,4,5,6,7,8,9].forEach(m => {
      const R = m * Math.pow(10, e);
      if (R < R_MIN || R > R_MAX) return;
      const x = this.xOf(R);
      ctx.beginPath(); ctx.moveTo(x, this.pad.top); ctx.lineTo(x, this.pad.top+this.ch); ctx.stroke();
    }));
    // Horizontal (D)
    [0.05,0.06,0.08,0.1,0.125,0.15,0.2,0.25,0.315,0.4,0.5,0.63,0.8,1.0,1.25].forEach(D => {
      if (D < D_MIN || D > D_MAX) return;
      const y = this.yOf(D);
      ctx.beginPath(); ctx.moveTo(this.pad.left, y); ctx.lineTo(this.pad.left+this.cw, y); ctx.stroke();
    });
  }

  _drawVelZones() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(52,199,89,0.06)';
  }

  _drawIsoQ() {
    const ctx = this.ctx;
    const colors = ['#007aff','#5856d6','#34c759','#ff9500','#ff3b30',
                    '#30b0c7','#af52de','#ffd60a','#8e8e93','#ff6b35','#2c3e50'];
    this.lines.forEach(({ Q, label, pts }, li) => {
      const color = colors[li % colors.length];
      const valid = pts.filter(p => p.D >= D_MIN && p.D <= D_MAX && p.R >= R_MIN && p.R <= R_MAX);
      if (valid.length < 2) return;
      ctx.strokeStyle = color; ctx.lineWidth = 1.3;
      ctx.beginPath();
      valid.forEach((p, i) => {
        const x = this.xOf(p.R), y = this.yOf(p.D);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      // Label
      const mid = valid[Math.floor(valid.length * 0.55)];
      if (mid) {
        const x = this.xOf(mid.R), y = this.yOf(mid.D);
        if (this.inChart(x, y)) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x - 1, y - 9, ctx.measureText(label).width + 6, 12);
          ctx.fillStyle = color;
          ctx.font = '8px DM Mono,monospace';
          ctx.textAlign = 'left';
          ctx.fillText(label, x + 2, y);
        }
      }
    });
  }

  _drawAxes() {
    const ctx = this.ctx;
    ctx.strokeStyle = '#adb5bd'; ctx.lineWidth = 1;
    ctx.strokeRect(this.pad.left, this.pad.top, this.cw, this.ch);

    // X labels (R)
    ctx.fillStyle = '#6c757d'; ctx.font = '10px DM Mono,monospace'; ctx.textAlign = 'center';
    [0.1,0.2,0.5,1,2,5,10].forEach(R => {
      if (R < R_MIN || R > R_MAX) return;
      const x = this.xOf(R);
      ctx.fillText(R < 1 ? R.toFixed(1) : R.toString(), x, this.pad.top + this.ch + 14);
    });
    ctx.fillStyle = '#495057'; ctx.font = '11px DM Sans,-apple-system,sans-serif';
    ctx.fillText('Rozamiento R [Pa/m]', this.pad.left + this.cw/2, this.pad.top + this.ch + 30);

    // Y labels (D)
    ctx.textAlign = 'right'; ctx.font = '10px DM Mono,monospace';
    [0.1,0.15,0.2,0.25,0.315,0.4,0.5,0.63,0.8,1.0].forEach(D => {
      if (D < D_MIN || D > D_MAX) return;
      const y = this.yOf(D);
      ctx.fillStyle = '#6c757d';
      ctx.fillText(`${(D*1000).toFixed(0)}`, this.pad.left - 4, y + 3);
    });
    ctx.save();
    ctx.translate(12, this.pad.top + this.ch/2);
    ctx.rotate(-Math.PI/2);
    ctx.fillStyle = '#495057'; ctx.font = '11px DM Sans,-apple-system,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Diámetro D [mm]', 0, 0);
    ctx.restore();
  }

  _drawPoint(p) {
    if (!p || !isFinite(p.R) || !isFinite(p.D)) return;
    const ctx = this.ctx;
    const x = this.xOf(p.R), y = this.yOf(p.D);
    if (!this.inChart(x, y)) return;

    // Crosshairs
    ctx.strokeStyle = 'rgba(220,53,69,0.3)'; ctx.lineWidth = 1; ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.moveTo(this.pad.left,y); ctx.lineTo(x,y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x,this.pad.top+this.ch); ctx.lineTo(x,y); ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x,y,9,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#dc3545'; ctx.beginPath(); ctx.arc(x,y,7,0,Math.PI*2); ctx.fill();

    // Labels on axes
    ctx.fillStyle = '#dc3545'; ctx.font = 'bold 9px DM Mono,monospace'; ctx.textAlign = 'center';
    ctx.fillText(p.R.toFixed(2), x, this.pad.top + this.ch + 12);
    ctx.textAlign = 'right';
    ctx.fillText(`${(p.D*1000).toFixed(0)}`, this.pad.left - 4, y + 3);
  }

  // ── LUPA ──────────────────────────────────────────────────────────────────
  _drawLoupe(mx, my) {
    if (!this.inChart(mx, my)) return;
    const ctx    = this.ctx;
    const RADIUS = 72;    // radio de la lupa en CSS px
    const ZOOM   = 3.5;   // factor de ampliación

    ctx.save();

    // Clip circular
    ctx.beginPath();
    ctx.arc(mx, my, RADIUS, 0, Math.PI * 2);
    ctx.clip();

    // Fondo blanco limpio dentro de la lupa
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(mx - RADIUS, my - RADIUS, RADIUS * 2, RADIUS * 2);

    // Transformación de zoom: ampliamos alrededor del cursor
    ctx.translate(mx * (1 - ZOOM), my * (1 - ZOOM));
    ctx.scale(ZOOM, ZOOM);

    // Re-renderizamos el gráfico con la nueva transformación
    this._drawBg();
    this._drawGrid();
    if (this.lines) this._drawIsoQ();
    this._drawAxes();
    if (this.point) this._drawPoint(this.point);

    ctx.restore();

    // Borde de la lupa con sombra
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.22)';
    ctx.shadowBlur  = 12;
    ctx.strokeStyle = 'rgba(30,30,30,0.65)';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(mx, my, RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Mira central (cruz roja fina)
    ctx.save();
    ctx.strokeStyle = 'rgba(220,53,69,0.75)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(mx - 10, my); ctx.lineTo(mx + 10, my);
    ctx.moveTo(mx, my - 10); ctx.lineTo(mx, my + 10);
    ctx.stroke();
    ctx.restore();

    // Tooltip con valores R y D sobre la lupa
    const Rv = this.invX(mx), Dv = this.invY(my);
    if (isFinite(Rv) && isFinite(Dv) && Rv > 0 && Dv > 0) {
      const txt = `R = ${Rv.toFixed(2)} Pa/m  ·  Ø ${(Dv * 1000).toFixed(0)} mm`;
      ctx.save();
      ctx.font = 'bold 10px DM Mono,monospace';
      const tw = ctx.measureText(txt).width;
      let tx = mx - tw / 2 - 5;
      let ty = my - RADIUS - 18;
      if (ty < 4) ty = my + RADIUS + 6;
      if (tx < 2) tx = 2;
      if (tx + tw + 12 > this.W) tx = this.W - tw - 12;

      ctx.fillStyle = 'rgba(20,20,20,0.82)';
      ctx.fillRect(tx, ty, tw + 10, 16);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(txt, tx + 5, ty + 11);
      ctx.restore();
    }
  }

  _bind() {
    // Click / tap: leer R y D y notificar
    const clickHandler = e => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const src  = e.touches ? e.touches[0] : e;
      const cx = src.clientX - rect.left, cy = src.clientY - rect.top;
      if (!this.inChart(cx, cy)) return;
      this.onClick({ R: this.invX(cx), D: this.invY(cy) });
    };
    this.canvas.addEventListener('click',    clickHandler);
    this.canvas.addEventListener('touchend', clickHandler, { passive: false });

    // Mousemove / touchmove: lupa (throttled con rAF)
    const scheduleLoupe = (x, y) => {
      this._loupePos = { x, y };
      if (this._rafId) return;
      this._rafId = requestAnimationFrame(() => {
        this._rafId = null;
        this.draw();
      });
    };

    this.canvas.addEventListener('mousemove', e => {
      const rect = this.canvas.getBoundingClientRect();
      scheduleLoupe(e.clientX - rect.left, e.clientY - rect.top);
    });

    this.canvas.addEventListener('mouseleave', () => {
      this._loupePos = null;
      this.draw();
    });

    this.canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const t    = e.touches[0];
      scheduleLoupe(t.clientX - rect.left, t.clientY - rect.top);
    }, { passive: false });

    this.canvas.addEventListener('touchend', () => {
      this._loupePos = null;
      this.draw();
    });
  }
}

// ── SECCIÓN TRANSVERSAL ───────────────────────────────────────────────────────
export function drawSection(canvas, geom, tipo) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth, H = canvas.offsetHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#f8f9fa'; ctx.fillRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;
  const margin = 28;

  if (tipo === 'circular' || tipo === 'spiral') {
    const D = geom.Dnorm || geom.D;
    const r = Math.min((W - margin*2) / 2, (H - margin*2) / 2);
    const isSpiral = tipo === 'spiral';
    ctx.strokeStyle = isSpiral ? '#5856d6' : '#adb5bd';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
    if (isSpiral) {
      ctx.strokeStyle = 'rgba(88,86,214,0.25)'; ctx.lineWidth = 1.5;
      for (let angle = 0; angle < Math.PI*2; angle += Math.PI/6) {
        const x1 = cx + (r-8)*Math.cos(angle), y1 = cy + (r-8)*Math.sin(angle);
        const x2 = cx + r*Math.cos(angle+0.3),  y2 = cy + r*Math.sin(angle+0.3);
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      }
    }
    ctx.fillStyle = isSpiral ? 'rgba(88,86,214,0.07)' : 'rgba(0,122,255,0.08)';
    ctx.beginPath(); ctx.arc(cx, cy, r - 3, 0, Math.PI*2); ctx.fill();
    _drawArrow(ctx, cx - r*0.4, cy, cx + r*0.4, cy, isSpiral ? '#5856d6' : '#007aff');
    ctx.strokeStyle = '#dc3545'; ctx.lineWidth = 1; ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#dc3545'; ctx.font = 'bold 12px DM Mono,monospace'; ctx.textAlign = 'center';
    ctx.fillText(`Ø ${(D*1000).toFixed(0)} mm`, cx, cy + r + 16);
    if (isSpiral) {
      ctx.fillStyle = '#5856d6'; ctx.font = '10px DM Sans,-apple-system,sans-serif';
      ctx.fillText('ESPIRAL', cx, cy + r + 30);
    }

  } else if (tipo === 'oval') {
    const a = geom.aNorm || geom.a;
    const b = geom.bNorm || geom.b;
    const scaleW = (W - margin*2) / a;
    const scaleH = (H - margin*2 - 30) / b;
    const sc = Math.min(scaleW, scaleH, 500);
    const pw = a * sc, ph = b * sc;
    const px = cx - pw/2, py = cy - ph/2;
    const rb = ph / 2;
    const _oval = () => {
      ctx.beginPath();
      ctx.arc(px + rb,      cy, rb, Math.PI/2, -Math.PI/2);
      ctx.lineTo(px + pw - rb, cy - rb);
      ctx.arc(px + pw - rb, cy, rb, -Math.PI/2, Math.PI/2);
      ctx.lineTo(px + rb, cy + rb);
      ctx.closePath();
    };
    ctx.fillStyle = 'rgba(52,199,89,0.09)'; _oval(); ctx.fill();
    ctx.strokeStyle = '#34c759'; ctx.lineWidth = 5; _oval(); ctx.stroke();
    _drawArrow(ctx, px + pw*0.2, cy, px + pw*0.8, cy, '#34c759');
    ctx.strokeStyle = '#dc3545'; ctx.lineWidth = 1; ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.moveTo(px, py - 14); ctx.lineTo(px+pw, py-14); ctx.stroke();
    ctx.fillStyle = '#dc3545'; ctx.font = 'bold 11px DM Mono,monospace'; ctx.textAlign = 'center';
    ctx.fillText(`${(a*1000).toFixed(0)} mm`, cx, py - 18);
    ctx.beginPath(); ctx.moveTo(px - 14, cy - rb); ctx.lineTo(px-14, cy+rb); ctx.stroke();
    ctx.save(); ctx.translate(px-18, cy); ctx.rotate(-Math.PI/2);
    ctx.fillText(`${(b*1000).toFixed(0)} mm`, 0, 0); ctx.restore();
    ctx.setLineDash([]);
    ctx.fillStyle = '#8e8e93'; ctx.font = '10px DM Sans,-apple-system,sans-serif'; ctx.textAlign='center';
    ctx.fillText(`AR = ${(a/b).toFixed(1)}:1  ·  OVAL`, cx, py + ph + 16);

  } else {
    const a = geom.aNorm || geom.a;
    const b = geom.bNorm || geom.b;
    const scale = Math.min((W - margin*2) / a, (H - margin*2 - 20) / b, 600);
    const pw = a * scale, ph = b * scale;
    const px = cx - pw/2, py = cy - ph/2;
    ctx.strokeStyle = '#adb5bd'; ctx.lineWidth = 5;
    ctx.strokeRect(px, py, pw, ph);
    ctx.fillStyle = 'rgba(0,122,255,0.08)';
    ctx.fillRect(px+2, py+2, pw-4, ph-4);
    _drawArrow(ctx, px + pw*0.2, cy, px + pw*0.8, cy, '#007aff');
    ctx.strokeStyle = '#dc3545'; ctx.lineWidth = 1; ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.moveTo(px, py - 14); ctx.lineTo(px+pw, py - 14); ctx.stroke();
    ctx.fillStyle = '#dc3545'; ctx.font = 'bold 11px DM Mono,monospace'; ctx.textAlign = 'center';
    ctx.fillText(`${(a*1000).toFixed(0)} mm`, cx, py - 18);
    ctx.beginPath(); ctx.moveTo(px - 14, py); ctx.lineTo(px - 14, py+ph); ctx.stroke();
    ctx.save(); ctx.translate(px - 18, cy); ctx.rotate(-Math.PI/2);
    ctx.fillText(`${(b*1000).toFixed(0)} mm`, 0, 0); ctx.restore();
    ctx.setLineDash([]);
    ctx.fillStyle = '#8e8e93'; ctx.font = '10px DM Sans,-apple-system,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`AR = ${(a/b).toFixed(1)}:1`, cx, py + ph + 16);
  }
}

function _drawArrow(ctx, x1, y1, x2, y2, color) {
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - 8, y2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2); ctx.lineTo(x2-10, y2-5); ctx.lineTo(x2-10, y2+5); ctx.closePath(); ctx.fill();
}