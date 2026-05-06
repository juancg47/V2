// ─── Budget Module ────────────────────────────────────────────────────────────

const BUDGET_TAB_ID = '__budget__';

const DEFAULT_PRICE_PER_INSTALL = 180000; // COP por instalación tripleplay
const DAYS_PER_MONTH = 22;
const MOTOS_PER_CUADRILLA = 4;
const INSTALLS_PER_MOTO_DAY = 3.5; // promedio entre 3 y 4

const CUADRILLAS = [
  { id: 'cuadrilla1', name: 'Cuadrilla 1' },
  { id: 'cuadrilla2', name: 'Cuadrilla 2' },
  { id: 'cuadrilla3', name: 'Cuadrilla 3' },
];

// Costos base mensuales por cuadrilla (COP)
const DEFAULT_COSTS = {
  salarios:    3200000,
  combustible:  480000,
  materiales:   620000,
  viaticos:     240000,
  mantenimiento:150000,
};

// Estado reactivo del módulo
let budgetState = {
  pricePerInstall: DEFAULT_PRICE_PER_INSTALL,
  installsPerMotoDay: INSTALLS_PER_MOTO_DAY,
  cuadrillas: CUADRILLAS.map(c => ({
    ...c,
    costs: { ...DEFAULT_COSTS },
  })),
};

// ─── Cálculos ─────────────────────────────────────────────────────────────────
function calcCuadrilla(cq) {
  const installs = cq.motos * budgetState.installsPerMotoDay * DAYS_PER_MONTH;
  const revenue  = installs * budgetState.pricePerInstall;
  const totalCost = Object.values(cq.costs).reduce((a, b) => a + b, 0);
  const profit   = revenue - totalCost;
  return { installs: Math.round(installs), revenue, totalCost, profit };
}

function calcTotals() {
  return budgetState.cuadrillas.map(cq => {
    const motos = MOTOS_PER_CUADRILLA;
    return { ...cq, motos, ...calcCuadrilla({ ...cq, motos }) };
  });
}

// ─── Formateo ─────────────────────────────────────────────────────────────────
function fmtCOP(n) {
  return '$ ' + Math.round(n).toLocaleString('es-CO');
}

function fmtNum(n) {
  return n.toLocaleString('es-CO');
}

// ─── Render principal ─────────────────────────────────────────────────────────
function renderBudgetPanel() {
  const canvas = document.getElementById('tree-canvas');
  canvas.innerHTML = '';
  canvas.style.cursor = 'default';
  canvas.style.overflow = 'auto';

  const rows = calcTotals();
  const grandRevenue  = rows.reduce((a, r) => a + r.revenue, 0);
  const grandCost     = rows.reduce((a, r) => a + r.totalCost, 0);
  const grandProfit   = rows.reduce((a, r) => a + r.profit, 0);
  const grandInstalls = rows.reduce((a, r) => a + r.installs, 0);

  const panel = document.createElement('div');
  panel.id = 'budget-panel';
  panel.innerHTML = `
    <div class="bp-header">
      <div class="bp-title-block">
        <span class="bp-icon">📊</span>
        <div>
          <h2 class="bp-title">Presupuesto Operacional</h2>
          <p class="bp-subtitle">Instalación Tripleplay · Proyección Mensual</p>
        </div>
      </div>

      <div class="bp-global-controls">
        <div class="bp-control-group">
          <label>Precio por instalación (COP)</label>
          <div class="bp-input-wrap">
            <span class="bp-currency">$</span>
            <input type="number" id="price-input" value="${budgetState.pricePerInstall}"
              min="10000" step="5000" />
          </div>
        </div>
        <div class="bp-control-group">
          <label>Instalaciones / moto / día</label>
          <div class="bp-input-wrap">
            <input type="number" id="installs-input" value="${budgetState.installsPerMotoDay}"
              min="1" max="10" step="0.5" style="padding-left:12px"/>
          </div>
        </div>
      </div>
    </div>

    <!-- KPI Cards -->
    <div class="bp-kpi-row">
      ${kpiCard('📦', 'Instalaciones totales / mes', fmtNum(grandInstalls), '', 'neutral')}
      ${kpiCard('💰', 'Ingresos totales', fmtCOP(grandRevenue), '/mes', 'positive')}
      ${kpiCard('📉', 'Costos totales', fmtCOP(grandCost), '/mes', 'negative')}
      ${kpiCard('📈', 'Utilidad neta', fmtCOP(grandProfit), '/mes', grandProfit >= 0 ? 'positive' : 'negative')}
    </div>

    <!-- Tabla por cuadrilla -->
    <div class="bp-section-title">Detalle por Cuadrilla</div>
    <div class="bp-table-wrap">
      <table class="bp-table">
        <thead>
          <tr>
            <th>Cuadrilla</th>
            <th>Motos</th>
            <th>Instalaciones/mes</th>
            <th>Salarios</th>
            <th>Combustible</th>
            <th>Materiales</th>
            <th>Viáticos</th>
            <th>Mantenimiento</th>
            <th>Total Costos</th>
            <th>Ingresos</th>
            <th>Utilidad</th>
          </tr>
        </thead>
        <tbody id="bp-tbody">
          ${rows.map((r, i) => renderRow(r, i)).join('')}
        </tbody>
        <tfoot>
          <tr class="bp-total-row">
            <td><strong>TOTAL</strong></td>
            <td>${MOTOS_PER_CUADRILLA * 3}</td>
            <td>${fmtNum(grandInstalls)}</td>
            ${Object.keys(DEFAULT_COSTS).map(k => {
              const total = rows.reduce((a, r) => a + r.costs[k], 0);
              return `<td>${fmtCOP(total)}</td>`;
            }).join('')}
            <td><strong>${fmtCOP(grandCost)}</strong></td>
            <td><strong>${fmtCOP(grandRevenue)}</strong></td>
            <td class="${grandProfit >= 0 ? 'profit-pos' : 'profit-neg'}"><strong>${fmtCOP(grandProfit)}</strong></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Detalle motos -->
    <div class="bp-section-title">Ingreso por Moto (mensual)</div>
    <div class="bp-motos-grid">
      ${rows.map(r => motoCard(r)).join('')}
    </div>
  `;

  canvas.appendChild(panel);
  bindBudgetEvents();
}

function kpiCard(icon, label, value, suffix, type) {
  return `
    <div class="bp-kpi bp-kpi--${type}">
      <span class="bp-kpi-icon">${icon}</span>
      <div class="bp-kpi-value">${value}<span class="bp-kpi-suffix">${suffix}</span></div>
      <div class="bp-kpi-label">${label}</div>
    </div>`;
}

function renderRow(r, i) {
  const profitClass = r.profit >= 0 ? 'profit-pos' : 'profit-neg';
  return `
    <tr data-cuadrilla="${i}">
      <td><span class="cq-badge" style="--cq-color:${getCqColor(i)}">${r.name}</span></td>
      <td>${MOTOS_PER_CUADRILLA}</td>
      <td>${fmtNum(r.installs)}</td>
      ${Object.entries(r.costs).map(([k, v]) => `
        <td>
          <div class="bp-cell-edit">
            <input type="number" class="bp-cost-input" 
              data-cuadrilla="${i}" data-cost="${k}"
              value="${v}" min="0" step="10000"/>
          </div>
        </td>`).join('')}
      <td>${fmtCOP(r.totalCost)}</td>
      <td class="income-cell">${fmtCOP(r.revenue)}</td>
      <td class="${profitClass}">${fmtCOP(r.profit)}</td>
    </tr>`;
}

function motoCard(r) {
  const revenuePerMoto = r.revenue / MOTOS_PER_CUADRILLA;
  const costPerMoto    = r.totalCost / MOTOS_PER_CUADRILLA;
  const profitPerMoto  = r.profit / MOTOS_PER_CUADRILLA;
  const instPerMoto    = r.installs / MOTOS_PER_CUADRILLA;
  const idx = budgetState.cuadrillas.findIndex(c => c.id === r.id);

  return `
    <div class="bp-moto-card" style="--cq-color:${getCqColor(idx)}">
      <div class="bp-moto-title">${r.name}</div>
      <div class="bp-moto-subtitle">📍 ${MOTOS_PER_CUADRILLA} motos activas</div>
      <div class="bp-moto-stats">
        <div class="bp-moto-stat">
          <span>🏍 Instalaciones/moto</span>
          <strong>${fmtNum(Math.round(instPerMoto))}</strong>
        </div>
        <div class="bp-moto-stat">
          <span>💵 Ingreso/moto</span>
          <strong class="profit-pos">${fmtCOP(revenuePerMoto)}</strong>
        </div>
        <div class="bp-moto-stat">
          <span>📉 Costo/moto</span>
          <strong class="profit-neg">${fmtCOP(costPerMoto)}</strong>
        </div>
        <div class="bp-moto-stat">
          <span>📈 Utilidad/moto</span>
          <strong class="${profitPerMoto >= 0 ? 'profit-pos' : 'profit-neg'}">${fmtCOP(profitPerMoto)}</strong>
        </div>
      </div>
    </div>`;
}

function getCqColor(i) {
  return ['#2980b9', '#27ae60', '#e67e22'][i] || '#636e72';
}

// ─── Eventos ──────────────────────────────────────────────────────────────────
function bindBudgetEvents() {
  document.getElementById('price-input').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    if (!isNaN(v) && v > 0) {
      budgetState.pricePerInstall = v;
      refreshBudget();
    }
  });

  document.getElementById('installs-input').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    if (!isNaN(v) && v > 0) {
      budgetState.installsPerMotoDay = v;
      refreshBudget();
    }
  });

  document.querySelectorAll('.bp-cost-input').forEach(input => {
    input.addEventListener('input', e => {
      const ci = parseInt(e.target.dataset.cuadrilla);
      const ck = e.target.dataset.cost;
      const v  = parseFloat(e.target.value);
      if (!isNaN(v) && v >= 0) {
        budgetState.cuadrillas[ci].costs[ck] = v;
        refreshBudget();
      }
    });
  });
}

function refreshBudget() {
  const rows = calcTotals();
  const grandRevenue  = rows.reduce((a, r) => a + r.revenue, 0);
  const grandCost     = rows.reduce((a, r) => a + r.totalCost, 0);
  const grandProfit   = rows.reduce((a, r) => a + r.profit, 0);
  const grandInstalls = rows.reduce((a, r) => a + r.installs, 0);

  // Update KPIs
  const kpis = document.querySelectorAll('.bp-kpi-value');
  if (kpis.length >= 4) {
    kpis[0].innerHTML = fmtNum(grandInstalls) + '<span class="bp-kpi-suffix"></span>';
    kpis[1].innerHTML = fmtCOP(grandRevenue)  + '<span class="bp-kpi-suffix">/mes</span>';
    kpis[2].innerHTML = fmtCOP(grandCost)     + '<span class="bp-kpi-suffix">/mes</span>';
    kpis[3].innerHTML = fmtCOP(grandProfit)   + '<span class="bp-kpi-suffix">/mes</span>';
    kpis[3].className = 'bp-kpi-value';
    kpis[3].closest('.bp-kpi').className = `bp-kpi bp-kpi--${grandProfit >= 0 ? 'positive' : 'negative'}`;
  }

  // Update tbody
  const tbody = document.getElementById('bp-tbody');
  if (tbody) tbody.innerHTML = rows.map((r, i) => renderRow(r, i)).join('');

  // Update tfoot
  const tfoot = document.querySelector('.bp-total-row');
  if (tfoot) {
    const cells = tfoot.querySelectorAll('td');
    cells[2].textContent = fmtNum(grandInstalls);
    let ci = 3;
    Object.keys(DEFAULT_COSTS).forEach(k => {
      const total = rows.reduce((a, r) => a + r.costs[k], 0);
      cells[ci++].textContent = fmtCOP(total);
    });
    cells[ci].innerHTML   = `<strong>${fmtCOP(grandCost)}</strong>`;
    cells[ci+1].innerHTML = `<strong>${fmtCOP(grandRevenue)}</strong>`;
    cells[ci+2].innerHTML = `<strong>${fmtCOP(grandProfit)}</strong>`;
    cells[ci+2].className = grandProfit >= 0 ? 'profit-pos' : 'profit-neg';
  }

  // Update moto cards
  const motoGrid = document.querySelector('.bp-motos-grid');
  if (motoGrid) motoGrid.innerHTML = rows.map(r => motoCard(r)).join('');

  // Re-bind cost inputs
  document.querySelectorAll('.bp-cost-input').forEach(input => {
    input.addEventListener('input', e => {
      const ci = parseInt(e.target.dataset.cuadrilla);
      const ck = e.target.dataset.cost;
      const v  = parseFloat(e.target.value);
      if (!isNaN(v) && v >= 0) {
        budgetState.cuadrillas[ci].costs[ck] = v;
        refreshBudget();
      }
    });
  });
}

// ─── Export ───────────────────────────────────────────────────────────────────
window.BudgetModule = { renderBudgetPanel, BUDGET_TAB_ID };