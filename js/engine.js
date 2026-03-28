/**
 * MOTOR DE CÁLCULO — DIMENSIONADO DE CONDUCTOS HVAC
 * Método de rozamiento constante (Constant Friction Loss Method)
 *
 * Referencias:
 *   ASHRAE Fundamentals 2017, Cap. 21 — Duct Design
 *   SMACNA HVAC Duct Construction Standards
 *   UNE-EN 13779 — Ventilación de edificios no residenciales
 */

// ── CONSTANTES AIRE ESTÁNDAR ──────────────────────────────────────────────────
export const RHO_STD  = 1.204;   // kg/m³  — aire 20°C, 101325 Pa
export const NU_STD   = 1.516e-5; // m²/s  — viscosidad cinemática
export const MU_STD   = 1.825e-5; // Pa·s  — viscosidad dinámica
export const CP_AIR   = 1006;     // J/(kg·K)
export const G        = 9.81;     // m/s²
export const PI       = Math.PI;

// ── MATERIALES DE CONDUCTOS ───────────────────────────────────────────────────
export const MATERIALS = [
  { name: 'Acero galvanizado (liso)',   eps: 0.09e-3,  desc: 'Más común en HVAC'        },
  { name: 'Acero galvanizado (medio)',  eps: 0.15e-3,  desc: 'Con uniones transversales' },
  { name: 'Fibra de vidrio interior',   eps: 0.90e-3,  desc: 'Con revestimiento interno' },
  { name: 'Concreto / hormigón',        eps: 1.30e-3,  desc: 'Conductos enterrados'      },
  { name: 'Flexible aluminio',          eps: 1.50e-3,  desc: 'Tramos cortos máx. 1.5 m'  },
  { name: 'PVC liso',                   eps: 0.05e-3,  desc: 'Extracción laboratorios'   },
  { name: 'Acero inoxidable',           eps: 0.05e-3,  desc: 'Cocinas / industria'       },
  { name: 'Personalizado',              eps: null,      desc: 'Introduce rugosidad'       },
];

// ── CONDICIONES DE AIRE ───────────────────────────────────────────────────────
export const AIR_CONDITIONS = [
  { name: 'Aire estándar  20°C',  T: 20,  rho: 1.204,  nu: 1.516e-5 },
  { name: 'Aire frío       10°C', T: 10,  rho: 1.247,  nu: 1.416e-5 },
  { name: 'Aire caliente   40°C', T: 40,  rho: 1.127,  nu: 1.702e-5 },
  { name: 'Aire caliente   60°C', T: 60,  rho: 1.060,  nu: 1.896e-5 },
  { name: 'Personalizado',        T: null, rho: null,   nu: null     },
];

// ── VELOCIDADES RECOMENDADAS (m/s) — ASHRAE ───────────────────────────────────
export const VEL_LIMITS = {
  impulsion_baja:   { min: 3,  max: 8,  rec: 5,  label: 'Impulsión baja velocidad'   },
  impulsion_media:  { min: 8,  max: 14, rec: 10, label: 'Impulsión media velocidad'   },
  impulsion_alta:   { min: 14, max: 20, rec: 16, label: 'Impulsión alta velocidad'    },
  retorno:          { min: 3,  max: 8,  rec: 5,  label: 'Retorno / extracción'        },
  plenum:           { min: 1,  max: 4,  rec: 2,  label: 'Plenum / caja mezcla'        },
};

// ── ROZAMIENTO RECOMENDADO (Pa/m) ─────────────────────────────────────────────
export const FRICTION_RECS = [
  { label: 'Confort residencial',       value: 0.6  },
  { label: 'Confort comercial',         value: 0.8  },
  { label: 'Oficinas / hosp.',          value: 1.0  },
  { label: 'Industrial general',        value: 1.5  },
  { label: 'Industrial alta vel.',      value: 2.5  },
];

// ── COLEBROOK-WHITE ───────────────────────────────────────────────────────────
export function frictionFactor(Re, eps_D) {
  if (Re < 1)    return 64;
  if (Re < 2300) return 64 / Re;
  // Swamee-Jain explícita (semilla) + 6 iteraciones Colebrook
  let f = 0.25 / Math.pow(Math.log10(eps_D / 3.7 + 5.74 / Math.pow(Re, 0.9)), 2);
  for (let i = 0; i < 6; i++) {
    const rhs = -2 * Math.log10(eps_D / 3.7 + 2.51 / (Re * Math.sqrt(f)));
    f = 1 / (rhs * rhs);
  }
  return f;
}

// ── DIÁMETRO EQUIVALENTE ──────────────────────────────────────────────────────

/** Diámetro hidráulico rectangular [m] */
export function dhRect(a, b) { return 2 * a * b / (a + b); }

/** Diámetro equivalente (igual pérdida de presión) para sección rectangular */
export function deqRect(a, b) {
  return 1.30 * Math.pow(a * b, 0.625) / Math.pow(a + b, 0.25);
}

/** Sección circular equivalente */
export function areaCirc(D) { return PI * D * D / 4; }
export function areaRect(a, b) { return a * b; }

// ── CÁLCULO PRINCIPAL — CONDUCTO CIRCULAR ─────────────────────────────────────
/**
 * Dado Q [m³/s] y rozamiento objetivo R [Pa/m]:
 * Calcula diámetro, velocidad, Re, f para conducto circular
 */
export function sizeCircular(Q, R_target, eps, rho = RHO_STD, nu = NU_STD, maxIter = 50) {
  // Iteración: D desconocido → estimar con Darcy
  // R = f * (1/D) * rho * v² / 2  ;  v = Q / A = 4Q/(πD²)
  // R = f * (1/D) * rho/2 * (4Q/πD²)² = f * 8*rho*Q²/(π²*D^5)
  // → D = (f * 8*rho*Q² / (π²*R))^(1/5)   (iteración en f)

  let D = 0.3; // estimación inicial
  let f = 0.02;
  for (let i = 0; i < maxIter; i++) {
    const Dnew = Math.pow(f * 8 * rho * Q * Q / (PI * PI * R_target), 0.2);
    const v    = Q / areaCirc(Dnew);
    const Re   = v * Dnew / nu;
    const eps_D = eps / Dnew;
    f = frictionFactor(Re, eps_D);
    if (Math.abs(Dnew - D) < 1e-6) { D = Dnew; break; }
    D = Dnew;
  }
  const v    = Q / areaCirc(D);
  const Re   = v * D / nu;
  const eps_D = eps / D;
  f = frictionFactor(Re, eps_D);
  const R_calc = f / D * rho * v * v / 2;
  return { D, v, Re, f, eps_D, R_calc, A: areaCirc(D) };
}

// ── CÁLCULO PRINCIPAL — CONDUCTO RECTANGULAR ──────────────────────────────────
/**
 * Dado Q [m³/s], rozamiento R [Pa/m] y relación de aspecto ar = a/b:
 * Calcula dimensiones a×b, velocidad, etc.
 */
export function sizeRectangular(Q, R_target, eps, ar = 2.0, rho = RHO_STD, nu = NU_STD) {
  // Usar diámetro equivalente para calcular dimensiones
  const circ = sizeCircular(Q, R_target, eps, rho, nu);
  const Deq  = circ.D;
  // Deq = 1.30 * (a*b)^0.625 / (a+b)^0.25  con a = ar*b
  // Despejar b por iteración numérica
  let b = Deq / 2;
  for (let i = 0; i < 60; i++) {
    const a    = ar * b;
    const Deq2 = deqRect(a, b);
    b *= Deq / Deq2;
    if (Math.abs(Deq2 - Deq) < 1e-5) break;
  }
  const a    = ar * b;
  const A    = areaRect(a, b);
  const v    = Q / A;
  const Dh   = dhRect(a, b);
  const Re   = v * Dh / nu;
  const eps_D = eps / Dh;
  const f    = frictionFactor(Re, eps_D);
  const R_calc = f / Dh * rho * v * v / 2;
  return { a, b, A, v, Dh, Deq, Re, f, eps_D, R_calc };
}

// ── CONDUCTO OVAL ─────────────────────────────────────────────────────────────
/**
 * Sección oval (dos semicírculos + dos rectas paralelas)
 * Parámetros: a = ancho mayor [m], b = alto menor [m]  (b ≤ a)
 * Relación: b es el diámetro de los semicírculos, (a-b) es la longitud recta
 *
 * Área:      A = π(b/2)² + (a-b)·b
 * Perímetro: P = π·b + 2(a-b)
 * Dh:        4A/P
 * Deq (igual rozamiento): Deq = 1.55·A^0.625 / P^0.25  (ASHRAE)
 */
export function areaOval(a, b)  { return Math.PI*(b/2)**2 + (a-b)*b; }
export function perimOval(a, b) { return Math.PI*b + 2*(a-b); }
export function dhOval(a, b)    { return 4*areaOval(a,b)/perimOval(a,b); }
export function deqOval(a, b)   {
  const A = areaOval(a,b), P = perimOval(a,b);
  return 1.55 * Math.pow(A, 0.625) / Math.pow(P, 0.25);
}

/**
 * Dimensionado de conducto oval dado Q, R_target y relación de aspecto ar = a/b
 * Itera sobre b para encontrar Deq que coincida con el circular equivalente
 */
export function sizeOval(Q, R_target, eps, ar = 2.0, rho = RHO_STD, nu = NU_STD) {
  if (ar < 1.25) ar = 1.25; // mínimo físico para oval real
  if (ar > 4.0)  ar = 4.0;  // máximo recomendado SMACNA
  const circ = sizeCircular(Q, R_target, eps, rho, nu);
  const Deq_obj = circ.D;

  // Iterar b: Deq(ar·b, b) = Deq_obj
  let b = Deq_obj / ar;
  for (let i = 0; i < 80; i++) {
    const a     = ar * b;
    const Deq_i = deqOval(a, b);
    b *= Deq_obj / Deq_i;
    if (Math.abs(Deq_i - Deq_obj) < 1e-6) break;
  }
  const a    = ar * b;
  const A    = areaOval(a, b);
  const P    = perimOval(a, b);
  const Dh   = dhOval(a, b);
  const Deq  = deqOval(a, b);
  const v    = Q / A;
  const Re   = v * Dh / nu;
  const eps_D = eps / Dh;
  const f    = frictionFactor(Re, eps_D);
  const R_calc = f / Dh * rho * v * v / 2;
  return { a, b, A, P, Dh, Deq, v, Re, f, eps_D, R_calc };
}

/**
 * Series comerciales de conductos ovales (SMACNA)
 * Formato: { a [mm], b_series [mm] }  — b es el alto menor (diámetro semicírculos)
 */
export const OVAL_SERIES = [
  { b:  150, a_series: [200, 250, 300, 400, 500, 600, 800, 1000] },
  { b:  200, a_series: [250, 300, 400, 500, 600, 800, 1000, 1200] },
  { b:  250, a_series: [300, 400, 500, 600, 800, 1000, 1200, 1500] },
  { b:  300, a_series: [400, 500, 600, 800, 1000, 1200, 1500] },
  { b:  400, a_series: [500, 600, 800, 1000, 1200, 1500, 2000] },
];

/** Normalizar oval a serie comercial más próxima */
export function normalizeOval(a, b) {
  // Buscar b comercial más cercano
  const bs = OVAL_SERIES.map(s => s.b/1000);
  const bNorm = bs.reduce((prev, curr) => Math.abs(curr - b) < Math.abs(prev - b) ? curr : prev);
  const entry = OVAL_SERIES.find(s => s.b/1000 === bNorm);
  const aNorm = entry
    ? (entry.a_series.map(x=>x/1000).find(x => x >= a) || entry.a_series[entry.a_series.length-1]/1000)
    : Math.ceil(a * 10) / 10;
  return { a: Math.max(aNorm, bNorm * 1.25), b: bNorm };
}

// ── CONDUCTO ESPIRAL CIRCULAR ─────────────────────────────────────────────────
/**
 * El conducto espiral circular es geométricamente idéntico al circular liso
 * pero con mayor rigidez y menor rugosidad efectiva que el rectangular.
 * La diferencia principal es:
 *   - Rugosidad típica: 0.05 mm (costura espiral lisa) vs 0.09 mm (galvanizado plano)
 *   - Series comerciales diferentes (paso 25–50 mm)
 *   - Factor de corrección de costura: fc ≈ 1.02–1.05 (ASHRAE 2017, Cap.21)
 *
 * Se calcula igual que circular pero con rugosidad y series propias.
 */
export const SPIRAL_SERIES_MM = [
  80, 100, 112, 125, 140, 150, 160, 180, 200, 224, 250, 280, 315,
  355, 400, 450, 500, 560, 630, 710, 800, 900, 1000, 1120, 1250
];

/** Factor de corrección de costura espiral (ASHRAE) */
export const SPIRAL_SEAM_FACTOR = 1.02;

export function sizeSpiral(Q, R_target, eps_spiral = 0.05e-3, rho = RHO_STD, nu = NU_STD) {
  // Igual que circular pero con R ajustado por factor de costura
  const R_adj = R_target / SPIRAL_SEAM_FACTOR;
  const res   = sizeCircular(Q, R_adj, eps_spiral, rho, nu);
  res.isSpiral = true;
  res.eps_spiral = eps_spiral;
  res.seamFactor = SPIRAL_SEAM_FACTOR;
  // R real con factor costura
  res.R_calc_spiral = res.R_calc * SPIRAL_SEAM_FACTOR;
  return res;
}

export function normalizeSpiral(D) {
  const series = SPIRAL_SERIES_MM.map(x => x / 1000);
  return series.find(d => d >= D) || series[series.length - 1];
}

// ── NORMALIZAR DIMENSIONES ────────────────────────────────────────────────────
/** Redondear a series comerciales (múltiplos de 50mm hasta 500, luego 100mm) */
export function normalizeRect(a, b) {
  const round = x => {
    if (x <= 0.5)  return Math.ceil(x * 20) / 20;   // cada 50mm
    return Math.ceil(x * 10) / 10;                    // cada 100mm
  };
  return { a: round(a), b: round(b) };
}

export function normalizeCirc(D) {
  const series = [0.08,0.10,0.12,0.125,0.14,0.15,0.16,0.18,0.20,0.224,0.25,
                  0.28,0.315,0.355,0.40,0.45,0.50,0.56,0.63,0.71,0.80,0.90,1.0];
  return series.find(d => d >= D) || D;
}

// ── SINGULARIDADES ────────────────────────────────────────────────────────────
export const FITTINGS = [
  { name: 'Codo 90° R/D=1.5',     zeta: 0.17 },
  { name: 'Codo 90° R/D=1.0',     zeta: 0.33 },
  { name: 'Codo 90° cuadrado',     zeta: 1.30 },
  { name: 'Codo 45°',             zeta: 0.09 },
  { name: 'Codo 30°',             zeta: 0.05 },
  { name: 'Te rama (impulsión)',   zeta: 1.00 },
  { name: 'Te paso (impulsión)',   zeta: 0.10 },
  { name: 'Transición expan. 15°',zeta: 0.05 },
  { name: 'Transición contrac.',   zeta: 0.10 },
  { name: 'Entrada brusca',        zeta: 0.50 },
  { name: 'Salida brusca',         zeta: 1.00 },
  { name: 'Rejilla impulsión',     zeta: 2.50 },
  { name: 'Rejilla retorno',       zeta: 1.50 },
  { name: 'Filtro plano (limpio)', zeta: 0.50 },
  { name: 'Filtro bolsas (limp.)', zeta: 0.80 },
  { name: 'Batería de calor',      zeta: 1.50 },
  { name: 'Amortiguador abierto',  zeta: 0.20 },
];

/** Pérdida de presión por singularidad: ΔP = ζ * rho * v² / 2 [Pa] */
export function fittingLoss(zeta, v, rho = RHO_STD) {
  return zeta * rho * v * v / 2;
}

// ── CÁLCULO TRAMO ─────────────────────────────────────────────────────────────
export function calcTramo(tramo, R_target, eps, rho, nu) {
  const { Q, L, tipo, ar, fittings } = tramo;
  let geom, Dref, vref;

  if (tipo === 'circular') {
    geom = sizeCircular(Q, R_target, eps, rho, nu);
    const Dnorm = normalizeCirc(geom.D);
    const vNorm = Q / areaCirc(Dnorm);
    const ReN   = vNorm * Dnorm / nu;
    const fN    = frictionFactor(ReN, eps / Dnorm);
    const RN    = fN / Dnorm * rho * vNorm * vNorm / 2;
    Dref = Dnorm; vref = vNorm;
    geom.Dnorm = Dnorm; geom.vNorm = vNorm; geom.ReNorm = ReN; geom.fNorm = fN; geom.RNorm = RN;
  } else {
    geom = sizeRectangular(Q, R_target, eps, ar || 2, rho, nu);
    const norm = normalizeRect(geom.a, geom.b);
    const AN   = areaRect(norm.a, norm.b);
    const vN   = Q / AN;
    const DhN  = dhRect(norm.a, norm.b);
    const ReN  = vN * DhN / nu;
    const fN   = frictionFactor(ReN, eps / DhN);
    const RN   = fN / DhN * rho * vN * vN / 2;
    Dref = DhN; vref = vN;
    geom.aNorm = norm.a; geom.bNorm = norm.b; geom.vNorm = vN;
    geom.DhNorm = DhN; geom.RNorm = RN; geom.fNorm = fN;
  }

  // Pérdidas
  const dPfric = (geom.RNorm || geom.R_calc) * L;
  const dPsing = (fittings || []).reduce((s, ft) => s + fittingLoss(ft.zeta, vref, rho), 0);
  const dPtotal = dPfric + dPsing;

  return { ...geom, dPfric, dPsing, dPtotal, L, Q, tipo };
}

// ── RED DE TRAMOS ─────────────────────────────────────────────────────────────
export function calcRed(tramos, R_target, eps, rho, nu) {
  const results = tramos.map(t => calcTramo(t, R_target, eps, rho, nu));
  const dPtotal = results.reduce((s, r) => s + r.dPtotal, 0);
  const dPmax   = Math.max(...results.map(r => r.dPtotal));
  return { tramos: results, dPtotal, dPmax };
}

// ── DIAGRAMA DE ABACO ─────────────────────────────────────────────────────────
/**
 * Genera puntos para líneas iso-caudal en el ábaco D vs R
 * Eje X: R [Pa/m] (log), Eje Y: D [m] (log)
 */
export function abacoLines(eps, rho, nu) {
  const Q_vals = [0.01,0.02,0.05,0.1,0.2,0.5,1,2,5,10,20]; // m³/s
  const R_range = [];
  for (let i = -1; i <= 1.5; i += 0.05) R_range.push(Math.pow(10, i));

  return Q_vals.map(Q => ({
    Q,
    label: Q >= 1 ? `${Q} m³/s` : `${(Q*1000).toFixed(0)} L/s`,
    pts: R_range.map(R => {
      const res = sizeCircular(Q, R, eps, rho, nu);
      return { R, D: res.D, v: res.v };
    })
  }));
}

/** Líneas iso-velocidad para el ábaco */
export function abacoIsoVel(eps, rho, nu) {
  const v_vals = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20];
  const R_range = [];
  for (let i = -1; i <= 1.5; i += 0.05) R_range.push(Math.pow(10, i));

  return v_vals.map(v => ({
    v,
    pts: R_range.map(R => {
      const res = sizeCircular(0.1, R, eps, rho, nu); // placeholder
      // Para iso-v: D = f*rho*v²/(2R) con f iterado
      let D = 0.2, f = 0.02;
      for (let i = 0; i < 20; i++) {
        const Re = v * D / nu;
        f = frictionFactor(Re, eps / D);
        const Dnew = Math.sqrt(f * rho * v * v / (2 * R));  // aprox
        if (Math.abs(Dnew - D) < 1e-5) { D = Dnew; break; }
        D = Dnew;
      }
      return { R, D: Math.max(D, 0.05) };
    })
  }));
}
