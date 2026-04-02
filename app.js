// Catálogo de los 144 elementos (resumen para funcionalidad)
const CATALOGO = {
    "CONDUCTO": 0.02, "CODO 90": 0.4, "CODO 45": 0.2, "TE": 1.2, "REDUCCION": 0.15, "SILENCIADOR": 0.9, "UTA": 15
};

let redHvac = [];
let idSeleccionado = null;
let scene, camera, renderer, modelEstructura;

window.ui = {
    toggleForma(v) {
        document.getElementById('dims-rect').style.display = (v === 'circular') ? 'none' : 'flex';
        document.getElementById('dims-circ').style.display = (v === 'circular') ? 'flex' : 'none';
    },
    showSection(sec) {
        const modal = document.getElementById('modal-container');
        const content = document.getElementById('modal-content');
        modal.style.display = 'flex';
        if(sec === 'datos') {
            content.innerHTML = `<h3>Datos de Diseño</h3><p>Configure los parámetros generales del buque aquí.</p>`;
        } else if(sec === 'lineas') {
            content.innerHTML = `<h3>Gestión de Líneas</h3><p>Bloque: ${document.getElementById('val-bloque').innerText}</p>`;
        } else {
            this.closeModal();
        }
    },
    closeModal() { document.getElementById('modal-container').style.display = 'none'; },
    exportar() { alert("Exportando a formato técnico (STP/DXF)..."); }
};

window.netManager = {
    addNode() {
        const forma = document.getElementById('compForma').value;
        const Q = parseFloat(document.getElementById('compQ').value);
        let W = parseFloat(document.getElementById('compW').value);
        let H = parseFloat(document.getElementById('compH').value);
        if(forma === 'circular') { W = H = parseFloat(document.getElementById('compD').value); }

        const area = (W/1000) * (H/1000);
        const v = (Q / (area * 3600)).toFixed(2);

        const nodo = {
            id: Date.now(),
            jerarquia: document.getElementById('compJerarquia').value,
            tipo: document.getElementById('compTipo').value,
            W, H, L: parseFloat(document.getElementById('compL').value),
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
            <div class="node-card-edit" onclick="netManager.selectNode(${n.id})">
                <b>${n.tipo}</b><br>
                Dim: ${n.W}x${n.H}mm<br>
                L: ${n.L}mm | v: ${n.v}m/s
            </div>`).join('');
    },
    selectNode(id) {
        idSeleccionado = id;
        const n = redHvac.find(x => x.id === id);
        document.getElementById('selected-info').innerHTML = `EDITANDO: ${n.tipo} (${n.id})`;
        // Cargar en form lateral
        document.getElementById('compL').value = n.L;
        document.getElementById('compW').value = n.W;
        document.getElementById('compH').value = n.H;
        document.getElementById('compQ').value = n.Q;
        document.getElementById('compDir').value = n.dir;
    },
    modifyNode() {
        if(!idSeleccionado) return;
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
        redHvac = redHvac.filter(x => x.id !== idSeleccionado);
        idSeleccionado = null;
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
        const reader = new FileReader();
        const ext = file.name.split('.').pop().toLowerCase();
        reader.onload = (e) => {
            if(ext === 'stl') {
                const loader = new THREE.STLLoader();
                const geom = loader.parse(e.target.result);
                const mesh = new THREE.Mesh(geom, new THREE.MeshPhongMaterial({color: 0x555555, transparent: true, opacity: 0.4}));
                if(modelEstructura) scene.remove(modelEstructura);
                modelEstructura = mesh; scene.add(mesh);
            }
        };
        if(ext === 'stl') reader.readAsArrayBuffer(file);
    },
    actualizar() {
        scene.children = scene.children.filter(c => c === modelEstructura || c instanceof THREE.AmbientLight);
        let x=0, y=0, z=0;
        redHvac.forEach(n => {
            const geo = new THREE.BoxGeometry(n.L, n.H, n.W);
            const mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({color: 0x0078d4}));
            if(n.dir === 'X') { mesh.position.set(x + n.L/2, y, z); x += n.L; }
            else if(n.dir === '-X') { mesh.position.set(x - n.L/2, y, z); x -= n.L; }
            else if(n.dir === 'Y') { mesh.position.set(x, y + n.L/2, z); y += n.L; }
            else if(n.dir === '-Y') { mesh.position.set(x, y - n.L/2, z); y -= n.L; }
            scene.add(mesh);
        });
    },
    animate() {
        requestAnimationFrame(() => this.animate());
        renderer.render(scene, camera);
    }
};

window.onload = () => {
    const sel = document.getElementById('compTipo');
    Object.keys(CATALOGO).forEach(k => {
        let opt = document.createElement('option');
        opt.value = k; opt.text = `${k} (K=${CATALOGO[k]})`;
        sel.add(opt);
    });
    visor3D.init();
};