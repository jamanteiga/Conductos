const SUPABASE_URL = 'https://ftavemcnvwiwupyqbsmv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_mZb53is840WLLIsC2GfPSg_T9r1sz86';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let proyecto = null, lineas = [], lineaActivaId = null, activeNodeId = null;

const CATALOGO = [
    "Conducto Recto", "Accesorio transición O-V", "Accesorio transición R-C", 
    "Apaga llamas", "Brida de unión", "Codo 90 radio corto", "Codo 90 radio largo",
    "Compuerta estanca", "Fire damper abierto", "Silenciador naval", 
    "Te derivación abrupta", "Válvula antiexplosión", "Venteo trampa agua"
];

window.authManager = {
    role: null,
    login() {
        const pin = document.getElementById('inputPin').value;
        if (pin === "1201") this.role = 'admin';
        else if (pin === "0000") this.role = 'viewer';
        else return alert("PIN INCORRECTO");
        document.getElementById('modalPin').style.display = 'none';
        document.getElementById('modalProyecto').style.display = 'flex';
        dbManager.listarProyectos();
        netManager.cargarCatalogo();
    }
};

window.dbManager = {
    async listarProyectos() {
        const listaDiv = document.getElementById('listaProyectosNube');
        try {
            const { data, error } = await supabaseClient.from('proyectos_hvac').select('nombre_buque');
            if (error) throw error;
            listaDiv.innerHTML = data.length === 0 ? "No hay proyectos." : 
                data.map(p => `<div class="p-item" onclick="dbManager.cargar('${p.nombre_buque}')">🚢 ${p.nombre_buque}</div>`).join('');
        } catch (e) { listaDiv.innerHTML = "Error conexión Supabase."; }
    },
    async cargar(n) {
        const { data } = await supabaseClient.from('proyectos_hvac').select('*').eq('nombre_buque', n).single();
        proyecto = { buque: data.nombre_buque };
        lineas = data.datos_hvac.lineas || [];
        document.getElementById('badge-buque').textContent = n;
        document.getElementById('modalProyecto').style.display = 'none';
        lineManager.render();
    },
    async guardar() {
        if (!proyecto || authManager.role === 'viewer') return;
        const dot = document.getElementById('status-sync');
        dot.style.background = "#ff9500";
        const { error } = await supabaseClient.from('proyectos_hvac').upsert({ 
            nombre_buque: proyecto.buque, 
            datos_hvac: { lineas } 
        });
        dot.style.background = error ? "#ff3b30" : "#34c759";
    }
};

window.proyectManager = {
    crearNuevo() {
        const n = document.getElementById('p_buque').value;
        if (!n) return alert("Nombre de buque vacío");
        proyecto = { buque: n.toUpperCase() };
        lineas = [];
        document.getElementById('badge-buque').textContent = proyecto.buque;
        document.getElementById('modalProyecto').style.display = 'none';
        dbManager.guardar();
    }
};

window.lineManager = {
    nuevaLinea() {
        const b = document.getElementById('l_bloque').value;
        const n = document.getElementById('l_numero').value;
        const s = document.getElementById('l_servicio').value;
        if(!b || !n) return alert("Bloque y Nº Línea requeridos");
        
        lineas.push({ id: Date.now(), bloque: b, numero: n, servicio: s, red: [] });
        this.render();
        dbManager.guardar();
    },
    render() {
        document.getElementById('listaLineas').innerHTML = lineas.map(l => `
            <div class="card" onclick="lineManager.select(${l.id})">
                <b>BLOQUE ${l.bloque}</b> - L${l.numero} <br>
                <small>${l.servicio} | ${l.red.length} piezas</small>
            </div>`).join('');
    },
    select(id) { lineaActivaId = id; ui.showPage('red'); netManager.render(); }
};

window.netManager = {
    cargarCatalogo() {
        const sel = document.getElementById('nodeTipoPieza');
        sel.innerHTML = CATALOGO.map(a => `<option value="${a}">${a}</option>`).join('');
    },
    addNode(tipo) {
        const l = lineas.find(l => l.id === lineaActivaId);
        if(!l) return alert("Selecciona una línea");
        const n = { id: Date.now(), tipoPieza: tipo, dir: 'X', ancho: 400, alto: 300, L: 1.0, caudal: 1200 };
        l.red.push(n);
        this.select(n.id);
        dbManager.guardar();
    },
    updateNode() {
        const l = lineas.find(l => l.id === lineaActivaId);
        const n = l.red.find(x => x.id === activeNodeId);
        n.tipoPieza = document.getElementById('nodeTipoPieza').value;
        n.dir = document.getElementById('nodeDir').value;
        n.ancho = parseFloat(document.getElementById('nodeAncho').value) || 100;
        n.alto = parseFloat(document.getElementById('nodeAlto').value) || 100;
        n.L = parseFloat(document.getElementById('nodeL').value) || 0.1;
        n.caudal = parseFloat(document.getElementById('nodeCaudal').value) || 0;
        
        const area = (n.ancho/1000) * (n.alto/1000);
        const v = (n.caudal/3600) / area;
        document.getElementById('liveVel').textContent = v.toFixed(2);
        document.getElementById('liveWeight').textContent = ((n.ancho+n.alto)*2/1000 * n.L * 7.85).toFixed(1);
        
        this.render();
        dbManager.guardar();
    },
    select(id) {
        activeNodeId = id;
        const l = lineas.find(l => l.id === lineaActivaId);
        const n = l.red.find(x => x.id === id);
        document.getElementById('editPanel').style.display = 'block';
        document.getElementById('nodeTipoPieza').value = n.tipoPieza;
        document.getElementById('nodeAncho').value = n.ancho;
        document.getElementById('nodeAlto').value = n.alto;
        document.getElementById('nodeL').value = n.L;
        document.getElementById('nodeCaudal').value = n.caudal;
        document.getElementById('nodeDir').value = n.dir;
        this.render();
    },
    render() {
        const l = lineas.find(l => l.id === lineaActivaId);
        if(!l) return;
        document.getElementById('treeContainer').innerHTML = l.red.map((n, i) => `
            <div class="node-card ${n.id === activeNodeId ? 'active' : ''}" onclick="netManager.select(${n.id})">
                T${i+1}: ${n.tipoPieza} (${n.dir})
            </div>`).join('');
    },
    deleteNode() {
        const l = lineas.find(l => l.id === lineaActivaId);
        l.red = l.red.filter(n => n.id !== activeNodeId);
        activeNodeId = null;
        document.getElementById('editPanel').style.display = 'none';
        this.render(); dbManager.guardar();
    },
    optimizarSeccion() {
        const l = lineas.find(l => l.id === lineaActivaId);
        const n = l.red.find(x => x.id === activeNodeId);
        const areaNecesaria = (n.caudal/3600) / 7.5; // Apuntamos a 7.5 m/s
        n.alto = 300; // Fijamos un alto estándar
        n.ancho = Math.ceil((areaNecesaria / (n.alto/1000)) * 1000 / 50) * 50;
        if(n.ancho / n.alto > 4) n.ancho = n.alto * 4;
        this.select(n.id); this.updateNode();
    }
};

export const visor3D = {
    scene: null, camera: null, renderer: null, controls: null,
    init() {
        const container = document.getElementById('container3d');
        if (this.renderer) return;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050505);
        this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
        this.camera.position.set(5, 5, 5);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(this.renderer.domElement);
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        const sun = new THREE.DirectionalLight(0xffffff, 1.5);
        sun.position.set(10, 20, 10);
        this.scene.add(sun);
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.3));
        this.animate();
    },
    animate() {
        requestAnimationFrame(() => this.animate());
        if(this.renderer) this.renderer.render(this.scene, this.camera);
    },
    dibujar() {
        if(!this.scene) return;
        this.scene.children.filter(c => c.isMesh).forEach(m => this.scene.remove(m));
        const l = lineas.find(l => l.id === lineaActivaId);
        if(!l) return;
        let cursor = new THREE.Vector3(0,0,0);
        l.red.forEach(n => {
            const geo = new THREE.BoxGeometry(n.ancho/1000, n.alto/1000, n.L);
            const mat = new THREE.MeshStandardMaterial({ color: n.id === activeNodeId ? 0xff9500 : 0x007aff });
            const mesh = new THREE.Mesh(geo, mat);
            const dir = new THREE.Vector3(n.dir==='X'?1:n.dir==='-X'?-1:0, n.dir==='Z'?1:n.dir==='-Z'?-1:0, n.dir==='Y'?1:n.dir==='-Y'?-1:0);
            mesh.position.copy(cursor.clone().add(dir.clone().multiplyScalar(n.L/2)));
            if(n.dir.includes('X')) mesh.rotation.y = Math.PI/2;
            if(n.dir.includes('Y')) mesh.rotation.x = Math.PI/2;
            this.scene.add(mesh);
            cursor.add(dir.multiplyScalar(n.L));
        });
    }
};

window.ui = {
    showPage(id) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-'+id).classList.add('active');
        if(id === 'visor') { setTimeout(() => { visor3D.init(); visor3D.dibujar(); }, 150); }
    }
};