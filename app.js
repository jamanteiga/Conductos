const SUPABASE_URL = 'https://ftavemcnvwiwupyqbsmv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_mZb53is840WLLIsC2GfPSg_T9r1sz86';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let proyecto = null, lineas = [], lineaActivaId = null;
let datosProyecto = { hull: "", armador: "", astillero: "", clase: "", norma: "" };

const CATALOGO_144 = {
    "CONDUCTOS": { "Tramo Recto": 0.02, "Reducción": 0.15, "Transición R-C": 0.3 },
    "CODOS": { "Codo 90º R/D=1.5": 0.25, "Codo 45º": 0.18, "Codo Rectangular": 0.55 },
    "TES / DERIVACIONES": { "Te 90º": 1.2, "Te con Zapata": 0.45, "Pantalón": 0.65 },
    "EQUIPOS NAVALES": { "UTA": 15, "Ventilador": 2, "Silenciador": 0.9, "Filtro HEPA": 6.5 },
    "TERMINALES": { "Difusor": 2.5, "Rejilla": 1.8, "Venteo": 5.0, "Cuello Cisne": 3.5 }
};

window.i18n = {
    current: 'es',
    change(l) { this.current = l; this.updateUI(); },
    updateUI() {
        const d = ["PROA (+X)", "POPA (-X)", "BABOR (+Y)", "ESTRIBOR (-Y)", "ARRIBA (+Z)", "ABAJO (-Z)"];
        const codes = ["X", "-X", "Y", "-Y", "Z", "-Z"];
        document.getElementById('compDir').innerHTML = codes.map((c, i) => `<option value="${c}">${d[i]}</option>`).join('');
    }
};

window.ui = {
    showPage(id) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-'+id).classList.add('active');
        if(id === 'visor') { setTimeout(() => visor3D.init(), 100); }
        if(id === 'proyecto') this.fillInfo();
    },
    fillInfo() {
        document.getElementById('info-buque').value = proyecto.buque;
        document.getElementById('info-hull').value = datosProyecto.hull;
        document.getElementById('info-armador').value = datosProyecto.armador;
    },
    toggleForma(v) {
        document.getElementById('dims-rectangular').style.display = (v === 'circular') ? 'none' : 'grid';
        document.getElementById('dims-circular').style.display = (v === 'circular') ? 'block' : 'none';
    },
    fillAccesorios() {
        const g = document.getElementById('compGrupo').value;
        document.getElementById('compTipo').innerHTML = Object.entries(CATALOGO_144[g]).map(([n, k]) => `<option value="${n}" data-k="${k}">${n} (K=${k})</option>`).join('');
    }
};

window.netManager = {
    addNode() {
        const l = lineas.find(line => line.id === lineaActivaId);
        if(!l) return alert("Selecciona línea");

        const forma = document.getElementById('compForma').value;
        const Q = parseFloat(document.getElementById('compQ').value);
        let area = 0, W = 0, H = 0, D = 0;

        if(forma === 'circular') {
            D = parseFloat(document.getElementById('compDiametro').value);
            area = Math.PI * Math.pow((D/2000), 2);
            W = D; H = D;
        } else {
            W = parseFloat(document.getElementById('compAncho').value);
            H = parseFloat(document.getElementById('compAlto').value);
            area = (W/1000) * (H/1000);
        }

        const v = area > 0 ? (Q / (area * 3600)) : 0;

        l.red.push({
            id: Date.now(), forma, tipo: document.getElementById('compTipo').value,
            jerarquia: document.getElementById('compJerarquia').value,
            L: parseFloat(document.getElementById('compL').value),
            Q, W, H, D, v: v.toFixed(2), dir: document.getElementById('compDir').value
        });
        this.render();
        visor2D.dibujar();
    },
    render() {
        const l = lineas.find(line => line.id === lineaActivaId);
        document.getElementById('treeContainer').innerHTML = l.red.map(n => `
            <div class="win-tree-item">
                <div style="flex:1"><b>${n.tipo}</b> <br> <small>${n.L}mm | ${n.v} m/s</small></div>
                <button onclick="netManager.removeNode(${n.id})">🗑</button>
            </div>`).join('');
    },
    removeNode(id) {
        const l = lineas.find(line => line.id === lineaActivaId);
        l.red = l.red.filter(n => n.id !== id);
        this.render(); visor2D.dibujar();
    }
};

window.visor2D = {
    dibujar() {
        const l = lineas.find(line => line.id === lineaActivaId);
        if(!l) return;
        let svg = `<svg width="100%" height="100%" viewBox="-500 -500 4000 4000">`;
        let x = 0, y = 0;
        l.red.forEach(n => {
            svg += `<rect x="${x}" y="${y - (n.W/4)}" width="${n.L}" height="${n.W/2}" fill="none" stroke="blue" stroke-width="4"/>`;
            svg += `<text x="${x+10}" y="${y+5}" font-size="30">${n.tipo} (v:${n.v})</text>`;
            if(n.dir === 'X') x += n.L; else if(n.dir === 'Y') y += n.L; // Simplificado para el ejemplo
        });
        svg += `</svg>`;
        document.getElementById('canvas2D').innerHTML = svg;
    }
};

window.dbManager = {
    async guardar() {
        datosProyecto = { hull: document.getElementById('info-hull').value, armador: document.getElementById('info-armador').value };
        const { error } = await supabaseClient.from('proyectos_hvac').upsert({ nombre_buque: proyecto.buque, datos_hvac: { lineas, datosProyecto } });
        alert(error ? "Error" : "Guardado OK");
    }
};

window.authManager = { login() { 
    document.getElementById('modalPin').style.display='none'; 
    document.getElementById('modalProyecto').style.display='flex';
    i18n.updateUI();
    document.getElementById('compGrupo').innerHTML = Object.keys(CATALOGO_144).map(g => `<option value="${g}">${g}</option>`).join('');
    document.getElementById('compJerarquia').innerHTML = ["Principal", "Ramal", "Derivación"].map(j => `<option value="${j}">${j}</option>`).join('');
    ui.fillAccesorios();
}};

window.proyectManager = { crearNuevo() {
    proyecto = { buque: document.getElementById('p_buque').value.toUpperCase() };
    document.getElementById('badge-buque').innerText = proyecto.buque;
    document.getElementById('modalProyecto').style.display='none';
}};

window.lineManager = {
    nuevaLinea() {
        lineas.push({ id: Date.now(), bloque: document.getElementById('l_bloque').value, numero: document.getElementById('l_numero').value, servicio: document.getElementById('l_servicio').value, red: [] });
        this.render();
    },
    render() {
        document.getElementById('listaLineas').innerHTML = lineas.map(l => `<div class="win-card-linea" onclick="lineManager.select(${l.id})"><b>B:${l.bloque}</b> | ${l.numero}</div>`).join('');
    },
    select(id) { lineaActivaId = id; ui.showPage('red'); netManager.render(); visor2D.dibujar(); }
};