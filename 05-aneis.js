"use strict";

/* ==================================================================
   HELPER.LOG — PANORAMA POR TIPO (GRÁFICOS DE ANÉIS)
   ------------------------------------------------------------------
   Lê a lista global `ocorrencias` (03-functions.js) e desenha um anel
   por tipo de ocorrência, dividido por desfecho. Redesenha sempre que
   a tabela é redesenhada (cadastro, edição, exclusão, importação).
================================================================== */

const DESFECHOS = {
    "Em andamento": { cor: "#facc15", rotulo: "Pendentes" },
    "Entregue":     { cor: "#22c55e", rotulo: "Entregues" },
    "Perdida":      { cor: "#ef4444", rotulo: "Perdidas" },
    "Avariada":     { cor: "#fb923c", rotulo: "Avarias" },
    "Devolvida":    { cor: "#a78bfa", rotulo: "Devoluções" }
};

const TIPOS_PADRAO = [
    "Devolução parcial", "Entrega não realizada", "Veículo com problema",
    "Reagendamento", "Avaria na carga", "Carga perdida"
];

const RAIO = 46, CIRC = 2 * Math.PI * RAIO;
const moeda = n => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const desfechoDe = item => (DESFECHOS[item.desfecho] ? item.desfecho : "Em andamento");

/** Anel dividido em partes: [{ valor, cor, titulo }] */
function anelSegmentado(partes, total, centro, legenda) {
    let deslocamento = 0;
    let arcos = "";

    if (total > 0) {
        partes.forEach(p => {
            if (!p.valor) return;
            const tam = p.valor / total * CIRC;
            arcos += `<circle r="${RAIO}" cx="60" cy="60" fill="none" stroke="${p.cor}" stroke-width="14"
                stroke-dasharray="${tam} ${CIRC - tam}" stroke-dashoffset="${-deslocamento}"
                transform="rotate(-90 60 60)"><title>${escapeHtml(p.titulo)}: ${p.valor}</title></circle>`;
            deslocamento += tam;
        });
    }

    return `<svg viewBox="0 0 120 120" role="img" aria-label="${escapeHtml(legenda)}">
        <circle r="${RAIO}" cx="60" cy="60" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="14"/>
        ${arcos}
        <text x="60" y="64" text-anchor="middle" font-size="24" font-weight="700">${centro}</text>
    </svg>`;
}

/** Anel de um único indicador em porcentagem (0 a 100). */
function anelPercentual(pct, cor, legenda) {
    const p = Math.max(0, Math.min(100, pct));
    const tam = p / 100 * CIRC;
    return `<svg viewBox="0 0 120 120" role="img" aria-label="${escapeHtml(legenda)}">
        <circle r="${RAIO}" cx="60" cy="60" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="14"/>
        <circle r="${RAIO}" cx="60" cy="60" fill="none" stroke="${cor}" stroke-width="14" stroke-linecap="round"
            stroke-dasharray="${tam} ${CIRC - tam}" transform="rotate(-90 60 60)"/>
        <text x="60" y="66" text-anchor="middle" font-size="22" font-weight="700">${Math.round(pct)}%</text>
    </svg>`;
}

function resumir(lista) {
    const r = { qtd: lista.length, valor: 0, perda: 0, porDesfecho: {} };
    Object.keys(DESFECHOS).forEach(k => r.porDesfecho[k] = 0);
    lista.forEach(item => {
        r.porDesfecho[desfechoDe(item)]++;
        r.valor += paraNumero(item.valor);
        r.perda += paraNumero(item.perda);
    });
    return r;
}

function desenharResumo(todos) {
    const alvo = document.getElementById("resumoAneis");
    if (!alvo) return;

    const r = resumir(todos);
    const entregues = r.porDesfecho["Entregue"];
    const valorEntregue = todos.filter(i => desfechoDe(i) === "Entregue")
        .reduce((s, i) => s + paraNumero(i.valor), 0);
    const lucro = valorEntregue - r.perda;
    const pctEntrega = r.qtd ? entregues / r.qtd * 100 : 0;
    const pctPerda = r.valor ? r.perda / r.valor * 100 : 0;
    const pctLucro = r.valor ? Math.max(0, lucro) / r.valor * 100 : 0;

    alvo.innerHTML = `
        <div class="anel-card">
            ${anelPercentual(pctEntrega, DESFECHOS["Entregue"].cor, "Taxa de entrega")}
            <div><h3>Taxa de entrega</h3><small>${entregues} de ${r.qtd} ocorrência${r.qtd === 1 ? "" : "s"} entregue${entregues === 1 ? "" : "s"}</small></div>
        </div>
        <div class="anel-card">
            ${anelPercentual(pctPerda, DESFECHOS["Perdida"].cor, "Perda sobre o valor")}
            <div><h3>Perda</h3><small>${moeda(r.perda)} de ${moeda(r.valor)} em NFs</small></div>
        </div>
        <div class="anel-card" title="Valor das NFs entregues menos as perdas informadas">
            ${anelPercentual(pctLucro, "#38bdf8", "Lucro sobre o valor")}
            <div><h3>Lucro</h3><small><b>${moeda(lucro)}</b><br>entregues − perdas</small></div>
        </div>`;
}

function desenharAneis() {
    const alvo = document.getElementById("aneisTipos");
    if (!alvo) return;

    const todos = ocorrencias || [];
    desenharResumo(todos);

    const tipos = [...TIPOS_PADRAO];
    todos.forEach(i => { if (i.tipo && !tipos.includes(i.tipo)) tipos.push(i.tipo); });

    alvo.innerHTML = tipos.map(tipo => {
        const lista = todos.filter(i => i.tipo === tipo);
        const r = resumir(lista);
        const partes = Object.entries(DESFECHOS).map(([chave, d]) =>
            ({ valor: r.porDesfecho[chave], cor: d.cor, titulo: d.rotulo }));

        const linhas = partes.filter(p => p.valor).map(p =>
            `<li><span><i style="background:${p.cor}"></i>${p.titulo}</span><b>${p.valor}</b></li>`).join("");

        return `<article class="anel-card clicavel${filtros.tipo === tipo ? " ativo" : ""}" data-tipo="${escapeHtml(tipo)}" tabindex="0" role="button" aria-label="Filtrar tabela por ${escapeHtml(tipo)}" title="Clique para filtrar a tabela por este tipo">
            <h3>${escapeHtml(tipo)}</h3>
            ${anelSegmentado(partes, r.qtd, r.qtd, `${tipo}: ${r.qtd} ocorrências`)}
            <ul class="anel-lista">${linhas || "<li>Sem registros</li>"}</ul>
            <div class="anel-valores"><span>Valor ${moeda(r.valor)}</span><span>Perda ${moeda(r.perda)}</span></div>
        </article>`;
    }).join("");
}

/* Clicar (ou Enter) em um anel filtra a tabela por aquele tipo; clicar de novo limpa. */
function ligarCliqueDosAneis() {
    const alvo = document.getElementById("aneisTipos");
    if (!alvo) return;

    const aplicar = evento => {
        const card = evento.target.closest("[data-tipo]");
        if (!card) return;
        const tipo = card.dataset.tipo;
        definirFiltro("tipo", filtros.tipo === tipo ? "" : tipo);
        if (filtros.tipo) document.querySelector(".card").scrollIntoView({ behavior: "smooth", block: "start" });
    };

    alvo.addEventListener("click", aplicar);
    alvo.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); aplicar(e); } });
}
document.addEventListener("DOMContentLoaded", ligarCliqueDosAneis);

/* Redesenha os anéis sempre que a tabela for redesenhada. */
const renderizarTabelaOriginal = renderizarTabela;
renderizarTabela = function () {
    renderizarTabelaOriginal();
    desenharAneis();
};
