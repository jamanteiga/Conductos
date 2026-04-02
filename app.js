// Catálogo extendido basado en tu lista de accesorios
const ACCESORIOS = [
    "Tramo Recto", "Codo 90º R/D=1.5", "Codo 45º", "Te 90º", "Te con Zapata", 
    "Reducción Céntrica", "Transición R-C", "Silenciador Naval", "UTA (Air Handling Unit)", 
    "Ventilador Axial", "Compuerta Cortafuegos", "Rejilla de Suministro", "Difusor Circular"
];

let redHvac = [];
let idSeleccionado = null;
let scene, camera, renderer, modelEstructura;

window.ui = {
    toggleForma(v) {
        document.getElementById('dims-rect').style.display = (v === 'circular') ? 'none' : 'flex';
        document.getElementById('dims-circ').style.display = (v === 'circular') ? 'flex' : 'none';
    },
    alert(msg) { alert("Función: " + msg); }
};

window.netManager = {
    addNode() {
        const forma = document.getElementById('compForma').value;
        const Q = parseFloat(document.getElementById('compQ').value) || 0;
        let W = parseFloat(document.getElementById('compW').value) || 0;
        let H = parseFloat(document.getElementById('compH').value) || 0;
        
        if(forma === 'circular') { 
            W = H = parseFloat(document.getElementById('compD').value) || 0; 
        }

        // Cálculo velocidad en m/s (Area en m2)
        const area = (W/1000) * (H/1000);
        const v = area > 0 ? (Q / (area * 3600)).toFixed(2) : 0;

        const nodo = {
            id: Date.now(),
            jerarquia: document.getElementById('compJerarquia').value,
            tipo: document.getElementById('compTipo').value,
            W, H, L: parseFloat(document.getElementById('compL').value) || 0,
            Q, v, dir: document.getElementById('compDir').value,
            forma
        };

        redHvac.push(nodo);
        this.renderAll();
        visor3D.actualizar();
    },

    renderAll() {
        const grid = document.getElementById('grid-edicion');
        grid.innerHTML = redHvac.map(n => `
            <div class="node-card-edit" id="card-${n.id}" onclick="netManager.selectNode(${n.id})">
                <b>${n.tipo}</b> [${n.jerarquia}]<br>
                Dim: ${n.W}x${n.H} mm | L: ${n.L} mm<br>
                Velocidad: <span style="color:${n.v > 8 ? 'red' : 'green'}">${n.v} m/s</span>
            </div>`).join('');
    },

    selectNode(id) {
        idSeleccionado = id;
        document.querySelectorAll('.node-card-edit').forEach(c => c.classList.remove('active'));
        document.getElementById('card-'+id).classList.add('active');

        const n = redHvac.find(x => x.id === id);
        document.getElementById('selected-info').innerHTML = `<b>EDITANDO:</b> ${n.tipo} | ${n.W}x${n.H}mm | Dirección: ${n.dir}`;
        
        // Cargar datos en el panel izquierdo para modificar
        document.getElementById('compL').value = n.L;
        document.getElementById('compQ').value = n.Q;
        document.getElementById('compW').value = n.W;
        document.getElementById('compH').value = n.H;
        document.getElementById('compDir').value = n.dir;
    },

    modifyNode() {
        if(!idSeleccionado) return alert("Seleccione un elemento primero");
        const n = redHvac.find(x => x.id === idSeleccionado);
        
        n.L = parseFloat(document.getElementById('compL').value);
        n.Q = parseFloat(document.getElementById('compQ').value);
        n.W = parseFloat(document.getElementById('compW').value);
        n.H = parseFloat(document.getElementById('compH').value);
        n.dir = document.getElementById('compDir').value;

        const area = (n.W/1000) * (n.H/1000);
        n.v = (n.Q / (area * 3600)).toFixed(2);

        this.renderAll();
        visor3D.actualizar();
    },

    deleteNode() {
        if(!idSeleccionado) return;
        redHvac = redHvac.filter(x => x.id !== idSeleccionado);
        idSeleccionado = null;
        document.getElementById('selected-info').innerText = "Seleccione un elemento...";
        this.renderAll();
        visor3D.actualizar();
    }
};

const visor3D = {
    init() {
        const container = document.getElementById('container3d');
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x111111);
        camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 100000);
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(renderer.domElement);
        
        const light = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(light);
        
        camera.position.set(3000, 3000, 3000);
        camera.lookAt(0,0,0);
        this.animate();
    },

    importarArchivo(event) {
        const file = event.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const loader = new THREE.STLLoader();
            const geom = loader.parse(e.target.result);
            const mesh = new THREE.Mesh(geom, new THREE.MeshPhongMaterial({color: 0x555555, transparent: true, opacity: 0.5}));
            if(modelEstructura) scene.remove(modelEstructura);
            modelEstructura = mesh; 
            scene.add(mesh);
            alert("Estructura importada.");
        };
        reader.readAsArrayBuffer(file);
    },

    actualizar() {
        // Limpiar conductos (manteniendo luces y estructura foránea)
        scene.children = scene.children.filter(c => c === modelEstructura || c instanceof THREE.AmbientLight);
        
        let x=0, y=0, z=0;
        redHvac.forEach(n => {
            const geo = new THREE.BoxGeometry(n.L, n.H, n.W);
            const mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({color: 0x0078d4}));
            
            // Lógica de posicionamiento secuencial por dirección
            if(n.dir === 'X') { mesh.position.set(x + n.L/2, y, z); x += n.L; }
            else if(n.dir === '-X') { mesh.position.set(x - n.L/2, y, z); x -= n.L; }
            else if(n.dir === 'Y') { mesh.position.set(x, y + n.L/2, z); y += n.L; }
            else if(n.dir === '-Y') { mesh.position.set(x, y - n.L/2, z); y -= n.L; }
            else if(n.dir === 'Z') { mesh.position.set(x, y, z + n.L/2); z += n.L; }
            else if(n.dir === '-Z') { mesh.position.set(x, y, z - n.L/2); z -= n.L; }
            
            scene.add(mesh);
        });
    },

    animate() {
        requestAnimationFrame(() => this.animate());
        renderer.render(scene, camera);
    }
};

window.dbManager = { guardar() { alert("Guardando en base de datos..."); } };

window.onload = () => {
    const sel = document.getElementById('compTipo');
    ACCESORIOS.forEach(acc => {
        let opt = document.createElement('option');
        opt.value = acc; opt.text = acc;
        sel.add(opt);
    });
    visor3D.init();
};