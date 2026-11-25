/**
 * The table map as a PDF, to send to the venue: page 1 is the floor plan
 * with each table's id, then one card per table with who sits there (each
 * formando and how many people of their group). Kept simple on purpose:
 * the venue only needs where each group sits; guest names stay in the
 * venue's own portal. A4 landscape, drawn in vectors (sharp at any zoom).
 */
import { POSICOES_MESAS, type DadosMesas, type Mesa } from './mesas';

// Everything in millimetres.
const PAGINA = { largura: 297, altura: 210 };
const MARGEM = 14;
const UTIL = PAGINA.largura - 2 * MARGEM;

// The floor plan's own space (lib/mesas.ts stores positions as % of it).
const PLANTA = { largura: 602, altura: 336 };
const R_MESA = 21;
const RETANGULO = { largura: 34, altura: 84 };
const PISTA = { x: 230, y: 31, lado: 122 };

type Cor = [number, number, number];
const TINTA: Cor = [22, 22, 26];
const CINZA: Cor = [107, 107, 118];
const BORDA: Cor = [212, 212, 218];
const OURO: Cor = [168, 132, 63];
const OURO_CLARO: Cor = [246, 239, 224];
const OURO_FUNDO: Cor = [251, 247, 238];
const LARANJA: Cor = [194, 65, 12];
const LARANJA_FUNDO: Cor = [255, 244, 236];

const pessoas = (n: number) => `${n} ${n === 1 ? 'pessoa' : 'pessoas'}`;

/** Who still has people without a table — said on the PDF, so it's never sent short without noticing. */
function pendencias(dados: DadosMesas): string | null {
  const marcados = new Map<string, number>();
  for (const r of dados.reservas) marcados.set(r.formando, (marcados.get(r.formando) ?? 0) + r.lugares);
  const faltam = dados.convidados
    .map((c) => ({ formando: c.formando, falta: c.total - (marcados.get(c.formando) ?? 0) }))
    .filter((c) => c.falta > 0);
  if (!faltam.length) return null;
  return `Falta mesa para ${faltam.map((c) => `${pessoas(c.falta)} do grupo de ${c.formando}`).join(' e ')}.`;
}

export async function pdfDasMesas(dados: DadosMesas): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape', compress: true });
  const cor = (c: Cor) => ({ fill: () => pdf.setFillColor(...c), draw: () => pdf.setDrawColor(...c), text: () => pdf.setTextColor(...c) });

  const porId = new Map(dados.mesas.map((m) => [m.id, m]));
  const posicoes = POSICOES_MESAS.filter((p) => porId.has(p.id));
  const reservas = (id: string) => dados.reservas.filter((r) => r.mesa === id).sort((a, b) => a.formando.localeCompare(b.formando, 'pt-BR'));
  const ocupados = (m: Mesa) => reservas(m.id).reduce((s, r) => s + r.lugares, 0) + (m.ocupantes_fixos?.length ?? 0);
  const professores = (m: Mesa) => m.reservada_para === 'professores';
  const aviso = pendencias(dados);

  function titulo(texto: string, sub: string) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    cor(TINTA).text();
    pdf.text(texto, MARGEM, MARGEM + 6);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10.5);
    cor(CINZA).text();
    pdf.text(sub, MARGEM, MARGEM + 12.5);
  }

  function desenharAviso(y: number) {
    if (!aviso) return;
    cor(LARANJA_FUNDO).fill();
    pdf.rect(MARGEM, y, UTIL, 9, 'F');
    cor(LARANJA).fill();
    pdf.rect(MARGEM, y, 0.9, 9, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    cor(TINTA).text();
    pdf.text(aviso, MARGEM + 4, y + 4.5, { baseline: 'middle' });
  }

  // --- Page 1: the floor plan.
  titulo('Mapa de mesas · Turma 32', '10 de dezembro de 2026 · 19h');
  const topo = MARGEM + 20;
  const alturaMapa = PAGINA.altura - topo - MARGEM - (aviso ? 14 : 0);
  const k = Math.min(UTIL / PLANTA.largura, alturaMapa / PLANTA.altura);
  const ox = MARGEM + (UTIL - PLANTA.largura * k) / 2;
  const mx = (px: number) => ox + px * k;
  const my = (px: number) => topo + px * k;

  cor([238, 243, 246]).fill();
  cor([185, 199, 208]).draw();
  pdf.setLineWidth(0.3);
  pdf.roundedRect(mx(PISTA.x), my(PISTA.y), PISTA.lado * k, PISTA.lado * k, 1.5, 1.5, 'FD');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.setCharSpace(1.2);
  cor([138, 154, 165]).text();
  pdf.text('PISTA', mx(PISTA.x + PISTA.lado / 2), my(PISTA.y + PISTA.lado / 2), { align: 'center', baseline: 'middle' });
  pdf.setCharSpace(0);

  for (const p of posicoes) {
    const m = porId.get(p.id)!;
    const cx = mx((p.x / 100) * PLANTA.largura);
    const cy = my((p.y / 100) * PLANTA.altura);
    if (professores(m)) {
      cor(OURO_CLARO).fill();
      cor(OURO).draw();
      pdf.setLineWidth(0.5);
    } else {
      pdf.setFillColor(255, 255, 255);
      cor(TINTA).draw();
      pdf.setLineWidth(0.4);
    }
    if (p.formato === 'redonda') {
      pdf.circle(cx, cy, R_MESA * k, 'FD');
    } else {
      const w = RETANGULO.largura * k;
      const h = (p.altura ?? RETANGULO.altura) * k;
      pdf.roundedRect(cx - w / 2, cy - h / 2, w, h, 1, 1, 'FD');
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    cor(TINTA).text();
    pdf.text(p.id, cx, cy, { align: 'center', baseline: 'middle' });
  }
  desenharAviso(PAGINA.altura - MARGEM - 9);

  // --- Page 2 on: one card per table, the teachers' first, in columns.
  pdf.addPage('a4', 'landscape');
  titulo('Mesas', 'Formando e quantas pessoas do grupo dele sentam na mesa');
  const COLUNAS = 5;
  const VAO = 5;
  const largura = (UTIL - VAO * (COLUNAS - 1)) / COLUNAS;
  const PAD = 3.2;
  const LINHA = 4.6;
  const inicio = MARGEM + 20;
  // Reading order: the teachers', the rectangles, the left grid, then the rest as on the map.
  const grupo = (id: string) => (professores(porId.get(id)!) ? 0 : ['R', 'E'].indexOf(id[0]) + 1 || 3);
  const ordem = posicoes.map((p) => porId.get(p.id)!).sort((a, b) => grupo(a.id) - grupo(b.id));

  const cartoes = ordem.map((m) => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    const linhas = reservas(m.id).map((r) => ({ nome: pdf.splitTextToSize(r.formando, largura - 2 * PAD - 7) as string[], qt: r.lugares }));
    pdf.setFontSize(8.2);
    const fixos = m.ocupantes_fixos?.length ? (pdf.splitTextToSize(m.ocupantes_fixos.join(', '), largura - 2 * PAD) as string[]) : [];
    const altura = PAD + 6.5 + fixos.length * 3.8 + linhas.reduce((s, l) => s + l.nome.length * LINHA, 0) + PAD - 1;
    return { m, linhas, fixos, altura };
  });

  // Filled column by column (like a newspaper), each column about the same height.
  const ESPACO = 4;
  const alvo = cartoes.reduce((s, c) => s + c.altura + ESPACO, 0) / COLUNAS;
  let col = 0;
  let y0 = inicio;
  let topoPagina = inicio;
  for (const { m, linhas, fixos, altura } of cartoes) {
    const passou = col < COLUNAS - 1 && y0 - topoPagina + altura > alvo + 8;
    if ((passou || y0 + altura > PAGINA.altura - MARGEM) && y0 > topoPagina) {
      col++;
      y0 = topoPagina;
      if (col === COLUNAS) {
        pdf.addPage('a4', 'landscape');
        col = 0;
        topoPagina = y0 = MARGEM;
      }
    }
    const x = MARGEM + col * (largura + VAO);
    let y = y0;

    if (professores(m)) {
      cor(OURO_FUNDO).fill();
      cor(OURO).draw();
    } else {
      pdf.setFillColor(255, 255, 255);
      cor(BORDA).draw();
    }
    pdf.setLineWidth(0.3);
    pdf.roundedRect(x, y, largura, altura, 2, 2, 'FD');

    y += PAD + 3;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    cor(TINTA).text();
    pdf.text(professores(m) ? `${m.id} · Professores` : m.id, x + PAD, y, { baseline: 'middle' });
    cor(CINZA).text();
    pdf.text(String(ocupados(m)), x + largura - PAD, y, { align: 'right', baseline: 'middle' });
    y += 5.5;

    pdf.setFont('helvetica', 'normal');
    cor(TINTA).text();
    if (fixos.length) {
      pdf.setFontSize(8.2);
      for (const f of fixos) {
        pdf.text(f, x + PAD, y, { baseline: 'middle' });
        y += 3.8;
      }
    }
    pdf.setFontSize(9);
    for (const l of linhas) {
      pdf.setFont('helvetica', 'normal');
      l.nome.forEach((parte, i) => pdf.text(parte, x + PAD, y + i * LINHA, { baseline: 'middle' }));
      pdf.setFont('helvetica', 'bold');
      pdf.text(String(l.qt), x + largura - PAD, y, { align: 'right', baseline: 'middle' });
      y += l.nome.length * LINHA;
    }
    y0 += altura + ESPACO;
  }

  return pdf.output('blob');
}
