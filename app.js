const SUPABASE_URL = 'https://ftavemcnvwiwupyqbsmv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_mZb53is840WLLIsC2GfPSg_T9r1sz86';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let proyecto = null, lineas = [], lineaActivaId = null, activeNodeId = null;

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
    }
};

window.dbManager = {
    async listarProyectos() {
        const listaDiv = document.getElementById('listaProyectosNube');
        try {
            const { data, error } = await supabaseClient.from('proyectos_hvac').select('nombre_buque').limit(15);
            if (error) throw error;
            listaDiv.innerHTML = (!data || data.length === 0) 
                ? "No hay proyectos en la nube." 
                : data.map(p => `<div class="p-item" onclick="dbManager.cargar('${p.nombre_buque}')">📁 ${p.nombre_buque}</div>`).join('');
        } catch (e) {
            listaDiv.innerHTML = "Error de conexión.";
        }
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
        if (!proyecto || this.role === 'viewer') return;
        document.getElementById('status-sync').style.background = "#ff9500";
        await supabaseClient.from('proyectos_hvac').upsert({ nombre_buque: proyecto.buque, datos_hvac: { lineas } });
        document.getElementById('status-sync').style.background = "#34c759";
    }
};

window.proyectManager = {
    crearNuevo() {
        const n = document.getElementById('p_buque').value;
        if (!n) return alert("Introduce nombre");
        proyecto = { buque: n.toUpperCase() };
        lineas = [];
        document.getElementById('badge-buque').textContent = proyecto.buque;
        document.getElementById('modalProyecto').style.display = 'none';
        dbManager.guardar();
    }
};

window.lineManager = {
    nuevaLinea() {
        const n = prompt("Nº Línea:");
        if(n) { lineas.push({id:Date.now(), numero:n, red:[]}); this.render(); dbManager.guardar(); }
    },
    render() {
        document.getElementById('listaLineas').innerHTML = lineas.map(l => `<div class="card" onclick="lineManager.select(${l.id})">LÍNEA L-${l.numero}</div>`).join('');
    },
    select(id) { lineaActivaId = id; ui.showPage('red'); netManager.render(); }
};

window.netManager = {
    addNode(tipoPieza) {
        const l = lineas.find(l => l.id === lineaActivaId);
        const n = { id: Date.now(), tipoPieza, forma: 'rectangular', dir: 'X', ancho: 400, alto: 300, L: (tipoPieza==='recto'?2:0.5), caudal: 1200 };
        l.red.push(n); this.select(n.id);
    },
    updateNode() {
        const l = lineas.find(l => l.id === lineaActivaId);
        const n = l.red.find(x => x.id === activeNodeId);
        ['tipoPieza','dir','forma'].forEach(k => n[k] = document.getElementById('node'+k.charAt(0).toUpperCase()+k.slice(1)).value);
        ['ancho','alto','L','caudal'].forEach(k => n[k] = parseFloat(document.getElementById('node'+k.charAt(0).toUpperCase()+k.slice(1)).value) || 0);
        const area = n.forma === 'circular' ? (Math.PI * Math.pow(n.ancho/2000, 2)) : (n.ancho/1000 * n.alto/1000);
        n.vReal = (n.caudal/3600) / area;
        document.getElementById('liveVel').textContent = n.vReal.toFixed(2);
        const perim = n.forma === 'circular' ? (Math.PI * n.ancho/1000) : (2 * (n.ancho/1000 + n.alto/1000));
        let peso = perim * n.L * 0.8 * 7.85;
        if(n.tipoPieza !== 'recto') peso *= 1.4;
        document.getElementById('liveWeight').textContent = peso.toFixed(1);
        this.render();
        dbManager.guardar();
    },
    select(id) {
        activeNodeId = id;
        const l = lineas.find(l => l.id === lineaActivaId);
        const n = l.red.find(x => x.id === id);
        document.getElementById('editPanel').style.display = 'block';
        ['tipoPieza','dir','forma','ancho','alto','L','caudal'].forEach(k => document.getElementById('node'+k.charAt(0).toUpperCase()+k.slice(1)).value = n[k]);
        this.render();
    },
    render() {
        const l = lineas.find(l => l.id === lineaActivaId);
        if(!l) return;
        document.getElementById('treeContainer').innerHTML = l.red.map((n, i) => `<div class="node-card ${n.id===activeNodeId?'active':''}" onclick="netManager.select(${n.id})">T${i+1} - ${n.tipoPieza.toUpperCase()}</div>`).join('');
    },
    deleteNode() {
        const l = lineas.find(l => l.id === lineaActivaId);
        l.red = l.red.filter(x => x.id !== activeNodeId);
        activeNodeId = null; document.getElementById('editPanel').style.display = 'none'; this.render(); dbManager.guardar();
    },
    analizarYOptimizar() {
        const l = lineas.find(l => l.id === lineaActivaId);
        let pt = 0;
        l.red.forEach(n => {
            const v = n.vReal || 0; const pd = (1.22 * v * v) / 2;
            const k = n.tipoPieza === 'recto' ? 0.02 : 0.35;
            pt += k * pd;
        });
        document.getElementById('resPresion').textContent = Math.ceil(pt * 1.2);
    }
};

export const visor3D = {
    scene: null, camera: null, renderer: null, controls: null,
    init() {
        const c = document.getElementById('container3d');
        if (this.renderer) return;
        this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x111111);
        this.camera = new THREE.PerspectiveCamera(75, c.clientWidth/c.clientHeight, 0.1, 1000);
        this.camera.position.set(5, 5, 5);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(c.clientWidth, c.clientHeight);
        c.appendChild(this.renderer.domElement);
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.scene.add(new THREE.AmbientLight(0xffffff, 1));
        this.animate();
    },
    animate() { requestAnimationFrame(()=>this.animate()); if(this.renderer) this.renderer.render(this.scene, this.camera); },
    dibujar() {
        const l = lineas.find(l => l.id === lineaActivaId); if(!l) return;
        this.scene.children.filter(c => c.isMesh).forEach(m => this.scene.remove(m));
        let pos = new THREE.Vector3(0,0,0);
        l.red.forEach(n => {
            const geo = new THREE.BoxGeometry(n.ancho/1000, n.alto/1000, n.L);
            const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: n.id === activeNodeId ? 0xff9500 : 0x007aff }));
            const d = new THREE.Vector3(n.dir==='X'?1:n.dir==='-X'?-1:0, n.dir==='Z'?1:n.dir==='-Z'?-1:0, n.dir==='Y'?1:n.dir==='-Y'?-1:0);
            mesh.position.copy(pos.clone().add(d.clone().multiplyScalar(n.L/2)));
            if(n.dir.includes('X')) mesh.rotation.z = Math.PI/2; else if(n.dir.includes('Y')) mesh.rotation.x = Math.PI/2;
            this.scene.add(mesh); pos.add(d.multiplyScalar(n.L));
        });
    }
};

window.exportManager = {
    toCAD() {
        const l = lineas.find(l => l.id === lineaActivaId);
        let dxf = "0\nSECTION\n2\nENTITIES\n";
        l.red.forEach((n, i) => { dxf += `0\nLINE\n8\nTRAMO_${i+1}\n10\n0\n20\n0\n30\n0\n11\n${n.L}\n21\n0\n31\n0\n`; });
        dxf += "0\nENDSEC\n0\nEOF";
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([dxf], {type:'application/dxf'})); a.download = `CAD_${proyecto.buque}.dxf`; a.click();
    },
    toExcel() {
        const l = lineas.find(l => l.id === lineaActivaId);
        const ws = XLSX.utils.json_to_sheet(l.red);
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Red");
        XLSX.writeFile(wb, `Reporte_${proyecto.buque}.xlsm`);
    }
};

window.ui = {
    showPage(id) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-'+id).classList.add('active');
        if(id==='visor') { setTimeout(() => { visor3D.init(); visor3D.dibujar(); }, 100); }
    }
};