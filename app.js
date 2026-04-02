const SUPABASE_URL = 'https://ftavemcnvwiwupyqbsmv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_mZb53is840WLLIsC2GfPSg_T9r1sz86';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let proyecto = null, lineas = [], lineaActivaId = null, activeNodeId = null;

// 1. GESTIÓN DE ACCESO
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

// 2. BASE DE DATOS Y PERSISTENCIA
window.dbManager = {
    async listarProyectos() {
        const listaDiv = document.getElementById('listaProyectosNube');
        try {
            const { data, error } = await supabaseClient.from('proyectos_hvac').select('nombre_buque').limit(20);
            if (error) throw error;
            if (!data || data.length === 0) {
                listaDiv.innerHTML = "<div style='color:#888; padding:10px;'>Sin proyectos en la nube.</div>";
            } else {
                listaDiv.innerHTML = data.map(p => `<div class="p-item" onclick="dbManager.cargar('${p.nombre_buque}')">📁 ${p.nombre_buque}</div>`).join('');
            }
        } catch (e) {
            console.error("Error Supabase:", e);
            listaDiv.innerHTML = "<div style='color:#ff9500; padding:10px;'>Modo Offline: Crea un proyecto nuevo abajo.</div>";
        }
    },
    async cargar(n) {
        try {
            const { data, error } = await supabaseClient.from('proyectos_hvac').select('*').eq('nombre_buque', n).single();
            if (error) throw error;
            proyecto = { buque: data.nombre_buque };
            lineas = data.datos_hvac.lineas || [];
            document.getElementById('badge-buque').textContent = n;
            document.getElementById('modalProyecto').style.display = 'none';
            lineManager.render();
        } catch (e) {
            alert("Error al cargar proyecto");
        }
    },
    async guardar() {
        if (!proyecto || authManager.role === 'viewer') return;
        const dot = document.getElementById('status-sync');
        dot.style.background = "#ff9500";
        try {
            const { error } = await supabaseClient.from('proyectos_hvac').upsert({ 
                nombre_buque: proyecto.buque, 
                datos_hvac: { lineas } 
            });
            dot.style.background = error ? "#ff3b30" : "#34c759";
        } catch (e) {
            dot.style.background = "#ff3b30";
        }
    }
};

// 3. GESTIÓN DE PROYECTOS Y LÍNEAS
window.proyectManager = {
    crearNuevo() {
        const n = document.getElementById('p_buque').value;
        if (!n) return alert("Introduce nombre del buque");
        proyecto = { buque: n.toUpperCase() };
        lineas = [];
        document.getElementById('badge-buque').textContent = proyecto.buque;
        document.getElementById('modalProyecto').style.display = 'none';
        dbManager.guardar();
    }
};

window.lineManager = {
    nuevaLinea() {
        const n = prompt("Nº de Línea (ej. 01):");
        if(n) { 
            lineas.push({ id: Date.now(), numero: n, red: [] }); 
            this.render(); 
            dbManager.guardar(); 
        }
    },
    render() {
        document.getElementById('listaLineas').innerHTML = lineas.map(l => 
            `<div class="card" onclick="lineManager.select(${l.id})">LÍNEA L-${l.numero}</div>`
        ).join('');
    },
    select(id) {
        lineaActivaId = id;
        ui.showPage('red');
        netManager.render();
    }
};

// 4. MOTOR DE RED (NODOS Y ACCESORIOS)
window.netManager = {
    addNode(tipoPieza) {
        const l = lineas.find(l => l.id === lineaActivaId);
        if(!l) return;
        const n = { 
            id: Date.now(), 
            tipoPieza, 
            forma: 'rectangular', 
            dir: 'X', 
            ancho: 400, 
            alto: 300, 
            L: (tipoPieza === 'recto' ? 2 : 0.5), 
            caudal: 1200 
        };
        l.red.push(n);
        this.select(n.id);
    },
    updateNode() {
        const l = lineas.find(l => l.id === lineaActivaId);
        const n = l.red.find(x => x.id === activeNodeId);
        
        n.tipoPieza = document.getElementById('nodeTipoPieza').value;
        n.dir = document.getElementById('nodeDir').value;
        n.forma = document.getElementById('nodeForma').value;
        n.ancho = parseFloat(document.getElementById('nodeAncho').value) || 0;
        n.alto = parseFloat(document.getElementById('nodeAlto').value) || 0;
        n.L = parseFloat(document.getElementById('nodeL').value) || 0;
        n.caudal = parseFloat(document.getElementById('nodeCaudal').value) || 0;
        
        // Cálculos rápidos
        const area = n.forma === 'circular' ? (Math.PI * Math.pow(n.ancho/2000, 2)) : (n.ancho/1000 * n.alto/1000);
        n.vReal = area > 0 ? (n.caudal/3600) / area : 0;
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
        
        document.getElementById('nodeTipoPieza').value = n.tipoPieza;
        document.getElementById('nodeDir').value = n.dir;
        document.getElementById('nodeForma').value = n.forma;
        document.getElementById('nodeAncho').value = n.ancho;
        document.getElementById('nodeAlto').value = n.alto;
        document.getElementById('nodeL').value = n.L;
        document.getElementById('nodeCaudal').value = n.caudal;
        
        this.render();
    },
    render() {
        const l = lineas.find(l => l.id === lineaActivaId);
        if(!l) return;
        document.getElementById('treeContainer').innerHTML = l.red.map((n, i) => 
            `<div class="node-card ${n.id === activeNodeId ? 'active' : ''}" onclick="netManager.select(${n.id})">
                T${i+1} - ${n.tipoPieza.toUpperCase()} (${n.ancho}x${n.alto})
            </div>`
        ).join('');
    },
    deleteNode() {
        const l = lineas.find(l => l.id === lineaActivaId);
        l.red = l.red.filter(x => x.id !== activeNodeId);
        activeNodeId = null;
        document.getElementById('editPanel').style.display = 'none';
        this.render();
        dbManager.guardar();
    },
    analizarYOptimizar() {
        const l = lineas.find(l => l.id === lineaActivaId);
        let pt = 0;
        l.red.forEach(n => {
            const v = n.vReal || 0;
            const pd = (1.22 * v * v) / 2;
            const k = n.tipoPieza === 'recto' ? 0.02 : 0.35;
            pt += k * pd;
        });
        document.getElementById('resPresion').textContent = Math.ceil(pt * 1.2);
    }
};

// 5. VISOR 3D (THREE.JS)
export const visor3D = {
    scene: null, camera: null, renderer: null, controls: null,
    init() {
        const c = document.getElementById('container3d');
        if (this.renderer) return;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x111111);
        this.camera = new THREE.PerspectiveCamera(75, c.clientWidth/c.clientHeight, 0.1, 1000);
        this.camera.position.set(8, 8, 8);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(c.clientWidth, c.clientHeight);
        c.appendChild(this.renderer.domElement);
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.scene.add(new THREE.AmbientLight(0xffffff, 1));
        this.animate();
    },
    animate() {
        requestAnimationFrame(() => this.animate());
        if(this.renderer) this.renderer.render(this.scene, this.camera);
    },
    dibujar() {
        const l = lineas.find(l => l.id === lineaActivaId);
        if(!l || !this.scene) return;
        this.scene.children.filter(c => c.isMesh).forEach(m => this.scene.remove(m));
        
        let pos = new THREE.Vector3(0,0,0);
        l.red.forEach(n => {
            const geo = n.forma === 'circular' 
                ? new THREE.CylinderGeometry(n.ancho/2000, n.ancho/2000, n.L, 16)
                : new THREE.BoxGeometry(n.ancho/1000, n.alto/1000, n.L);
            
            const mat = new THREE.MeshStandardMaterial({ 
                color: n.id === activeNodeId ? 0xff9500 : 0x007aff,
                metalness: 0.5,
                roughness: 0.2
            });
            
            const mesh = new THREE.Mesh(geo, mat);
            const d = new THREE.Vector3(
                n.dir === 'X' ? 1 : n.dir === '-X' ? -1 : 0,
                n.dir === 'Z' ? 1 : n.dir === '-Z' ? -1 : 0,
                n.dir === 'Y' ? 1 : n.dir === '-Y' ? -1 : 0
            );
            
            mesh.position.copy(pos.clone().add(d.clone().multiplyScalar(n.L/2)));
            if(n.dir.includes('X')) mesh.rotation.z = Math.PI/2;
            else if(n.dir.includes('Y')) mesh.rotation.x = Math.PI/2;
            
            this.scene.add(mesh);
            pos.add(d.multiplyScalar(n.L));
        });
    }
};

// 6. EXPORTACIÓN
window.exportManager = {
    toCAD() {
        const l = lineas.find(l => l.id === lineaActivaId);
        if(!l) return;
        let dxf = "0\nSECTION\n2\nENTITIES\n";
        let cp = {x:0, y:0, z:0};
        l.red.forEach((n, i) => {
            const d = {x: n.dir==='X'?1:n.dir==='-X'?-1:0, y: n.dir==='Y'?1:n.dir==='-Y'?-1:0, z: n.dir==='Z'?1:n.dir==='-Z'?-1:0};
            const np = {x: cp.x + d.x*n.L, y: cp.y + d.y*n.L, z: cp.z + d.z*n.L};
            dxf += `0\nLINE\n8\nT${i+1}_${n.tipoPieza.toUpperCase()}\n10\n${cp.x}\n20\n${cp.y}\n30\n${cp.z}\n11\n${np.x}\n21\n${np.y}\n31\n${np.z}\n`;
            cp = np;
        });
        dxf += "0\nENDSEC\n0\nEOF";
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([dxf], {type:'application/dxf'}));
        a.download = `HVAC_${proyecto.buque}.dxf`;
        a.click();
    },
    toExcel() {
        const l = lineas.find(l => l.id === lineaActivaId);
        const ws = XLSX.utils.json_to_sheet(l.red);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Listado");
        XLSX.writeFile(wb, `Reporte_${proyecto.buque}.xlsx`);
    }
};

// 7. NAVEGACIÓN Y ARRANQUE
window.ui = {
    showPage(id) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-'+id).classList.add('active');
        if(id === 'visor') {
            setTimeout(() => {
                visor3D.init();
                visor3D.dibujar();
            }, 150);
        }
    }
};

window.onload = () => {
    console.log("Sistema HVAC Naval listo.");
};