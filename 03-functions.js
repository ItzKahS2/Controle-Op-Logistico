"use strict";

/* ==================================================================
   HELPER.LOG — CONTROLE DE OCORRÊNCIAS
   ------------------------------------------------------------------
   Toda a lógica da tela de ocorrências: cadastro, edição, exclusão
   (com desfazer), listagem, e importação/exportação para Excel.
   Os dados são persistidos em localStorage.
================================================================== */

const STORAGE_KEY = "ocorrencias";

/** @type {Array<Object>} lista de ocorrências em memória */
let ocorrencias = carregarOcorrencias();

/** id da ocorrência sendo editada no momento (null = criando nova) */
let idEmEdicao = null;

/** backup usado para desfazer a última exclusão */
let backupOcorrencias = null;
let undoTimeout = null;

// ------------------------------------------------------------------
// CONFIGURAÇÃO DO EFEITO "PISCAR" AO ADICIONAR UMA LINHA
// ------------------------------------------------------------------
const BLINK_DURATION = 0.9; // segundos
const BLINK_COUNT = 1;      // repetições
const BLINK_OPACITY = 0.3;  // opacidade da cor (0..1)


/* ==================================================================
   PERSISTÊNCIA (localStorage)
================================================================== */

function carregarOcorrencias() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (erro) {
        console.error("Não foi possível ler as ocorrências salvas:", erro);
        return [];
    }
}

function salvarLocalStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ocorrencias));
}


/* ==================================================================
   UTILITÁRIOS
================================================================== */

/** Evita XSS ao inserir texto digitado pelo usuário dentro de innerHTML. */
function escapeHtml(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

/** Converte "1.234,56", "R$ 10" ou número para Number (0 se inválido). */
function paraNumero(v) {
    if (typeof v === "number") return isFinite(v) ? v : 0;
    let s = String(v ?? "").replace(/[^\d,.-]/g, "");
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    return Number(s) || 0;
}

function randomColor() {
    const r = Math.floor(Math.random() * 255);
    const g = Math.floor(Math.random() * 255);
    const b = Math.floor(Math.random() * 255);
    return `rgba(${r},${g},${b},${BLINK_OPACITY})`;
}

/** Faz uma linha da tabela piscar brevemente (usado ao adicionar). */
function highlightRow(id) {
    const linha = document.querySelector(`tr[data-id="${id}"]`);
    if (!linha) return;

    linha.style.setProperty("--blink-color", randomColor());
    linha.style.animation = `blink ${BLINK_DURATION}s ease-in-out 0s ${BLINK_COUNT}`;
    linha.classList.add("blink-highlight");

    linha.addEventListener("animationend", () => {
        linha.classList.remove("blink-highlight");
        linha.style.removeProperty("--blink-color");
        linha.style.removeProperty("animation");
    }, { once: true });
}


/* ==================================================================
   FORMULÁRIO
================================================================== */

function lerFormulario() {
    return {
        nf: document.getElementById("nf").value.trim(),
        transportadora: document.getElementById("transportadora").value.trim(),
        tipo: document.getElementById("tipo").value,
        status: document.getElementById("status").value,
        mtv: document.getElementById("mtv").value.trim(),
        cliente: document.getElementById("cliente").value.trim(),
        desfecho: document.getElementById("desfecho").value,
        valor: paraNumero(document.getElementById("valor").value),
        perda: paraNumero(document.getElementById("perda").value)
    };
}

function limparFormulario() {
    document.getElementById("nf").value = "";
    document.getElementById("transportadora").value = "";
    document.getElementById("tipo").value = "";
    document.getElementById("status").value = "Pendente";
    document.getElementById("mtv").value = "";
    document.getElementById("cliente").value = "";
    document.getElementById("desfecho").value = "Em andamento";
    document.getElementById("valor").value = "";
    document.getElementById("perda").value = "";
}

function sairDoModoEdicao() {
    idEmEdicao = null;
    document.getElementById("formCard").classList.remove("editando");
}

/**
 * Cria uma nova ocorrência ou salva a edição em andamento.
 * Chamada pelo submit do #ocorrenciaForm.
 */
function adicionarOcorrencia(evento) {
    if (evento) evento.preventDefault();

    const dados = lerFormulario();
    let idRecemAdicionado = null;

    if (!dados.nf || !dados.transportadora || !dados.tipo) {
        alert("Preencha os campos obrigatórios.");
        return;
    }

    if (idEmEdicao !== null) {
        const indice = ocorrencias.findIndex(item => String(item.id) === String(idEmEdicao));

        if (indice !== -1) {
            const atualizado = { ...ocorrencias[indice], ...dados };

            // Desfecho "Entregue" = finalizada; qualquer outro volta para as ativas.
            if (atualizado.desfecho === "Entregue") {
                atualizado.dataFinalizacao = atualizado.dataFinalizacao || new Date().toLocaleString("pt-BR");
            } else {
                delete atualizado.dataFinalizacao;
            }

            ocorrencias[indice] = atualizado;
        }

        sairDoModoEdicao();
    } else {
        const novaOcorrencia = {
            id: Date.now(),
            ...dados,
            data: new Date().toLocaleString("pt-BR"),
            ...(dados.desfecho === "Entregue" ? { dataFinalizacao: new Date().toLocaleString("pt-BR") } : {})
        };

        ocorrencias.push(novaOcorrencia);
        idRecemAdicionado = novaOcorrencia.id;
    }

    salvarLocalStorage();
    renderizarTabela();
    limparFormulario();

    if (idRecemAdicionado) {
        setTimeout(() => highlightRow(idRecemAdicionado), 50);
    }
}

function editarOcorrencia(id) {
    const ocorrencia = ocorrencias.find(item => String(item.id) === String(id));
    if (!ocorrencia) return;

    document.getElementById("nf").value = ocorrencia.nf;
    document.getElementById("transportadora").value = ocorrencia.transportadora;
    document.getElementById("tipo").value = ocorrencia.tipo;
    document.getElementById("status").value = ocorrencia.status;
    document.getElementById("mtv").value = ocorrencia.mtv;
    document.getElementById("cliente").value = ocorrencia.cliente;
    document.getElementById("desfecho").value = ocorrencia.desfecho || "Em andamento";
    document.getElementById("valor").value = ocorrencia.valor || "";
    document.getElementById("perda").value = ocorrencia.perda || "";

    idEmEdicao = id;
    document.getElementById("formCard").classList.add("editando");
    document.getElementById("nf").focus();
}


/* ==================================================================
   TABELA
================================================================== */

/* ------------------------------------------------------------------
   FILTROS
------------------------------------------------------------------ */

const filtros = { busca: "", status: "", tipo: "", desfecho: "" };

/** Aba ativa da tabela: "ativas" ou "finalizadas". */
let abaAtual = "ativas";

/** Uma ocorrência está finalizada quando foi concluída com sucesso (desfecho Entregue). */
const ehFinalizada = item => item.desfecho === "Entregue";

function ocorrenciasDaAba() {
    return ocorrencias.filter(item => ehFinalizada(item) === (abaAtual === "finalizadas"));
}

function definirAba(aba) {
    abaAtual = aba;
    renderizarTabela();
}

const STATUS_ROTULO = { Pendente: "Pendente", Reentregar: "Reentregar", DarEntrada: "Dar entrada" };

const DESFECHO_CLASSE = {
    "Em andamento": "des-andamento",
    "Entregue": "des-entregue",
    "Perdida": "des-perdida",
    "Avariada": "des-avariada",
    "Devolvida": "des-devolvida"
};

/** Minúsculo e sem acento, para a busca ignorar "Devolução" x "devolucao". */
const normalizar = texto => String(texto ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function ocorrenciasFiltradas() {
    const busca = normalizar(filtros.busca).trim();

    return ocorrenciasDaAba().filter(item => {
        if (filtros.status && item.status !== filtros.status) return false;
        if (filtros.tipo && item.tipo !== filtros.tipo) return false;
        if (filtros.desfecho && (item.desfecho || "Em andamento") !== filtros.desfecho) return false;
        if (busca && !normalizar([item.nf, item.transportadora, item.cliente, item.mtv].join(" ")).includes(busca)) return false;
        return true;
    });
}

function filtrosAtivos() {
    return Object.values(filtros).some(Boolean);
}

/** Muda um filtro e redesenha (também usado pelos anéis do panorama). */
function definirFiltro(campo, valor) {
    filtros[campo] = valor;
    renderizarTabela();
}

function limparFiltros() {
    Object.keys(filtros).forEach(chave => filtros[chave] = "");
    document.getElementById("filtroBusca").value = "";
    document.getElementById("filtroDesfecho").value = "";
    renderizarTabela();
}

function atualizarFiltrosUI(visiveis) {
    const chips = document.getElementById("chipsStatus");
    if (!chips) return;

    const base = ocorrenciasDaAba();
    const qtdFinalizadas = ocorrencias.filter(ehFinalizada).length;

    document.getElementById("abas").innerHTML = [
        ["ativas", "Ativas", ocorrencias.length - qtdFinalizadas, "bi-hourglass-split"],
        ["finalizadas", "Finalizadas", qtdFinalizadas, "bi-check-circle-fill"]
    ].map(([chave, rotulo, qtd, icone]) =>
        `<button type="button" role="tab" class="aba${abaAtual === chave ? " on" : ""}" data-aba="${chave}"
            aria-selected="${abaAtual === chave}"><i class="bi ${icone}"></i>${rotulo} <b>${qtd}</b></button>`
    ).join("");

    const opcoes = [["", "Todos", base.length]].concat(
        Object.keys(STATUS_ROTULO).map(chave =>
            [chave, STATUS_ROTULO[chave], base.filter(i => i.status === chave).length])
    );

    chips.innerHTML = opcoes.map(([valor, rotulo, qtd]) => {
        const ativo = filtros.status === valor;
        return `<button type="button" class="chip chip-${valor || "Todos"}${ativo ? " on" : ""}"
                    data-status="${valor}" aria-pressed="${ativo}"><i></i>${rotulo} <b>${qtd}</b></button>`;
    }).join("");

    // Inclui no filtro de tipo qualquer tipo vindo de planilhas importadas.
    const seletorTipo = document.getElementById("filtroTipo");
    const existentes = new Set([...seletorTipo.options].map(o => o.value));
    ocorrencias.forEach(item => {
        if (item.tipo && !existentes.has(item.tipo)) {
            seletorTipo.add(new Option(item.tipo, item.tipo));
            existentes.add(item.tipo);
        }
    });
    seletorTipo.value = filtros.tipo;

    document.getElementById("contadorFiltro").textContent =
        `Mostrando ${visiveis} de ${base.length}`;
    document.getElementById("limparFiltros").hidden = !filtrosAtivos();
}

function iniciarFiltros() {
    document.getElementById("filtroBusca")
        .addEventListener("input", e => definirFiltro("busca", e.target.value));
    document.getElementById("filtroTipo")
        .addEventListener("change", e => definirFiltro("tipo", e.target.value));
    document.getElementById("filtroDesfecho")
        .addEventListener("change", e => definirFiltro("desfecho", e.target.value));
    document.getElementById("limparFiltros")
        .addEventListener("click", limparFiltros);

    document.getElementById("abas").addEventListener("click", e => {
        const aba = e.target.closest(".aba");
        if (aba) definirAba(aba.dataset.aba);
    });

    document.getElementById("chipsStatus").addEventListener("click", e => {
        const chip = e.target.closest(".chip");
        if (!chip) return;
        const valor = chip.dataset.status;
        definirFiltro("status", valor === filtros.status ? "" : valor);
    });
}

function renderizarTabela() {
    const tabela = document.getElementById("tabelaOcorrencias");
    tabela.innerHTML = "";

    const lista = ocorrenciasFiltradas();
    atualizarFiltrosUI(lista.length);

    if (lista.length === 0) {
        let vazio = "Nenhuma ocorrência com esses filtros. Use “Limpar filtros” para ver todas.";
        if (ocorrenciasDaAba().length === 0) {
            vazio = abaAtual === "finalizadas"
                ? "Nenhuma ocorrência finalizada ainda. Use “Finalizar” nas que foram concluídas com sucesso."
                : "Nenhuma ocorrência ativa. Preencha o formulário ao lado para começar.";
        }
        tabela.innerHTML = `<tr><td colspan="9" class="tabela-vazia">${vazio}</td></tr>`;
        return;
    }

    lista.forEach(item => {
        const linha = document.createElement("tr");
        linha.dataset.id = item.id;
        linha.className = `linha-${item.status}`;

        linha.innerHTML = `
            <td>${escapeHtml(item.nf)}</td>
            <td>${escapeHtml(item.transportadora)}</td>
            <td>${escapeHtml(item.tipo)}</td>
            <td>
                <span class="status ${escapeHtml(item.status)}">
                    ${escapeHtml(STATUS_ROTULO[item.status] || item.status)}
                </span>
            </td>
            <td>
                <span class="status ${DESFECHO_CLASSE[item.desfecho] || "des-andamento"}">
                    ${escapeHtml(item.desfecho || "Em andamento")}
                </span>
            </td>
            <td>
                ${escapeHtml(item.data)}
                ${item.dataFinalizacao ? `<small class="data-final"><i class="bi bi-check2-circle"></i> ${escapeHtml(item.dataFinalizacao)}</small>` : ""}
            </td>
            <td>
                <button type="button" class="deleteBtn" onclick="deletarOcorrencia('${item.id}')">
                    <i class="bi bi-trash-fill"></i>
                    Deletar
                </button>
            </td>
            <td>
                <button type="button" class="editBtn" onclick="editarOcorrencia('${item.id}')">
                    <i class="bi bi-pencil-square"></i>
                    Editar
                </button>
            </td>
            <td>
                ${ehFinalizada(item)
                    ? `<button type="button" class="reabrirBtn" onclick="reabrirOcorrencia('${item.id}')"><i class="bi bi-arrow-counterclockwise"></i> Reabrir</button>`
                    : `<button type="button" class="finalBtn" onclick="finalizarOcorrencia('${item.id}')"><i class="bi bi-check-lg"></i> Finalizar</button>`}
            </td>
        `;

        tabela.appendChild(linha);
    });
}


/* ==================================================================
   EXCLUSÃO (COM DESFAZER)
================================================================== */

function deletarOcorrencia(id) {
    const indice = ocorrencias.findIndex(item => String(item.id) === String(id));

    if (indice === -1) {
        alert("Ocorrência não encontrada.");
        return;
    }

    if (!confirm("Tem certeza que deseja deletar a ocorrência selecionada?")) return;

    backupOcorrencias = [...ocorrencias];
    ocorrencias.splice(indice, 1);

    salvarLocalStorage();
    renderizarTabela();
    mostrarUndo("Ocorrência removida.");
}

/* ------------------------------------------------------------------
   FINALIZAR / REABRIR
   Finalizar marca o desfecho como "Entregue" e move a ocorrência para
   a aba Finalizadas. Reabrir devolve para "Em andamento". Os dois podem
   ser desfeitos pelo aviso de desfazer.
------------------------------------------------------------------ */

function alterarConclusao(id, finalizar) {
    const item = ocorrencias.find(o => String(o.id) === String(id));
    if (!item) return;

    backupOcorrencias = ocorrencias.map(o => ({ ...o }));

    if (finalizar) {
        item.desfecho = "Entregue";
        item.dataFinalizacao = new Date().toLocaleString("pt-BR");
    } else {
        item.desfecho = "Em andamento";
        delete item.dataFinalizacao;
    }

    salvarLocalStorage();
    renderizarTabela();
    mostrarUndo(finalizar ? "Ocorrência finalizada com sucesso." : "Ocorrência reaberta.");
}

const finalizarOcorrencia = id => alterarConclusao(id, true);
const reabrirOcorrencia = id => alterarConclusao(id, false);

function delAll() {
    if (ocorrencias.length === 0) {
        alert("Não há ocorrências para apagar.");
        return;
    }

    if (!confirm("Tem certeza que deseja apagar todas as ocorrências?")) return;

    backupOcorrencias = [...ocorrencias];
    ocorrencias = [];

    salvarLocalStorage();
    renderizarTabela();
    mostrarUndo("Todas as ocorrências foram removidas.");
}

function mostrarUndo(mensagem) {
    const toast = document.getElementById("undoToast");
    if (!toast) {
        console.error("Elemento #undoToast não encontrado.");
        return;
    }

    const progresso = toast.querySelector(".undo-progress");

    document.getElementById("undoMessage").textContent = mensagem;
    toast.classList.add("show");

    // Reinicia a animação da barra de progresso.
    progresso.classList.remove("animate");
    void progresso.offsetWidth;
    progresso.classList.add("animate");

    clearTimeout(undoTimeout);
    undoTimeout = setTimeout(() => {
        backupOcorrencias = null;
        toast.classList.remove("show");
    }, 5000);
}

function desfazerExclusao() {
    if (!backupOcorrencias) return;

    ocorrencias = [...backupOcorrencias];
    backupOcorrencias = null;

    salvarLocalStorage();
    renderizarTabela();

    clearTimeout(undoTimeout);
    document.getElementById("undoToast").classList.remove("show");
}


/* ==================================================================
   EXPORTAÇÃO / IMPORTAÇÃO (EXCEL)
================================================================== */

function exportXls() {
    const dadosFormatados = ocorrencias.map(item => ({
        "NF": item.nf,
        "CLIENTE": item.cliente,
        "TRANSPORTADORA": item.transportadora,
        "TIPO": item.tipo,
        "DATA": item.data,
        "AÇÃO": item.status,
        "MOTIVO": item.mtv,
        "DESFECHO": item.desfecho || "Em andamento",
        "VALOR": item.valor || 0,
        "PERDA": item.perda || 0,
        "FINALIZADA EM": item.dataFinalizacao || ""
    }));

    const planilha = XLSX.utils.json_to_sheet(dadosFormatados);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, planilha, "Ocorrencias");
    XLSX.writeFile(workbook, "Ocorrencias_Logistica.xlsx");
}

function importarPlanilha(evento) {
    const arquivo = evento.target.files[0];

    if (!arquivo) {
        alert("Nenhum arquivo selecionado.");
        return;
    }

    const leitor = new FileReader();

    leitor.onload = (e) => {
        const dados = new Uint8Array(e.target.result);
        const workbook = XLSX.read(dados, { type: "array" });
        const primeiraAba = workbook.SheetNames[0];
        const planilha = workbook.Sheets[primeiraAba];
        const dadosPlanilha = XLSX.utils.sheet_to_json(planilha);

        dadosPlanilha.forEach(item => {
            ocorrencias.push({
                id: Date.now() + Math.random(),
                nf: item.NF || "",
                cliente: item.CLIENTE || "",
                transportadora: item.TRANSPORTADORA || "",
                tipo: item.TIPO || "",
                status: item.AÇÃO || "Pendente",
                mtv: item.MOTIVO || "",
                desfecho: item.DESFECHO || "Em andamento",
                valor: paraNumero(item.VALOR),
                perda: paraNumero(item.PERDA),
                dataFinalizacao: item["FINALIZADA EM"]
                    || (item.DESFECHO === "Entregue" ? new Date().toLocaleString("pt-BR") : undefined),
                data: item.DATA || new Date().toLocaleString("pt-BR")
            });
        });

        salvarLocalStorage();
        renderizarTabela();
        alert("Planilha importada com sucesso!");

        // Permite reimportar o mesmo arquivo depois, se necessário.
        evento.target.value = "";
    };

    leitor.onerror = () => alert("Não foi possível ler o arquivo selecionado.");

    leitor.readAsArrayBuffer(arquivo);
}


/* ==================================================================
   INICIALIZAÇÃO
================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    iniciarFiltros();
    renderizarTabela();

    document.getElementById("ocorrenciaForm")
        .addEventListener("submit", adicionarOcorrencia);

    document.getElementById("importarXls")
        .addEventListener("change", importarPlanilha);
});
