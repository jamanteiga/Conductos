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
  { name: 'Aluminio',                    eps: 0.05e-3,   desc: 'ε = 0.05 mm · Conductos de aluminio liso'                    },
  { name: 'Acero comercial',             eps: 0.045e-3,  desc: 'ε = 0.045 mm · Acero negro laminado en frío'                 },
  { name: 'Acero corrugado',             eps: 3e-3,      desc: 'ε = 3 mm · Chapa ondulada, alta resistencia'                 },
  { name: 'Acero galvanizado',           eps: 0.15e-3,   desc: 'ε = 0.15 mm · Más común en HVAC, con uniones transversales'  },
  { name: 'Acero inoxidable',            eps: 0.05e-3,   desc: 'ε = 0.05 mm · Cocinas industriales, laboratorios'            },
  { name: 'Chapa negra',                 eps: 0.1e-3,    desc: 'ε = 0.1 mm · Acero sin galvanizar'                           },
  { name: 'Climaver Neto',               eps: 0.05e-3,   desc: 'ε = 0.05 mm · Panel de lana de vidrio (cara lisa)'           },
  { name: 'Climaver Plus R',             eps: 0.05e-3,   desc: 'ε = 0.05 mm · Panel lana de vidrio reforzado'                },
  { name: 'Climaver APTA',               eps: 0.05e-3,   desc: 'ε = 0.05 mm · Panel lana de vidrio alta temperatura'         },
  { name: 'Cobre liso',                  eps: 0.0015e-3, desc: 'ε = 0.0015 mm · Tuberías de cobre para ventilación'          },
  { name: 'Conducto flexible',           eps: 3e-3,      desc: 'ε = 3 mm · Flexible metálico / aluminio, tramos ≤ 1.5 m'     },
  { name: 'Conducto textil (poliéster)', eps: 0.2e-3,    desc: 'ε = 0.2 mm · Calcetín textil de distribución'                },
  { name: 'Espirometálico (acero)',      eps: 0.15e-3,   desc: 'ε = 0.15 mm · Tubo espiral de acero galvanizado'             },
  { name: 'Fibra de vidrio',             eps: 0.9e-3,    desc: 'ε = 0.9 mm · Con revestimiento interior de FV'               },
  { name: 'Hierro fundido',              eps: 0.5e-3,    desc: 'ε = 0.5 mm · Conductos enterrados o industriales'            },
  { name: 'Hormigón pulido',             eps: 2e-3,      desc: 'ε = 2 mm · Shafts de hormigón o conductos enterrados'        },
  { name: 'Lana mineral (FV)',           eps: 1.2e-3,    desc: 'ε = 1.2 mm · Lana de fibra de vidrio sin revestir'           },
  { name: 'Lana de vidrio desnuda',      eps: 1.2e-3,    desc: 'ε = 1.2 mm · Panel de lana de vidrio sin acabado'            },
  { name: 'Madera cepillada',            eps: 1e-3,      desc: 'ε = 1 mm · Conductos de madera para instalaciones especiales'},
  { name: 'Poliuretano (PIR/P3)',        eps: 0.08e-3,   desc: 'ε = 0.08 mm · Panel sandwich de poliuretano'                 },
  { name: 'PRFV',                        eps: 0.01e-3,   desc: 'ε = 0.01 mm · Plástico reforzado con fibra de vidrio'        },
  { name: 'PVC',                         eps: 0.0015e-3, desc: 'ε = 0.0015 mm · PVC liso, extracción laboratorios'           },
  { name: 'Tubo de lona (textil)',        eps: 0.3e-3,    desc: 'ε = 0.3 mm · Tubo flexible de lona o tejido técnico'         },
  { name: 'Personalizado',               eps: null,       desc: 'Introduce la rugosidad ε en mm'                              },
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
  let D = 0.3;
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
  const circ = sizeCircular(Q, R_target, eps, rho, nu);
  const Deq  = circ.D;
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
export function areaOval(a, b)  { return Math.PI*(b/2)**2 + (a-b)*b; }
export function perimOval(a, b) { return Math.PI*b + 2*(a-b); }
export function dhOval(a, b)    { return 4*areaOval(a,b)/perimOval(a,b); }
export function deqOval(a, b)   {
  const A = areaOval(a,b), P = perimOval(a,b);
  return 1.55 * Math.pow(A, 0.625) / Math.pow(P, 0.25);
}

export function sizeOval(Q, R_target, eps, ar = 2.0, rho = RHO_STD, nu = NU_STD) {
  if (ar < 1.25) ar = 1.25;
  if (ar > 4.0)  ar = 4.0;
  const circ = sizeCircular(Q, R_target, eps, rho, nu);
  const Deq_obj = circ.D;

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

export const OVAL_SERIES = [
  { b:  150, a_series: [200, 250, 300, 400, 500, 600, 800, 1000] },
  { b:  200, a_series: [250, 300, 400, 500, 600, 800, 1000, 1200] },
  { b:  250, a_series: [300, 400, 500, 600, 800, 1000, 1200, 1500] },
  { b:  300, a_series: [400, 500, 600, 800, 1000, 1200, 1500] },
  { b:  400, a_series: [500, 600, 800, 1000, 1200, 1500, 2000] },
];

export function normalizeOval(a, b) {
  const bs = OVAL_SERIES.map(s => s.b/1000);
  const bNorm = bs.reduce((prev, curr) => Math.abs(curr - b) < Math.abs(prev - b) ? curr : prev);
  const entry = OVAL_SERIES.find(s => s.b/1000 === bNorm);
  const aNorm = entry
    ? (entry.a_series.map(x=>x/1000).find(x => x >= a) || entry.a_series[entry.a_series.length-1]/1000)
    : Math.ceil(a * 10) / 10;
  return { a: Math.max(aNorm, bNorm * 1.25), b: bNorm };
}

// ── CONDUCTO ESPIRAL CIRCULAR ─────────────────────────────────────────────────
export const SPIRAL_SERIES_MM = [
  80, 100, 112, 125, 140, 150, 160, 180, 200, 224, 250, 280, 315,
  355, 400, 450, 500, 560, 630, 710, 800, 900, 1000, 1120, 1250
];

export const SPIRAL_SEAM_FACTOR = 1.02;

export function sizeSpiral(Q, R_target, eps_spiral = 0.05e-3, rho = RHO_STD, nu = NU_STD) {
  const R_adj = R_target / SPIRAL_SEAM_FACTOR;
  const res   = sizeCircular(Q, R_adj, eps_spiral, rho, nu);
  res.isSpiral = true;
  res.eps_spiral = eps_spiral;
  res.seamFactor = SPIRAL_SEAM_FACTOR;
  res.R_calc_spiral = res.R_calc * SPIRAL_SEAM_FACTOR;
  return res;
}

export function normalizeSpiral(D) {
  const series = SPIRAL_SERIES_MM.map(x => x / 1000);
  return series.find(d => d >= D) || series[series.length - 1];
}

// ── NORMALIZAR DIMENSIONES ────────────────────────────────────────────────────
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
  { name: 'Codo 90° R/D=1.5',      zeta: 0.17 },
  { name: 'Codo 90° R/D=1.0',      zeta: 0.33 },
  { name: 'Codo 90° cuadrado',      zeta: 1.30 },
  { name: 'Codo 45°',              zeta: 0.09 },
  { name: 'Codo 30°',              zeta: 0.05 },
  { name: 'Te rama (impulsión)',    zeta: 1.00 },
  { name: 'Te paso (impulsión)',    zeta: 0.10 },
  { name: 'Transición expan. 15°', zeta: 0.05 },
  { name: 'Transición contrac.',    zeta: 0.10 },
  { name: 'Entrada brusca',         zeta: 0.50 },
  { name: 'Salida brusca',          zeta: 1.00 },
  { name: 'Rejilla impulsión',      zeta: 2.50 },
  { name: 'Rejilla retorno',        zeta: 1.50 },
  { name: 'Filtro plano (limpio)',  zeta: 0.50 },
  { name: 'Filtro bolsas (limp.)', zeta: 0.80 },
  { name: 'Batería de calor',       zeta: 1.50 },
  { name: 'Amortiguador abierto',   zeta: 0.20 },
];

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

  const dPfric  = (geom.RNorm || geom.R_calc) * L;
  const dPsing  = (fittings || []).reduce((s, ft) => s + fittingLoss(ft.zeta, vref, rho), 0);
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
export function abacoLines(eps, rho, nu) {
  const Q_vals  = [0.01,0.02,0.05,0.1,0.2,0.5,1,2,5,10,20]; // m³/s
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

export function abacoIsoVel(eps, rho, nu) {
  const v_vals  = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20];
  const R_range = [];
  for (let i = -1; i <= 1.5; i += 0.05) R_range.push(Math.pow(10, i));

  return v_vals.map(v => ({
    v,
    pts: R_range.map(R => {
      let D = 0.2, f = 0.02;
      for (let i = 0; i < 20; i++) {
        const Re = v * D / nu;
        f = frictionFactor(Re, eps / D);
        const Dnew = Math.sqrt(f * rho * v * v / (2 * R));
        if (Math.abs(Dnew - D) < 1e-5) { D = Dnew; break; }
        D = Dnew;
      }
      return { R, D: Math.max(D, 0.05) };
    })
  }));
}