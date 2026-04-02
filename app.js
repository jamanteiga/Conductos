/**
 * HVAC NAVAL PRO - Core Engine & Supabase Integration
 * Project ID: ftavemcnvwiwupyqbsmv
 */

// --- CONFIGURACIÓN SUPABASE ---
const SUPABASE_URL = 'https://ftavemcnvwiwupyqbsmv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_mZb53is840WLLIsC2GfPSg_T9r1sz86';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- ESTADO GLOBAL ---
let proyecto = null;
let lineas = [];
let lineaActivaId = null;
let activeNodeId = null;

const CONFIG = {
    DENSIDAD_AIRE: 1.225,
    VISCOSIDAD: 1.5e-5,
    RUGOSIDAD: 0.15,
    ESPESOR_CHAPA: 1.5
};

// --- MOTOR 3D (THREE.JS + ORBIT CONTROLS) ---
export const visor3D = {
    scene: null, camera: null, renderer: null, controls: null,
    init() {
        const container = document.getElementById('container3d');
        if (!container) return;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x111111);
        this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
        this.camera.position.set(-10, -10, 10);
        this.camera.up.set(0, 0, 1); // Z es arriba (Eje Naval)
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(this.renderer.domElement);
        
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
        this.scene.add(new THREE.AxesHelper(5));
        this.animate();
    },
    animate() {
        requestAnimationFrame(() => this.animate());
        this.renderer.render(this.scene, this.camera);
    },
    resetCamera() { this.controls.reset(); },
    dibujarRed() {
        const linea = lineas.find(l => l.id === lineaActivaId);
        if (!linea) return;
        
        // Limpiar conductos previos
        const toDelete = this.scene.children.filter(c => c.isMesh);
        toDelete.forEach(m => this.scene.remove(m));

        let cursores = new Map();
        cursores.set(null, { pos: new THREE.Vector3(0, 0, 0) });

        linea.red.forEach(nodo => {
            const padre = cursores.get(nodo.parentId) || { pos: new THREE.Vector3(0,0,0) };
            const start = padre.pos.clone();
            const end = start.clone();
            const L = nodo.L || 0.1;

            if (nodo.dir === 'X') end.x += L;
            else if (nodo.dir === '-X') end.x -= L;
            else if (nodo.dir === 'Y') end.y += L;
            else if (nodo.dir === '-Y') end.y -= L;
            else if (nodo.dir === 'Z') end.z += L;
            else if (nodo.dir === '-Z') end.z -= L;

            const geometry = new THREE.BoxGeometry(
                Math.max(0.1, Math.abs(end.x - start.x) || nodo.ancho/1000),
                Math.max(0.1, Math.abs(end.y - start.y) || nodo.ancho/1000),
                Math.max(0.1, Math.abs(end.z - start.z) || nodo.alto/1000)
            );

            const material = new THREE.MeshStandardMaterial({
                color: nodo.esCritico ? 0xFF3B30 : (nodo.id === activeNodeId ? 0xFF9500 : 0x007AFF),
                transparent: true, 
                opacity: nodo.esCritico ? 1.0 : 0.6
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(start.clone().add(end).multiplyScalar(0.5));
            this.scene.add(mesh);
            cursores.set(nodo.id, { pos: end });
        });
    }
};

// --- GESTIÓN DE BASE DE DATOS (SUPABASE) ---
window.dbManager = {
    async guardarProyecto() {
        if (!proyecto) return alert("Crea un proyecto primero");
        
        const payload = {
            nombre_buque: proyecto.buque,
            num_construccion: proyecto.numConst,
            astillero: proyecto.astillero,
            cliente: proyecto.cliente,
            datos_hvac: { lineas: lineas }
        };

        const { error } = await supabaseClient
            .from('proyectos_hvac')
            .upsert(payload, { onConflict: 'nombre_buque' });

        if (error) {
            console.error(error);
            alert("Error al guardar: " + error.message);
        } else {
            alert("✅ Sincronizado en la nube (Supabase)");
        }
    }
};

// --- GESTIÓN DE PROYECTO Y LÍNEAS ---
window.proyectManager = {
    crearNuevo() {
        const buque = document.getElementById('p_buque').value;
        if (!buque) return alert("Nombre de buque obligatorio");
        
        proyecto = {
            buque,
            numConst: document.getElementById('p_num_const').value,
            astillero: document.getElementById('p_astillero').value,
            cliente: document.getElementById('p_cliente').value
        };
        
        document.getElementById('badge-buque').textContent = proyecto.buque;
        document.getElementById('modalProyecto').style.display = 'none';
    }
};

window.lineManager = {
    nuevaLinea() {
        const num = prompt("Número de línea (Rango 1000-9999):", "1000");
        if (!num) return;
        lineas.push({ id: Date.now(), numero: num, red: [] });
        this.render();
    },
    seleccionar(id) {
        lineaActivaId = id;
        const l = lineas.find(x => x.id === id);
        document.getElementById('active-line-name').textContent = `LÍNEA: ${l.numero}`;
        ui.showPage('red');
        netManager.render();
    },
    render() {
        const cont = document.getElementById('listaLineas');
        cont.innerHTML = lineas.map(l => `
            <div class="card" onclick="lineManager.seleccionar(${l.id})">
                <b>L-${l.numero}</b> <small>(${l.red.length} tramos)</small>
            </div>
        `).join('');
    }
};

// --- GESTIÓN DE RED (TAGS Y CÁLCULOS) ---
window.netManager = {
    addNode(tipo) {
        const linea = lineas.find(l => l.id === lineaActivaId);
        const padre = linea.red.find(n => n.id === activeNodeId);
        
        // Lógica de rangos de TAGS pedida: 01-09 Principal, 10-50 Ramal, 51-99 Derivación
        let rangoBase = 51; 
        if (tipo === 'principal') rangoBase = 1;
        else if (tipo === 'ramal') rangoBase = 10;

        const nuevo = {
            id: Date.now(),
            tipo,
            parentId: activeNodeId,
            bloque: padre ? padre.bloque : "B101",
            dir: 'X', ancho: 400, alto: 300, L: 2, caudal: 1500,
            esCritico: false
        };

        linea.red.push(nuevo);
        activeNodeId = nuevo.id;
        this.render();
    },

    updateNode() {
        const linea = lineas.find(l => l.id === lineaActivaId);
        const n = linea.red.find(x => x.id === activeNodeId);
        if (!n) return;

        n.bloque = document.getElementById('nodeBloque').value;
        n.dir = document.getElementById('nodeDir').value;
        n.ancho = parseInt(document.getElementById('nodeAncho').value);
        n.alto = parseInt(document.getElementById('nodeAlto').value);
        n.L = parseFloat(document.getElementById('nodeL').value);
        n.caudal = parseInt(document.getElementById('nodeCaudal').value);

        this.render();
    },

    select(id) {
        activeNodeId = id;
        const linea = lineas.find(l => l.id === lineaActivaId);
        const n = linea.red.find(x => x.id === id);
        
        document.getElementById('editPanel').style.display = 'block';
        document.getElementById('nodeBloque').value = n.bloque;
        document.getElementById('nodeAncho').value = n.ancho;
        document.getElementById('nodeAlto').value = n.alto;
        document.getElementById('nodeL').value = n.L;
        document.getElementById('nodeCaudal').value = n.caudal;
        
        this.render();
    },

    render() {
        const linea = lineas.find(l => l.id === lineaActivaId);
        const cont = document.getElementById('treeContainer');
        if (!linea) return;

        cont.innerHTML = linea.red.map((n, index) => {
            // Generación de TAG: Bloque-Sistema-Línea-Correlativo
            const correlativo = (index + 1).toString().padStart(2, '0');
            const tag = `${n.bloque}-5101-${linea.numero}-${correlativo}`;
            
            return `
                <div class="node-card ${n.id === activeNodeId ? 'active' : ''} ${n.esCritico ? 'critical' : ''}" onclick="netManager.select(${n.id})">
                    <div class="tag">${tag}</div>
                    <div class="desc">${n.tipo.toUpperCase()} | ${n.ancho}x${n.alto}</div>
                </div>
            `;
        }).join('');
        
        visor3D.dibujarRed();
        this.actualizarBOM();
    },

    analizarYOptimizar() {
        const linea = lineas.find(l => l.id === lineaActivaId);
        if (!linea) return;

        linea.red.forEach(n => n.esCritico = false);
        let maxP = 0, idCritico = null;

        linea.red.forEach(n => {
            const area = (n.ancho * n.alto) / 1000000;
            const vel = (n.caudal / 3600) / area;
            // Pérdida simplificada (Darcy-Weisbach aprox)
            const p = (0.02 * (n.L / (n.ancho/1000)) * (1.225 * vel * vel) / 2);
            if (p > maxP) { maxP = p; idCritico = n.id; }
        });

        if (idCritico) {
            let curr = idCritico;
            while(curr) {
                const node = linea.red.find(x => x.id === curr);
                if(node) node.esCritico = true;
                curr = node ? node.parentId : null;
            }
        }
        document.getElementById('resPresion').textContent = Math.ceil(maxP * 1.15);
        this.render();
    },

    actualizarBOM() {
        const linea = lineas.find(l => l.id === lineaActivaId);
        if (!linea) return;
        let m = 0, m2 = 0;
        linea.red.forEach(n => {
            m += n.L;
            m2 += ((n.ancho * 2 + n.alto * 2) / 1000) * n.L;
        });
        document.getElementById('resBOM').innerHTML = `
            <p>Metros Totales: <b>${m.toFixed(1)} m</b></p>
            <p>Chapa (1.5mm): <b>${m2.toFixed(1)} m²</b></p>
            <p>Peso Est.: <b>${(m2 * 1.5 * 7.85).toFixed(1)} kg</b></p>
        `;
    },

    exportarPorBloques() {
        const linea = lineas.find(l => l.id === lineaActivaId);
        const grupos = linea.red.reduce((acc, n) => { (acc[n.bloque] = acc[n.bloque] || []).push(n); return acc; }, {});
        
        Object.keys(grupos).forEach(b => {
            const contenido = grupos[b].map(n => `${n.tipo} | ${n.ancho}x${n.alto} | L:${n.L}m`).join('\n');
            const blob = new Blob([contenido], {type: 'text/plain'});
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `FAB_BLOQUE_${b}_LINEA_${linea.numero}.txt`;
            a.click();
        });
    }
};

// --- NAVEGACIÓN UI ---
window.ui = {
    showPage(id, btn) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-' + id).classList.add('active');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        if (id === 'visor') {
            setTimeout(() => {
                visor3D.renderer.setSize(document.getElementById('container3d').clientWidth, document.getElementById('container3d').clientHeight);
                visor3D.dibujarRed();
            }, 100);
        }
    }
};

window.onload = () => {
    visor3D.init();
};