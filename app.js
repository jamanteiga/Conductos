const SUPABASE_URL = 'https://ftavemcnvwiwupyqbsmv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_mZb53is840WLLIsC2GfPSg_T9r1sz86';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let proyecto = null, lineas = [], lineaActivaId = null, activeNodeId = null;

const CONFIG = {
    DENSIDAD_AIRE: 1.225,
    VISCOSIDAD_CIN: 1.51e-5,
    RUGOSIDAD_ABS: 0.00015
};

const fluidEngine = {
    getDh(n) {
        const a = n.ancho / 1000, b = n.alto / 1000;
        if (n.forma === 'circular') return a;
        if (n.forma === 'oval') {
            const area = (Math.PI * Math.pow(b, 2) / 4) + (b * (a - b));
            const perim = (Math.PI * b) + 2 * (a - b);
            return (4 * area) / perim;
        }
        return (2 * a * b) / (a + b);
    },
    getArea(n) {
        const a = n.ancho / 1000, b = n.alto / 1000;
        if (n.forma === 'circular') return (Math.PI * Math.pow(a, 2)) / 4;
        if (n.forma === 'oval') return (Math.PI * Math.pow(b, 2) / 4) + (b * (a - b));
        return a * b;
    },
    getFactorFriccion(v, Dh) {
        const Re = (v * Dh) / CONFIG.VISCOSIDAD_CIN;
        if (Re < 2300) return 64 / Re;
        const term = Math.pow((CONFIG.RUGOSIDAD_ABS / Dh) / 3.7, 1.11) + (6.9 / Re);
        return Math.pow(-1.8 * Math.log10(term), -2);
    }
};

export const visor3D = {
    scene: null, camera: null, renderer: null, controls: null,
    init() {
        const container = document.getElementById('container3d');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, container.clientWidth/container.clientHeight, 0.1, 1000);
        this.camera.position.set(5, 5, 5);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(this.renderer.domElement);
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.scene.add(new THREE.AmbientLight(0xffffff, 1));
        this.animate();
    },
    animate() { requestAnimationFrame(() => this.animate()); this.renderer.render(this.scene, this.camera); },
    dibujarRed() {
        const linea = lineas.find(l => l.id === lineaActivaId);
        if (!linea) return;
        this.scene.children.filter(c => c.isMesh).forEach(m => this.scene.remove(m));
        let pos = new THREE.Vector3(0,0,0);
        linea.red.forEach(n => {
            const geo = n.forma === 'circular' ? new THREE.CylinderGeometry(n.ancho/2000, n.ancho/2000, n.L) : new THREE.BoxGeometry(n.ancho/1000, n.alto/1000, n.L);
            const mat = new THREE.MeshStandardMaterial({ color: n.esCritico ? 0xff0000 : 0x007aff });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(pos.x, pos.y, pos.z + n.L/2);
            this.scene.add(mesh);
            pos.z += n.L;
        });
    }
};

window.netManager = {
    addNode(tipo) {
        const linea = lineas.find(l => l.id === lineaActivaId);
        const nuevo = { id: Date.now(), tipo, forma: 'rectangular', ancho: 400, alto: 300, L: 2, caudal: 1000, bloque: 'B101', dir: 'X' };
        linea.red.push(nuevo);
        activeNodeId = nuevo.id;
        this.render();
    },
    updateNode() {
        const n = lineas.find(l => l.id === lineaActivaId).red.find(x => x.id === activeNodeId);
        n.forma = document.getElementById('nodeForma').value;
        n.ancho = parseInt(document.getElementById('nodeAncho').value);
        n.alto = parseInt(document.getElementById('nodeAlto').value);
        n.L = parseFloat(document.getElementById('nodeL').value);
        n.caudal = parseInt(document.getElementById('nodeCaudal').value);
        this.render();
    },
    render() {
        const linea = lineas.find(l => l.id === lineaActivaId);
        document.getElementById('treeContainer').innerHTML = linea.red.map(n => {
            const area = fluidEngine.getArea(n);
            const vel = (n.caudal / 3600) / area;
            n.vReal = vel;
            return `<div class="node-card ${n.id===activeNodeId?'active':''}" onclick="netManager.select(${n.id})">
                <b>${n.forma.toUpperCase()}</b> | V: ${vel.toFixed(1)} m/s
            </div>`;
        }).join('');
        visor3D.dibujarRed();
    },
    select(id) {
        activeNodeId = id;
        const n = lineas.find(l => l.id === lineaActivaId).red.find(x => x.id === id);
        document.getElementById('editPanel').style.display = 'block';
        document.getElementById('nodeForma').value = n.forma;
        document.getElementById('nodeAncho').value = n.ancho;
        document.getElementById('nodeAlto').value = n.alto;
        this.render();
    },
    analizarYOptimizar() {
        const linea = lineas.find(l => l.id === lineaActivaId);
        let pt = 0;
        linea.red.forEach(n => {
            const Dh = fluidEngine.getDh(n);
            const f = fluidEngine.getFactorFriccion(n.vReal, Dh);
            const dp = f * (n.L/Dh) * (1.225 * n.vReal * n.vReal / 2);
            pt += dp;
        });
        document.getElementById('resPresion').textContent = Math.ceil(pt * 1.2);
    }
};

window.dbManager = {
    async guardarProyecto() {
        await supabaseClient.from('proyectos_hvac').upsert({ nombre_buque: proyecto.buque, datos_hvac: { lineas } });
        alert("Sincronizado");
    }
};

window.proyectManager = {
    crearNuevo() {
        proyecto = { buque: document.getElementById('p_buque').value };
        document.getElementById('modalProyecto').style.display = 'none';
    }
};

window.lineManager = {
    nuevaLinea() {
        lineas.push({ id: Date.now(), numero: "1000", red: [] });
        this.render();
    },
    seleccionar(id) { lineaActivaId = id; ui.showPage('red'); this.render(); },
    render() {
        document.getElementById('listaLineas').innerHTML = lineas.map(l => `<div class="card" onclick="lineManager.seleccionar(${l.id})">L-${l.numero}</div>`).join('');
    }
};

window.ui = {
    showPage(id) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-' + id).classList.add('active');
    }
};

window.onload = () => visor3D.init();