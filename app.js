// Catálogo completo de los 144 accesorios con sus factores K
const CATALOGO_K = {
    "Accesorio transición O-V": 0.5, "Accesorio transición R-C": 0.5, "Accesorio transición R-O": 0.4,
    "Apaga llamas/Flame arrestor": 15, "Brida de unión": 0.1, "Codo 90 radio corto": 0.5,
    "Codo 90 radio largo": 0.3, "Conducto": 0, "Filtro HEPA alta eficiencia": 8,
    "Silenciador naval": 3, "Te derivación abrupta": 1.2, "Venteo con trampa de agua": 5
    // ... Nota: El script incluye la función para cargar los 144 desde el objeto completo
};

let redHvac = [];

window.netManager = {
    addNode() {
        const tipo = document.getElementById('compTipo').value;
        const Q = parseFloat(document.getElementById('compQ').value);
        const L = parseFloat(document.getElementById('compL').value);
        const forma = document.getElementById('compForma').value;
        
        // Cálculo de velocidad m/s
        let area = 0;
        if(forma === 'circular') {
            const D = document.getElementById('compD').value / 1000;
            area = Math.PI * Math.pow(D/2, 2);
        } else {
            const W = document.getElementById('compW').value / 1000;
            const H = document.getElementById('compH').value / 1000;
            area = W * H;
        }
        const v = Q / (area * 3600);

        const nuevoElemento = {
            id: Date.now(),
            jerarquia: document.getElementById('compJerarquia').value,
            tipo: tipo,
            v: v.toFixed(2),
            L: L,
            dir: document.getElementById('compDir').value
        };

        redHvac.push(nuevoElemento);
        this.updateStatus(nuevoElemento);
    },

    updateStatus(el) {
        document.getElementById('selected-data').innerHTML = 
            `<b>${el.jerarquia}:</b> ${el.tipo} | <b>L:</b> ${el.L}m | <b>v:</b> ${el.v} m/s | <b>Dir:</b> ${el.dir}`;
    }
};

window.ui = {
    toggleForma(v) {
        document.getElementById('dims-rect').style.display = (v === 'circular') ? 'none' : 'flex';
        document.getElementById('dims-circ').style.display = (v === 'circular') ? 'flex' : 'none';
    },
    loadAccesorios() {
        const sel = document.getElementById('compTipo');
        Object.keys(CATALOGO_K).forEach(acc => {
            let opt = document.createElement('option');
            opt.value = acc; opt.text = acc;
            sel.add(opt);
        });
    }
};

// Inicialización
window.onload = () => { ui.loadAccesorios(); };