import { FITTINGS, frictionFactor } from './engine.js';

let red = []; // Estructura jerárquica
let activeNodeId = null;

window.addJerarquia = function(tipo) {
    const parent = red.find(n => n.id === activeNodeId);
    
    // Reglas de Validación
    if (tipo === 'ramal' && (!parent || parent.tipo !== 'principal')) {
        return alert("Un Ramal solo puede colgar de un Conducto Principal");
    }
    if (tipo === 'derivacion' && (!parent || (parent.tipo !== 'principal' && parent.tipo !== 'ramal'))) {
        return alert("Una Derivación debe colgar de un Principal o un Ramal");
    }

    const newNode = {
        id: Date.now(),
        tipo: tipo,
        parentId: tipo === 'principal' ? null : activeNodeId,
        label: `${tipo.toUpperCase()} ${red.length + 1}`,
        L: 5,
        Q: 600, // Caudal heredado o manual
        fittings: [],
        dP: 0
    };

    red.push(newNode);
    activeNodeId = newNode.id;
    renderRed();
};

function renderRed() {
    const container = document.getElementById('redTreeView');
    container.innerHTML = "";
    
    // Renderizado recursivo simple
    const rootNodes = red.filter(n => n.parentId === null);
    rootNodes.forEach(node => renderNode(node, container, 0));
    
    actualizarCalculosRed();
}

function renderNode(node, container, level) {
    const div = document.createElement('div');
    div.className = `card ${node.id === activeNodeId ? 'active-node' : ''}`;
    div.style.marginLeft = `${level * 15}px`;
    div.onclick = () => { activeNodeId = node.id; renderRed(); };
    
    div.innerHTML = `
        <span class="type-tag tag-${node.tipo}">${node.tipo}</span>
        <strong>${node.label}</strong>
        <div style="font-size:11px; color:#666">L: ${node.L}m | ΔP: ${node.dP.toFixed(1)} Pa</div>
    `;
    
    container.appendChild(div);
    const children = red.filter(n => n.parentId === node.id);
    children.forEach(child => renderNode(child, container, level + 1));
}

window.filterFittings = function(val) {
    const list = document.getElementById('fittingsList');
    const filtered = FITTINGS.filter(f => f.name.toLowerCase().includes(val.toLowerCase()));
    list.innerHTML = filtered.map(f => `
        <button class="fit-add" onclick="addFittingToActive(${f.zeta}, '${f.name}')">
            ${f.name} (K=${f.zeta})
        </button>
    `).join('');
};

window.addFittingToActive = function(k, name) {
    const node = red.find(n => n.id === activeNodeId);
    if (!node) return alert("Selecciona un tramo primero");
    node.fittings.push({ name, k });
    renderRed();
};

function actualizarCalculosRed() {
    let totalSystemDP = 0;
    red.forEach(node => {
        // Cálculo simplificado de pérdida por tramo (Rozamiento Cte + Singularidades)
        // dP = (R * L) + sum(K * 0.5 * rho * v^2)
        const dPfric = 0.8 * node.L; // R asumido de 0.8 Pa/m
        const v = 5; // Velocidad asumida para el ejemplo
        const dPsing = node.fittings.reduce((acc, f) => acc + (f.k * 0.5 * 1.204 * v * v), 0);
        
        node.dP = dPfric + dPsing;
    });

    // El DP total del sistema es la suma de los tramos principales y sus ramas críticas
    totalSystemDP = red.reduce((acc, n) => acc + n.dP, 0);
    document.getElementById('redDP').textContent = totalSystemDP.toFixed(1);
}

// Inicializar lista
filterFittings("");