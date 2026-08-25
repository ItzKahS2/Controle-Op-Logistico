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
        cliente: document.getElementById("cliente").value.trim()
    };
}

function limparFormulario() {
    document.getElementById("nf").value = "";
    document.getElementById("transportadora").value = "";
    document.getElementById("tipo").value = "";
    document.getElementById("status").value = "Pendente";
    document.getElementById("mtv").value = "";
    document.getElementById("cliente").value = "";
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
            ocorrencias[indice] = { ...ocorrencias[indice], ...dados };
        }

        sairDoModoEdicao();
    } else {
        const novaOcorrencia = {
            id: Date.now(),
            ...dados,
            data: new Date().toLocaleString("pt-BR")
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

    idEmEdicao = id;
    document.getElementById("formCard").classList.add("editando");
    document.getElementById("nf").focus();
}


/* ==================================================================
   TABELA
================================================================== */

function renderizarTabela() {
    const tabela = document.getElementById("tabelaOcorrencias");
    tabela.innerHTML = "";

    ocorrencias.forEach(item => {
        const linha = document.createElement("tr");
        linha.dataset.id = item.id;

        linha.innerHTML = `
            <td>${escapeHtml(item.nf)}</td>
            <td>${escapeHtml(item.transportadora)}</td>
            <td>${escapeHtml(item.tipo)}</td>
            <td>
                <span class="status ${escapeHtml(item.status)}">
                    ${escapeHtml(item.status)}
                </span>
            </td>
            <td>${escapeHtml(item.data)}</td>
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
        "MOTIVO": item.mtv
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
    renderizarTabela();

    document.getElementById("ocorrenciaForm")
        .addEventListener("submit", adicionarOcorrencia);

    document.getElementById("importarXls")
        .addEventListener("change", importarPlanilha);
});
