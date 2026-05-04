// ─── State ───────────────────────────────────────────────────────────────────
let data = null;
let activeTab = 0;
let collapsedNodes = new Set();
let transform = { x: 0, y: 0, scale: 1 };
let isPanning = false;
let panStart = { x: 0, y: 0 };

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('data.json');
    data = await res.json();
    renderTabs();
    renderTree(activeTab);
  } catch (e) {
    console.error('Error loading data.json', e);
  }
});

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function renderTabs() {
  const nav = document.getElementById('tab-nav');
  nav.innerHTML = '';
  data.tabs.forEach((tab, i) => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (i === activeTab ? ' active' : '');
    btn.style.setProperty('--tab-color', tab.color);
    btn.innerHTML = `<span class="tab-indicator"></span>${tab.label}`;
    btn.addEventListener('click', () => {
      activeTab = i;
      collapsedNodes.clear();
      resetTransform();
      document.querySelectorAll('.tab-btn').forEach((b, j) => {
        b.classList.toggle('active', j === i);
      });
      renderTree(i);
    });
    nav.appendChild(btn);
  });
}

// ─── Tree ─────────────────────────────────────────────────────────────────────
function renderTree(tabIndex) {
  const tab = data.tabs[tabIndex];
  const canvas = document.getElementById('tree-canvas');
  canvas.innerHTML = '';
  resetTransform();

  const wrapper = document.createElement('div');
  wrapper.className = 'tree-wrapper';
  wrapper.id = 'tree-wrapper';

  const treeEl = buildNodeEl(tab.tree, 0);
  wrapper.appendChild(treeEl);
  canvas.appendChild(wrapper);

  setupPanZoom(canvas, wrapper);
  applyTransform(wrapper);
}

function buildNodeEl(node, depth) {
  const container = document.createElement('div');
  container.className = 'node-container';
  container.dataset.id = node.id;

  const hasChildren = node.children && node.children.length > 0;
  const isCollapsed = collapsedNodes.has(node.id);

  // Node box
  const box = document.createElement('div');
  box.className = 'node-box';
  box.style.setProperty('--node-color', node.color);
  box.innerHTML = `
    <div class="node-inner">
      <div class="node-icon-wrap">
        <img src="${node.icon}" alt="${node.name}" class="node-icon" onerror="this.style.display='none'">
      </div>
      <span class="node-name">${node.name}</span>
    </div>
    ${hasChildren ? `<button class="toggle-btn" data-id="${node.id}" title="${isCollapsed ? 'Expandir' : 'Colapsar'}">${isCollapsed ? '+' : '−'}</button>` : ''}
  `;

  box.addEventListener('click', (e) => {
    if (e.target.classList.contains('toggle-btn') || e.target.closest('.toggle-btn')) return;
    openModal(node);
  });

  if (hasChildren) {
    const toggleBtn = box.querySelector('.toggle-btn');
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNode(node.id);
    });
  }

  container.appendChild(box);

  // Children
  if (hasChildren && !isCollapsed) {
    const connector = document.createElement('div');
    connector.className = 'connector-down';
    container.appendChild(connector);

    const childrenRow = document.createElement('div');
    childrenRow.className = 'children-row';

    node.children.forEach((child, i) => {
      const childWrap = document.createElement('div');
      childWrap.className = 'child-wrap';

      const lineTop = document.createElement('div');
      lineTop.className = 'connector-up';
      childWrap.appendChild(lineTop);

      const childEl = buildNodeEl(child, depth + 1);
      childWrap.appendChild(childEl);
      childrenRow.appendChild(childWrap);
    });

    container.appendChild(childrenRow);
  }

  return container;
}

function toggleNode(id) {
  if (collapsedNodes.has(id)) {
    collapsedNodes.delete(id);
  } else {
    collapsedNodes.add(id);
  }
  renderTree(activeTab);
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function openModal(node) {
  const modal = document.getElementById('modal');
  document.getElementById('modal-title').textContent = node.name;
  document.getElementById('modal-role').textContent = node.role;
  const img = document.getElementById('modal-icon');
  img.src = node.icon;
  img.onerror = () => img.style.display = 'none';
  img.style.display = 'block';
  document.getElementById('modal-color-bar').style.background = node.color;
  modal.classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ─── Zoom & Pan ───────────────────────────────────────────────────────────────
function setupPanZoom(canvas, wrapper) {
  // Wheel zoom
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    transform.scale = Math.min(Math.max(transform.scale * delta, 0.2), 3);
    applyTransform(wrapper);
    updateZoomLabel();
  }, { passive: false });

  // Mouse pan
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isPanning = true;
    panStart = { x: e.clientX - transform.x, y: e.clientY - transform.y };
    canvas.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    transform.x = e.clientX - panStart.x;
    transform.y = e.clientY - panStart.y;
    applyTransform(wrapper);
  });
  window.addEventListener('mouseup', () => {
    isPanning = false;
    canvas.style.cursor = 'grab';
  });

  // Touch pan
  let lastTouch = null;
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      lastTouch = { x: e.touches[0].clientX - transform.x, y: e.touches[0].clientY - transform.y };
    }
  });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 1 && lastTouch) {
      transform.x = e.touches[0].clientX - lastTouch.x;
      transform.y = e.touches[0].clientY - lastTouch.y;
      applyTransform(wrapper);
    }
  }, { passive: false });
  canvas.addEventListener('touchend', () => lastTouch = null);
}

function applyTransform(wrapper) {
  if (!wrapper) wrapper = document.getElementById('tree-wrapper');
  if (!wrapper) return;
  wrapper.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;
}

function resetTransform() {
  transform = { x: 0, y: 0, scale: 1 };
  const w = document.getElementById('tree-wrapper');
  if (w) applyTransform(w);
  updateZoomLabel();
}

function updateZoomLabel() {
  const lbl = document.getElementById('zoom-label');
  if (lbl) lbl.textContent = Math.round(transform.scale * 100) + '%';
}

// ─── Zoom controls ────────────────────────────────────────────────────────────
document.getElementById('btn-zoom-in').addEventListener('click', () => {
  transform.scale = Math.min(transform.scale * 1.2, 3);
  applyTransform();
  updateZoomLabel();
});
document.getElementById('btn-zoom-out').addEventListener('click', () => {
  transform.scale = Math.max(transform.scale * 0.8, 0.2);
  applyTransform();
  updateZoomLabel();
});
document.getElementById('btn-reset').addEventListener('click', () => {
  resetTransform();
});
