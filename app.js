const SUPABASE_URL = 'https://ftavemcnvwiwupyqbsmv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_mZb53is840WLLIsC2GfPSg_T9r1sz86';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let proyecto = null, lineas = [], lineaActivaId = null;

// CATÁLOGO DE 114 ACCESORIOS CON COEFICIENTES K (Extracto representativo)
const CATALOGO_K = {
    "Conducto Recto": 0.02, "Codo 90º R/D=1.5": 0.25, "Codo 90º R/D=1.0": 0.45,
    "Codo 45º R/D=1.5": 0.15, "Te Derivación 90º": 1.20, "Te Confluencia 90º": 0.80,
    "Transición Rect/Circ": 0.30, "Reducción concéntrica": 0.10, "Difusor de Techo": 2.50,
    "Rejilla de Retorno": 1.80, "Compuerta de Regulación": 0.50, "Silenciador 1m": 0.90,
    "Venteo Estanco": 4.50, "Filtro G4": 1.20, "Filtro HEPA": 6.50, "UTA Naval": 12.0
    // Aquí se completan los 114 elementos del Excel
};

// GESTIÓN DE IDIOMAS Y DIRECCIONES NAVALES
window.i18n = {
    current: 'es',
    change(lang) { this.current = lang; this.updateUI(); },
    updateUI() {
        const d = this.current === 'es' ? 
            ["PROA (+X)", "POPA (-X)", "BABOR (+Y)", "ESTRIBOR (-Y)", "ARRIBA (+Z)", "ABAJO (-Z)"] :
            ["BOW (+X)", "STERN (-X)", "PORT (+Y)", "STARBOARD (-Y)", "UP (+Z)", "DOWN (-Z)"];
        const codes = ["X", "-X", "Y", "-Y", "Z", "-Z"];
        document.getElementById('compDir').innerHTML = codes.map((c, i) => `<option value="${c}">${d[i]}</option>`).join('');
    }
};

window.ui = {
    showPage(id) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-'+id).classList.add('active');
        if(id === 'visor') { setTimeout(() => { visor3D.init(); visor3D.dibujar(); }, 100); }
    },
    toggleForma(v) {
        document.getElementById('dims-rectangular').style.display = (v === 'circular') ? 'none' : 'grid';
        document.getElementById('dims-circular').style.display = (v === 'circular') ? 'block' : 'none';
    },
    fillAccesorios() {
        const sel = document.getElementById('compTipo');
        sel.innerHTML = Object.entries(CATALOGO_K).map(([name, k]) => 
            `<option value="${name}">${name} (K=${k})</option>`).join('');
    }
};

window.netManager = {
    async addNode() {
        const l = lineas.find(line => line.id === lineaActivaId);
        if(!l) return alert("ERROR: Seleccione una línea activa.");

        const forma = document.getElementById('compForma').value;
        const nodo = {
            id: Date.now(),
            forma: forma,
            tipo: document.getElementById('compTipo').value,
            k: CATALOGO_K[document.getElementById('compTipo').value],
            L: parseFloat(document.getElementById('compL').value) || 0, // mm
            dir: document.getElementById('compDir').value,
            jerarquia: document.getElementById('compJerarquia').value,
            ancho: (forma !== 'circular') ? parseFloat(document.getElementById('compAncho').value) : parseFloat(document.getElementById('compDiametro').value),
            alto: (forma !== 'circular') ? parseFloat(document.getElementById('compAlto').value) : parseFloat(document.getElementById('compDiametro').value),
            Q: parseFloat(document.getElementById('compQ').value) || 0
        };

        l.red.push(nodo);
        this.render();
        await dbManager.guardar(); // Autoguardado tras añadir
    },
    render() {
        const l = lineas.find(line => line.id === lineaActivaId);
        document.getElementById('treeContainer').innerHTML = l.red.map(n => `
            <div class="win-tree-item">
                <b>[${n.jerarquia}] ${n.tipo}</b> | L:${n.L}mm | K:${n.k} | Dir:${n.dir}
            </div>`).join('');
    }
};

window.dbManager = {
    async guardar() {
        if (!proyecto) return;
        document.getElementById('status-sync').style.background = "#ffb900";
        const { error } = await supabaseClient.from('proyectos_hvac').upsert({ 
            nombre_buque: proyecto.buque, 
            datos_hvac: { lineas } 
        });
        document.getElementById('status-sync').style.background = error ? "#d13438" : "#28a745";
    },
    async cargar(n) {
        const { data } = await supabaseClient.from('proyectos_hvac').select('*').eq('nombre_buque', n).single();
        proyecto = { buque: data.nombre_buque };
        lineas = data.datos_hvac.lineas || [];
        document.getElementById('badge-buque').textContent = n;
        document.getElementById('modalProyecto').style.display = 'none';
        lineManager.render();
    }
};

export const visor3D = {
    scene: null, camera: null, renderer: null, controls: null,
    init() {
        const container = document.getElementById('container3d');
        if (this.renderer) return;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xeeeeee);
        this.camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 10, 100000);
        this.camera.position.set(5000, 5000, 5000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(this.renderer.domElement);
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.scene.add(new THREE.AmbientLight(0xffffff, 1));
        this.animate();
        this.setupExport();
    },
    setupExport() {
        const div = document.createElement('div');
        div.className = "export-menu";
        div.style = "position:absolute; bottom:80px; right:20px; display:flex; gap:5px;";
        ['STL', 'STEP', 'JSON'].forEach(ext => {
            const btn = document.createElement('button');
            btn.innerText = "Export " + ext;
            btn.className = "win-btn-primary";
            btn.onclick = () => this.download(ext);
            div.appendChild(btn);
        });
        document.getElementById('container3d').appendChild(div);
    },
    animate() { requestAnimationFrame(() => this.animate()); if(this.controls) this.controls.update(); if(this.renderer) this.renderer.render(this.scene, this.camera); },
    dibujar() {
        this.scene.children.filter(c => c.isMesh).forEach(m => this.scene.remove(m));
        const l = lineas.find(line => line.id === lineaActivaId);
        if(!l) return;
        let cursor = new THREE.Vector3(0,0,0);
        l.red.forEach(n => {
            const geo = (n.forma === 'circular') ? new THREE.CylinderGeometry(n.ancho/2, n.ancho/2, n.L, 20) : new THREE.BoxGeometry(n.ancho, n.alto, n.L);
            const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x0078d4 }));
            const dirVec = new THREE.Vector3(n.dir==='X'?1:n.dir==='-X'?-1:0, n.dir==='Z'?1:n.dir==='-Z'?-1:0, n.dir==='Y'?1:n.dir==='-Y'?-1:0);
            mesh.position.copy(cursor.clone().add(dirVec.clone().multiplyScalar(n.L/2)));
            if(n.dir.includes('X')) mesh.rotation.z = Math.PI/2;
            if(n.dir.includes('Y')) mesh.rotation.x = Math.PI/2;
            this.scene.add(mesh);
            cursor.add(dirVec.multiplyScalar(n.L));
        });
    },
    download(ext) {
        const blob = new Blob([JSON.stringify(lineas)], {type: 'text/plain'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `export.${ext.toLowerCase()}`;
        a.click();
    }
};

window.authManager = { login() { document.getElementById('modalPin').style.display='none'; document.getElementById('modalProyecto').style.display='flex'; dbManager.listarProyectos(); ui.fillAccesorios(); i18n.updateUI(); }};
window.proyectManager = { crearNuevo() { const n = document.getElementById('p_buque').value; if(!n) return; proyecto = {buque: n.toUpperCase()}; lineas = []; dbManager.guardar(); document.getElementById('modalProyecto').style.display='none'; }};
window.lineManager = { 
    nuevaLinea() { lineas.push({id: Date.now(), numero: document.getElementById('l_numero').value, servicio: document.getElementById('l_servicio').value, red: []}); this.render(); dbManager.guardar(); },
    render() { document.getElementById('listaLineas').innerHTML = lineas.map(l => `<div class="win-card-linea" onclick="lineManager.select(${l.id})"><b>L-${l.numero}</b> - ${l.servicio}</div>`).join(''); },
    select(id) { lineaActivaId = id; ui.showPage('red'); netManager.render(); }
};