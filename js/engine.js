export const FITTINGS = [
    { name: "Accesorio transición O-V", zeta: 0.5 },
    { name: "Apaga llamas", zeta: 15 },
    { name: "Codo 90 radio corto", zeta: 0.5 },
    { name: "Codo 90 radio largo", zeta: 0.3 },
    { name: "Compuerta estanca militar", zeta: 4 },
    { name: "Filtro HEPA alta eficiencia", zeta: 8 },
    { name: "Filtro ULPA", zeta: 12 },
    { name: "Rejilla antideflagrante", zeta: 8 },
    { name: "Silenciador naval", zeta: 3 },
    { name: "Válvula de globo", zeta: 10 },
    { name: "Venteo con válvula flotador", zeta: 8 },
    { name: "Te derivación abrupta", zeta: 1.2 },
    { name: "Plenum con difusor interno", zeta: 0.6 },
    // ... añadir aquí el resto de la lista de la imagen
].sort((a,b) => a.name.localeCompare(b.name));

export function frictionFactor(Re, rr) {
    if (Re < 2300) return 64 / Re;
    let f = 0.02;
    for (let i = 0; i < 10; i++) {
        f = 1 / Math.pow(-2 * Math.log10(rr / 3.7 + 2.51 / (Re * Math.sqrt(f))), 2);
    }
    return f;
}
// Las demás funciones de cálculo (sizeCircular, etc) se mantienen iguales