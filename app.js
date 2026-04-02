/**
 * HVAC Naval Designer PRO
 * Cliente: jamanteiga's Project
 * Configuración: mm / Auto-Save / Hybrid Touch-Mouse
 */

const SUPABASE_URL = 'https://ftavemcnvwiwupyqbsmv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_mZb53is840WLLIsC2GfPSg_T9r1sz86';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let proyecto = null;
let lineas = [];
let lineaActivaId = null;
let activeNodeId = null;

const CATALOGO = {
    "Conductos": ["Conducto Recto", "Codo 90°", "Codo 45°", "Te", "Giro en S"],
    "Equipos": ["UTA", "Ventilador Centrifugo", "Silenciador", "Filtro"],
    "Terminales": ["Difusor", "Rejilla", "Venteo", "Terminal de Techo"]
};

// --- NAVEGACIÓN Y UI ---
window.ui = {
    showPage(id) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-'+id).classList.add('active');
        if(id === 'visor') { 
            setTimeout(() => { visor3D.init(); visor3D.dibujar(); }, 100); 
        }
    },
    toggleForma(forma) {
        document.getElementById('dims-rectangular').style.display = forma === 'circular' ? 'none' : 'grid';
        document.getElementById('dims-circular').style.display = forma === 'circular' ? 'block' : 'none';
    },
    updateSelectors() {
        const dirs = ["PROA (+X)", "POPA (-X)", "BABOR (+Y)", "ESTRIBOR (-Y)", "ARRIBA (+Z)", "ABAJO (-Z)"];
        const codes = ["X", "-X", "Y", "-Y", "Z", "-Z"];
        document.getElementById('compDir').innerHTML = codes.map((v, i) => `<option value="${v}">${dirs[i]}</option>`).join('');
        document.getElementById('compJerarquia').innerHTML = ["Principal", "Ramal", "Derivación"].map(v => `<option value="${v}">${v}</option>`).join('');
    }
};

// --- GESTIÓN DE RED (CON AUTO-GUARDADO) ---
window.netManager = {
    fillGrupos() {
        document.getElementById('compGrupo').innerHTML = Object.keys(CATALOGO).map(g => `<option value="${g}">${g}</option>`).join('');
        this.fillAccesorios();
    },
    fillAccesorios() {
        const g = document.getElementById('compGrupo').value;
        document.getElementById('compTipo').innerHTML = CATALOGO[g].map(a => `<option value="${a}">${a}</option>`).join('');
    },
    async addNode() {
        const l = lineas.find(l => l.id === lineaActivaId);
        if(!l) return alert("Selecciona una línea de servicio primero");
        
        const forma = document.getElementById('compForma').value;
        const nodo = {
            id: Date.now(),
            forma: forma,
            tipo: document.getElementById('compTipo').value,
            L: parseFloat(document.getElementById('compL').value) || 0,
            dir: document.getElementById('compDir').value,
            jerarquia: document.getElementById('compJerarquia').value,
            Q: parseFloat(document.getElementById('compQ').value) || 0
        };

        if(forma === 'circular') {
            nodo.diametro = parseFloat(document.getElementById('compDiametro').value) || 0;
            nodo.ancho = nodo.diametro; 
            nodo.alto = nodo.diametro;
        } else {
            nodo.ancho = parseFloat(document.getElementById('compAncho').value) || 0;
            nodo.alto = parseFloat(document.getElementById('compAlto').value) || 0;
        }

        l.red.push(nodo);
        this.render();
        
        // Sincronización automática con Supabase
        await dbManager.guardar();
    },
    render() {
        const l = lineas.find(l => l.id === lineaActivaId);
        if(!l) return;
        document.getElementById('treeContainer').innerHTML = l.red.map(n => `
            <div class="win-tree-item">
                <b>${n.tipo}</b> | ${n.forma === 'circular' ? 'Ø'+n.diametro : n.ancho+'x'+n.alto} | L:${n.L}mm | Dir:${n.dir}
            </div>`).join('');
    }
};

// --- COMUNICACIÓN CON SUPABASE ---
window.dbManager = {
    async guardar() {
        if (!proyecto) return;
        const status = document.getElementById('status-sync');
        status.style.background = "#ffb900"; // Amarillo: Guardando
        
        const { error } = await supabaseClient.from('proyectos_hvac').upsert({ 
            nombre_buque: proyecto.buque, 
            datos_hvac: { lineas } 
        });

        if (error) {
            console.error(error);
            status.style.background = "#d13438"; // Rojo: Error
        } else {
            status.style.background = "#28a745"; // Verde: OK
        }
    },
    async listarProyectos() {
        const { data, error } = await supabaseClient.from('proyectos_hvac').select('nombre_buque');
        if(error) return console.error(error);
        document.getElementById('listaProyectosNube').innerHTML = data.map(p => 
            `<div class="win-list-item" onclick="dbManager.cargar('${p.nombre_buque}')">🚢 ${p.nombre_buque}</div>`).join('');
    },
    async cargar(n) {
        const { data, error } = await supabaseClient.from('proyectos_hvac').select('*').eq('nombre_buque', n).single();
        if(error) return alert("Error al cargar");
        proyecto = { buque: data.nombre_buque };
        lineas = data.datos_hvac.lineas || [];
        document.getElementById('badge-buque').textContent = n;
        document.getElementById('modalProyecto').style.display = 'none';
        lineManager.render();
    }
};

// --- VISOR 3D (OPTIMIZADO PARA MÓVIL Y PC) ---
export const visor3D = {
    scene: null, camera: null, renderer: null, controls: null,
    init() {
        const container = document.getElementById('container3d');
        if (this.renderer) return;
        
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xeeeeee);
        
        // Cámara para escala en mm
        this.camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 10, 100000);
        this.camera.position.set(5000, 5000, 5000);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(this.renderer.domElement);
        
        // CONTROLES HÍBRIDOS (MOUSE + TOUCH)
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true; 
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = true; 
        
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(10000, 10000, 10000);
        this.scene.add(light, new THREE.AmbientLight(0xffffff, 0.6));
        
        this.animate();
    },
    animate() { 
        requestAnimationFrame(() => this.animate()); 
        if(this.controls) this.controls.update(); 
        if(this.renderer) this.renderer.render(this.scene, this.camera); 
    },
    dibujar() {
        if(!this.scene) return;
        this.scene.children.filter(c => c.isMesh).forEach(m => this.scene.remove(m));
        
        const l = lineas.find(l => l.id === lineaActivaId);
        if(!l || !l.red.length) return;
        
        let cursor = new THREE.Vector3(0,0,0);
        const material = new THREE.MeshStandardMaterial({ color: 0x0078d4, metalness: 0.4, roughness: 0.3 });

        l.red.forEach(n => {
            let geo;
            if(n.forma === 'circular') {
                geo = new THREE.CylinderGeometry(n.diametro/2, n.diametro/2, n.L, 24);
            } else {
                geo = new THREE.BoxGeometry(n.ancho, n.alto, n.L);
            }
            
            const mesh = new THREE.Mesh(geo, material);
            const dirVec = new THREE.Vector3(
                n.dir==='X'?1:n.dir==='-X'?-1:0, 
                n.dir==='Z'?1:n.dir==='-Z'?-1:0, 
                n.dir==='Y'?1:n.dir==='-Y'?-1:0
            );

            // Posicionamiento y rotación según dirección naval
            mesh.position.copy(cursor.clone().add(dirVec.clone().multiplyScalar(n.L/2)));
            if(n.dir.includes('X')) mesh.rotation.z = Math.PI/2;
            if(n.dir.includes('Y')) mesh.rotation.x = Math.PI/2;
            if(n.forma === 'circular' && n.dir.includes('Z')) mesh.rotation.x = Math.PI/2;

            this.scene.add(mesh);
            cursor.add(dirVec.multiplyScalar(n.L));
        });
        
        // Centrar cámara automáticamente al final de la línea
        this.controls.target.copy(cursor.clone().multiplyScalar(0.5));
    }
};

// --- GESTIÓN DE SESIÓN Y PROYECTOS ---
window.authManager = {
    login() {
        const pin = document.getElementById('inputPin').value;
        if(pin === "1201" || pin === "0000") {
            document.getElementById('modalPin').style.display = 'none';
            document.getElementById('modalProyecto').style.display = 'flex';
            dbManager.listarProyectos();
            netManager.fillGrupos();
            ui.updateSelectors();
        } else alert("PIN Incorrecto");
    }
};

window.proyectManager = {
    crearNuevo() {
        const n = document.getElementById('p_buque').value;
        if(!n) return;
        proyecto = { buque: n.toUpperCase() };
        lineas = [];
        document.getElementById('badge-buque').textContent = proyecto.buque;
        document.getElementById('modalProyecto').style.display = 'none';
        dbManager.guardar();
    }
};

window.lineManager = {
    nuevaLinea() {
        const num = document.getElementById('l_numero').value;
        const ser = document.getElementById('l_servicio').value;
        if(!num) return;
        lineas.push({ id: Date.now(), numero: num, servicio: ser, red: [] });
        this.render();
        dbManager.guardar();
    },
    render() {
        document.getElementById('listaLineas').innerHTML = lineas.map(l => `
            <div class="win-card-linea" onclick="lineManager.select(${l.id})">
                <b>L-${l.numero}</b> | ${l.servicio}
            </div>`).join('');
    },
    select(id) { 
        lineaActivaId = id; 
        ui.showPage('red'); 
        netManager.render(); 
    }
};