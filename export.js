// ─── Export Module ────────────────────────────────────────────────────────────
// Maneja exportación a PNG, PDF y Excel (XLSX)
// Depende de: html2canvas, jsPDF, SheetJS (cargados via CDN en index.html)

const ExportModule = (() => {

  // ── Helpers ────────────────────────────────────────────────────────────────

  function showToast(msg, type = 'info') {
    let toast = document.getElementById('export-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'export-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = `export-toast export-toast--${type} show`;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function setLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
      btn.dataset.original = btn.innerHTML;
      btn.innerHTML = `<span class="export-spinner"></span> Exportando…`;
      btn.disabled = true;
    } else {
      btn.innerHTML = btn.dataset.original || btn.innerHTML;
      btn.disabled = false;
    }
  }

  // Recorre el árbol y aplana en filas para Excel
  function flattenTree(node, depth = 0, parent = '') {
    const rows = [];
    const indent = '  '.repeat(depth);
    rows.push({
      Nivel: depth,
      Área: indent + node.name,
      'Área Superior': parent,
      Rol: node.role || '',
    });
    if (node.children) {
      node.children.forEach(child => {
        rows.push(...flattenTree(child, depth + 1, node.name));
      });
    }
    return rows;
  }

  // ── PNG ────────────────────────────────────────────────────────────────────

  async function exportPNG(btn) {
    const wrapper = document.getElementById('tree-wrapper');
    if (!wrapper) return showToast('No hay organigrama para exportar.', 'error');

    setLoading(btn, true);
    showToast('Generando imagen…', 'info');

    try {
      // Guardamos transform actual y reseteamos para captura completa
      const saved = { ...transform };
      wrapper.style.transform = 'translate(0px, 0px) scale(1)';

      await new Promise(r => setTimeout(r, 80)); // esperar repaint

      const canvas = await html2canvas(wrapper, {
        backgroundColor: '#f4f7f9',
        scale: 2,
        useCORS: true,
        logging: false,
        width: wrapper.scrollWidth,
        height: wrapper.scrollHeight,
      });

      // Restaurar transform
      wrapper.style.transform = `translate(${saved.x}px, ${saved.y}px) scale(${saved.scale})`;

      const link = document.createElement('a');
      link.download = `organigrama_${getTabName()}_${dateStamp()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      showToast('✅ PNG descargado correctamente', 'success');
    } catch (e) {
      console.error(e);
      showToast('❌ Error al generar PNG', 'error');
    } finally {
      setLoading(btn, false);
    }
  }

  // ── PDF ────────────────────────────────────────────────────────────────────

  async function exportPDF(btn) {
    const wrapper = document.getElementById('tree-wrapper');
    if (!wrapper) return showToast('No hay organigrama para exportar.', 'error');

    setLoading(btn, true);
    showToast('Generando PDF…', 'info');

    try {
      const saved = { ...transform };
      wrapper.style.transform = 'translate(0px, 0px) scale(1)';
      await new Promise(r => setTimeout(r, 80));

      const canvas = await html2canvas(wrapper, {
        backgroundColor: '#f4f7f9',
        scale: 2,
        useCORS: true,
        logging: false,
        width: wrapper.scrollWidth,
        height: wrapper.scrollHeight,
      });

      wrapper.style.transform = `translate(${saved.x}px, ${saved.y}px) scale(${saved.scale})`;

      const imgData = canvas.toDataURL('image/png');
      const imgW = canvas.width;
      const imgH = canvas.height;

      // Orientación según proporciones
      const landscape = imgW > imgH;
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: landscape ? 'landscape' : 'portrait',
        unit: 'px',
        format: 'a4',
        hotfixes: ['px_scaling'],
      });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const maxW = pageW - margin * 2;
      const maxH = pageH - margin * 2 - 40; // 40px para encabezado

      const ratio = Math.min(maxW / imgW, maxH / imgH);
      const drawW = imgW * ratio;
      const drawH = imgH * ratio;
      const offsetX = margin + (maxW - drawW) / 2;

      // Encabezado
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageW, 36, 'F');
      pdf.setDrawColor(209, 217, 230);
      pdf.line(0, 36, pageW, 36);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.setTextColor(30, 39, 46);
      pdf.text(`Organigrama — ${getTabName()}`, margin, 24);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(99, 110, 114);
      pdf.text(`Generado: ${new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' })}`, pageW - margin, 24, { align: 'right' });

      pdf.addImage(imgData, 'PNG', offsetX, 48, drawW, drawH);

      // Pie
      pdf.setFontSize(7);
      pdf.setTextColor(178, 190, 195);
      pdf.text('Documento generado automáticamente', pageW / 2, pageH - 10, { align: 'center' });

      pdf.save(`organigrama_${getTabName()}_${dateStamp()}.pdf`);
      showToast('✅ PDF descargado correctamente', 'success');
    } catch (e) {
      console.error(e);
      showToast('❌ Error al generar PDF', 'error');
    } finally {
      setLoading(btn, false);
    }
  }

  // ── Excel ──────────────────────────────────────────────────────────────────

  async function exportExcel(btn) {
    if (!window.data) return showToast('No hay datos para exportar.', 'error');

    setLoading(btn, true);
    showToast('Generando Excel…', 'info');

    try {
      const XLSX = window.XLSX;
      const wb = XLSX.utils.book_new();

      // Una hoja por tab
      window.data.tabs.forEach(tab => {
        const rows = flattenTree(tab.tree);

        const ws = XLSX.utils.json_to_sheet(rows, { header: ['Nivel', 'Área', 'Área Superior', 'Rol'] });

        // Anchos de columna
        ws['!cols'] = [
          { wch: 6 },   // Nivel
          { wch: 28 },  // Área
          { wch: 22 },  // Área Superior
          { wch: 70 },  // Rol
        ];

        // Estilo del encabezado (requiere xlsx pro para full styling, pero podemos usar sheetjs ce básico)
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let C = range.s.c; C <= range.e.c; C++) {
          const addr = XLSX.utils.encode_cell({ r: 0, c: C });
          if (!ws[addr]) continue;
          ws[addr].s = {
            font: { bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '2980B9' } },
            alignment: { horizontal: 'center' },
          };
        }

        XLSX.utils.book_append_sheet(wb, ws, tab.label.substring(0, 31));
      });

      // Hoja resumen de todos los nodos
      const allRows = [];
      window.data.tabs.forEach(tab => {
        flattenTree(tab.tree).forEach(r => {
          allRows.push({ Tab: tab.label, ...r });
        });
      });
      const wsSummary = XLSX.utils.json_to_sheet(allRows);
      wsSummary['!cols'] = [{ wch: 18 }, { wch: 6 }, { wch: 28 }, { wch: 22 }, { wch: 70 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen General');

      XLSX.writeFile(wb, `organigrama_completo_${dateStamp()}.xlsx`);
      showToast('✅ Excel descargado correctamente', 'success');
    } catch (e) {
      console.error(e);
      showToast('❌ Error al generar Excel', 'error');
    } finally {
      setLoading(btn, false);
    }
  }

  // ── Utilidades ─────────────────────────────────────────────────────────────

  function getTabName() {
    if (!window.data || activeTab < 0) return 'organigrama';
    return window.data.tabs[activeTab]?.label || 'organigrama';
  }

  function dateStamp() {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  }

  // ── Botón de exportación en el header ──────────────────────────────────────

  function mountExportBtn() {
    if (document.getElementById('export-dropdown-wrap')) return;

    const wrap = document.createElement('div');
    wrap.id = 'export-dropdown-wrap';
    wrap.className = 'export-dropdown-wrap';
    wrap.innerHTML = `
      <button class="export-main-btn" id="export-main-btn" title="Exportar organigrama">
        ⬇ Exportar
      </button>
      <div class="export-menu" id="export-menu">
        <button class="export-option" id="exp-png">🖼 PNG — Imagen</button>
        <button class="export-option" id="exp-pdf">📄 PDF — Documento</button>
        <button class="export-option" id="exp-xlsx">📊 Excel — Datos estructurados</button>
      </div>
    `;

    // Insertar antes de los zoom controls
    const header = document.querySelector('header');
    const zoomCtrl = header.querySelector('.zoom-controls');
    header.insertBefore(wrap, zoomCtrl);

    // Toggle menú
    const mainBtn = document.getElementById('export-main-btn');
    const menu    = document.getElementById('export-menu');

    mainBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('open');
    });

    document.addEventListener('click', () => menu.classList.remove('open'));

    document.getElementById('exp-png').addEventListener('click',  (e) => {
      menu.classList.remove('open');
      exportPNG(e.currentTarget);
    });
    document.getElementById('exp-pdf').addEventListener('click',  (e) => {
      menu.classList.remove('open');
      exportPDF(e.currentTarget);
    });
    document.getElementById('exp-xlsx').addEventListener('click', (e) => {
      menu.classList.remove('open');
      exportExcel(e.currentTarget);
    });
  }

  return { mountExportBtn, exportPNG, exportPDF, exportExcel };
})();

// Montar el botón cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  ExportModule.mountExportBtn();
});