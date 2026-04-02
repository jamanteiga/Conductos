const SUPABASE_URL = 'https://ftavemcnvwiwupyqbsmv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_mZb53is840WLLIsC2GfPSg_T9r1sz86';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let proyecto = null, lineas = [], lineaActivaId = null, activeNodeId = null;

// TRADUCCIONES
const TRANSLATIONS = {
    es: {
        login_title: "🔐 Acceso Ingeniería", btn_enter: "Entrar", project_title: "🚢 Proyectos",
        ph_ship_name: "Nombre Buque", btn_create: "Crear Nuevo", cloud_sync: "💾 Sincronización",
        btn_save: "GUARDAR CAMBIOS", btn_refresh: "Refrescar", new_line: "Nueva Línea",
        ph_block: "Bloque", ph_line: "Línea", ph_service: "Servicio", btn_add: "+ Añadir",
        component_cfg: "🛠 Componente", label_hier: "Jerarquía", label_group: "Grupo",
        label_acc: "Accesorio", label_dir: "Dirección", btn_add_red: "AÑADIR A LA RED",
        nav_lines: "Líneas", nav_design: "Diseño", nav_3d: "Visor 3D",
        dirs: ["PROA (+X)", "POPA (-X)", "BABOR (+Y)", "ESTRIBOR (-Y)", "ARRIBA (+Z)", "ABAJO (-Z)"],
        hier: ["Principal", "Ramal", "Derivación"]
    },
    gl: {
        login_title: "🔐 Acceso Enxeñaría", btn_enter: "Entrar", project_title: "🚢 Proxectos",
        ph_ship_name: "Nome Buque", btn_create: "Crear Novo", cloud_sync: "💾 Sincronización",
        btn_save: "GARDAR CAMBIOS", btn_refresh: "Refrescar", new_line: "Nova Liña",
        ph_block: "Bloque", ph_line: "Liña", ph_service: "Servizo", btn_add: "+ Engadir",
        component_cfg: "🛠 Compoñente", label_hier: "Xerarquía", label_group: "Grupo",
        label_acc: "Accesorio", label_dir: "Dirección", btn_add_red: "ENGADIR Á REDE",
        nav_lines: "Liñas", nav_design: "Deseño", nav_3d: "Visor 3D",
        dirs: ["PROA (+X)", "POPA (-X)", "ESTRIBOR (+Y)", "BABOR (-Y)", "ARRIBA (+Z)", "ABAIXO (-Z)"],
        hier: ["Principal", "Ramal", "Derivación"]
    },
    en: {
        login_title: "🔐 Engineering Access", btn_enter: "Login", project_title: "🚢 Projects",
        ph_ship_name: "Ship Name", btn_create: "Create New", cloud_sync: "💾 Cloud Sync",
        btn_save: "SAVE CHANGES", btn_refresh: "Refresh", new_line: "New Line",
        ph_block: "Block", ph_line: "Line", ph_service: "Service", btn_add: "+ Add",
        component_cfg: "🛠 Component", label_hier: "Hierarchy", label_group: "Group",
        label_acc: "Accessory", label_dir: "Direction", btn_add_red: "ADD TO NETWORK",
        nav_lines: "Lines", nav_design: "Design", nav_3d: "3D View",
        dirs: ["BOW (+X)", "STERN (-X)", "PORT (+Y)", "STARBOARD (-Y)", "UP (+Z)", "DOWN (-Z)"],
        hier: ["Main", "Branch", "Outlet"]
    }
};

const CATALOGO = {
    "Conductos y Codos": ["Conducto Recto", "Codo 15°", "Codo 30°", "Codo 45°", "Codo 60°", "Codo 90° Corto", "Codo 90° Largo", "Giro en S"],
    "Transiciones y Tes": ["Transición R-C", "Transición R-O", "Te Abrupta", "Te Balanceada", "Reducción Gradual", "Expansión"],
    "Válvulas y Seguridad": ["Fire Damper", "Compuerta Estanca", "Válvula Antiexplosión", "Smoke Damper", "Retención", "Alivio"],
    "Tratamiento Aire": ["Silenciador Naval", "Filtro Plegado", "Filtro HEPA", "Filtro Carbón", "Recuperador Calor"],
    "Terminales": ["Difusor Lineal", "Difusor Radial", "Rejilla Antideflagrante", "Venteo Trampa Agua", "Terminal Techo"]
};

// MOTOR IDIOMAS
window.i18n = {
    current: 'es',
    setLang(l) {
        this.current = l;
        document.querySelectorAll('[data-i18n]').forEach(el => el.innerText = TRANSLATIONS[l][el.dataset.i18n]);
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => el.placeholder = TRANSLATIONS[l][el.dataset.i18nPlaceholder]);
        this.updateSelectors();
    },
    updateSelectors() {
        const d = TRANSLATIONS[this.current].dirs;
        const h = TRANSLATIONS[this.current].hier;
        document.getElementById('compDir').innerHTML = d.map((v, i) => `<option value="${['X','-X','Y','-Y','Z','-Z'][i]}">${v}</option>`).join('');
        document.getElementById('compJerarquia').innerHTML = h.map(v => `<option value="${v}">${v}</option>`).join('');
    }
};

window.authManager = {
    login() {
        const pin = document.getElementById('inputPin').value;
        if (pin === "1201" || pin === "0000") {
            document.getElementById('modalPin').style.display = 'none';
            document.getElementById('modalProyecto').style.display = 'flex';
            dbManager.listarProyectos();
            netManager.fillGrupos();
            i18n.setLang('es');
        } else alert("PIN Incorrecto");
    }
};

window.dbManager = {
    log(msg, isError = false) {
        const el = document.getElementById('db-log');
        if (el) { el.innerText = msg; el.style.color = isError ? "#d13438" : "#0078d4"; }
    },
    async listarProyectos() {
        this.log("Conectando...");
        const { data, error } = await supabaseClient.from('proyectos_hvac').select('nombre_buque');
        if (error) return this.log("Error: " + error.message, true);
        const list = document.getElementById('listaProyectosNube');
        list.innerHTML = data.map(p => `<div class="win-list-item" onclick="dbManager.cargar('${p.nombre_buque}')">🚢 ${p.nombre_buque}</div>`).join('');
        this.log("Sincronizado.");
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
        if (!proyecto) return;
        this.log("Guardando...");
        document.getElementById('status-sync').style.background = "#ffb900";
        const { error } = await supabaseClient.from('proyectos_hvac').upsert({ 
            nombre_buque: proyecto.buque, 
            datos_hvac: { lineas } 
        });
        if (error) {
            this.log("Error guardado", true);
            document.getElementById('status-sync').style.background = "#d13438";
        } else {
            this.log("¡Guardado OK!");
            document.getElementById('status-sync').style.background = "#28a745";
        }
    }
};

window.proyectManager = {
    crearNuevo() {
        const n = document.getElementById('p_buque').value;
        if (!n) return;
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
        if(!b || !n) return;
        lineas.push({ id: Date.now(), bloque: b, numero: n, servicio: s, red: [] });
        this.render();
    },
    render() {
        document.getElementById('listaLineas').innerHTML = lineas.map(l => `
            <div class="win-card-linea" onclick="lineManager.select(${l.id})">
                <b>B-${l.bloque}</b> | L-${l.numero} <br><small>${l.servicio}</small>
            </div>`).join('');
    },
    select(id) { lineaActivaId = id; ui.showPage('red'); netManager.render(); }
};

window.netManager = {
    fillGrupos() {
        const sel = document.getElementById('compGrupo');
        sel.innerHTML = Object.keys(CATALOGO).map(g => `<option value="${g}">${g}</option>`).join('');
        this.fillAccesorios();
    },
    fillAccesorios() {
        const g = document.getElementById('compGrupo').value;
        document.getElementById('compTipo').innerHTML = CATALOGO[g].map(a => `<option value="${a}">${a}</option>`).join('');
    },
    addNode() {
        const l = lineas.find(l => l.id === lineaActivaId);
        if(!l) return;
        l.red.push({
            id: Date.now(),
            jerarquia: document.getElementById('compJerarquia').value,
            tipo: document.getElementById('compTipo').value,
            ancho: parseFloat(document.getElementById('compAncho').value),
            alto: parseFloat(document.getElementById('compAlto').value),
            L: parseFloat(document.getElementById('compL').value),
            Q: parseFloat(document.getElementById('compQ').value),
            dir: document.getElementById('compDir').value
        });
        this.render();
    },
    deleteNode() {
        const l = lineas.find(l => l.id === lineaActivaId);
        l.red = l.red.filter(n => n.id !== activeNodeId);
        activeNodeId = null;
        document.getElementById('btnDelete').style.display = 'none';
        this.render();
    },
    select(id) { activeNodeId = id; document.getElementById('btnDelete').style.display = 'block'; this.render(); },
    render() {
        const l = lineas.find(l => l.id === lineaActivaId);
        if(!l) return;
        document.getElementById('treeContainer').innerHTML = l.red.map(n => `
            <div class="win-tree-item ${n.id === activeNodeId ? 'selected' : ''}" onclick="netManager.select(${n.id})">
                [${n.jerarquia}] ${n.tipo} (${n.ancho}x${n.alto})
            </div>`).join('');
    }
};

window.ui = {
    showPage(id) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-'+id).classList.add('active');
        if(id === 'visor') { setTimeout(() => { visor3D.init(); visor3D.dibujar(); }, 100); }
    }
};

export const visor3D = {
    scene: null, camera: null, renderer: null, controls: null,
    init() {
        const c = document.getElementById('container3d');
        if (this.renderer) return;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf3f3f3);
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / (window.innerHeight - 105), 0.1, 1000);
        this.camera.position.set(5, 5, 5);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight - 105);
        c.appendChild(this.renderer.domElement);
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.scene.add(new THREE.AmbientLight(0xffffff, 1.2));
        this.animate();
    },
    resize() {
        if(!this.renderer) return;
        const w = window.innerWidth, h = window.innerHeight - 105;
        this.renderer.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    },
    animate() { requestAnimationFrame(()=>this.animate()); if(this.renderer) this.renderer.render(this.scene, this.camera); },
    dibujar() {
        if(!this.scene) return;
        this.scene.children.filter(c => c.isMesh).forEach(m => this.scene.remove(m));
        const l = lineas.find(l => l.id === lineaActivaId);
        if(!l) return;
        let pos = new THREE.Vector3(0,0,0);
        l.red.forEach(n => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(n.ancho/1000, n.alto/1000, n.L), new THREE.MeshStandardMaterial({ color: 0x0078d4 }));
            const d = new THREE.Vector3(n.dir==='X'?1:n.dir==='-X'?-1:0, n.dir==='Z'?1:n.dir==='-Z'?-1:0, n.dir==='Y'?1:n.dir==='-Y'?-1:0);
            mesh.position.copy(pos.clone().add(d.clone().multiplyScalar(n.L/2)));
            if(n.dir.includes('X')) mesh.rotation.y = Math.PI/2;
            if(n.dir.includes('Y')) mesh.rotation.x = Math.PI/2;
            this.scene.add(mesh);
            pos.add(d.multiplyScalar(n.L));
        });
    }
};