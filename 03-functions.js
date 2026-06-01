// ===============================
// BANCO DE DADOS TEMPORÁRIO
// ===============================

let ocorrencias = JSON.parse(localStorage.getItem("ocorrencias")) || []


// ===============================
// FUNÇÃO PARA EDITAR OCORRÊNCIAS
// ===============================

let idEmEdicao = null
let backupOcorrencias = null
let undoTimeout = null

// ====== CONFIGURAÇÃO DO PISCAR ======
const BLINK_DURATION = 0.9 // segundos
const BLINK_COUNT = 1 // número de repetições
const BLINK_OPACITY = 0.3 // opacidade da cor (0..1)

// ===============================
// FUNÇÃO PARA ADICIONAR OCORRÊNCIA
// ===============================
function salvarLocalStorage(){

    localStorage.setItem("ocorrencias",JSON.stringify(ocorrencias))
}

// ===============================
// NOVAS LINHAS ADICIONADAS PISCAM EM ALGUMA COR SELECIONADA 
// ===============================
function randomColor(){
    const r = Math.floor(Math.random()*255)
    const g = Math.floor(Math.random()*255)
    const b = Math.floor(Math.random()*255)
     return `rgba(${r},${g},${b},${BLINK_OPACITY})`
}

function highlightRow(id){
    const row = document.querySelector(`tr[data-id="${id}"]`)
    if(!row) return
    const color = randomColor()
    row.style.setProperty('--blink-color', color)
    row.style.animation = `blink ${BLINK_DURATION}s ease-in-out 0s ${BLINK_COUNT}`
    row.classList.add('blink-highlight')
    row.addEventListener('animationend', ()=>{
        row.classList.remove('blink-highlight')
        row.style.removeProperty('--blink-color')
        row.style.removeProperty('animation')
    }, { once: true })
}


function adicionarOcorrencia(){


    // ===============================
    // CAPTURAR VALORES DOS INPUTS
    // ===============================

    const nf =
        document.getElementById("nf").value

    const transportadora =
        document.getElementById("transportadora").value

    const tipo =
        document.getElementById("tipo").value

    const status =
        document.getElementById("status").value

    const mtv =
        document.getElementById("mtv").value

    const cliente =
        document.getElementById("cliente").value

    let newAddedId = null

   


    // ===============================
    // VALIDAR CAMPOS OBRIGATÓRIOS
    // ===============================

    if(!nf || !transportadora || !tipo){

        alert("Preencha os campos obrigatórios.")

        return
    }

// ===============================
// CRIAR OU EDITAR OCORRÊNCIA
// ===============================

if(idEmEdicao !== null){

    const ocorrenciaIndex =
        ocorrencias.findIndex(
            item => item.id === idEmEdicao
        )

    ocorrencias[ocorrenciaIndex] = {

        ...ocorrencias[ocorrenciaIndex],

        nf: nf,

        transportadora: transportadora,

        tipo: tipo,

        status: status,

        mtv: mtv,

        cliente: cliente
    }

    idEmEdicao = null
    
    document
    .getElementById("formCard")
    .classList.remove("editando")

}else{

    const ocorrencia = {

        id: Date.now(),

        nf: nf,

        transportadora: transportadora,

        tipo: tipo,

        status: status,

        mtv: mtv,

        cliente: cliente,

        data: new Date().toLocaleString("pt-BR")
    }

    ocorrencias.push(ocorrencia)
    newAddedId = ocorrencia.id
}

    // ===============================
    // SALVAR OCORRÊNCIA NO ARRAY
    // ===============================

    salvarLocalStorage()

    // ===============================
    // MOSTRAR ARRAY NO CONSOLE
    // ===============================

    console.log(ocorrencias)


    // ===============================
    // RENDERIZAR TABELA
    // ===============================

    renderizarTabela()
    if(newAddedId){
        setTimeout(()=> highlightRow(newAddedId), 50)
    }
}

// ===============================
        // FUNÇÃO PARA ABRIR FORMULÁRIO
// ===============================

function openForm(){

    document.getElementById(
        "formCard"
    ).style.display = "block"
}

// ===============================
// FUNÇÃO PARA RENDERIZAR TABELA
// ===============================

function renderizarTabela(){

    // ===============================
    // ABRE O FORMULÁRIO PARA ADICIONAR OCORRÊNCIA
    // ===============================

    openForm()

    // ===============================
    // PEGAR O TBODY DA TABELA
    // ===============================

    const tabela =
        document.getElementById("tabelaOcorrencias")


    // ===============================
    // LIMPAR TABELA
    // ===============================

    tabela.innerHTML = ""


    // ===============================
    // PERCORRER OCORRÊNCIAS
    // ===============================

    ocorrencias.forEach(item => {


        // ===============================
        // CRIAR LINHA
        // ===============================

        const linha =
            document.createElement("tr");
        linha.dataset.id = item.id


        // ===============================
        // CONTEÚDO DA LINHA
        // ===============================

        linha.innerHTML = `
            
            <td>${item.nf}</td>

            <td>${item.transportadora}</td>

            <td>${item.tipo}</td>

            <td>
               <span class="status ${item.status}">
               ${item.status}
               </span>
            </td>

            <td>${item.data}</td>

            <td>
                <button class="deleteBtn" onclick="deletarOcorrencia('${item.id}')">
                <i class="bi bi-trash-fill"></i>
                    Deletar
                </button>
            </td>

            <td>
              
            <button class="editBtn" onclick = "editarOcorrencia(${item.id})">
            <i class="bi bi-pencil-square"></i>
                Editar
            </button>
        </td>

        `
        // ===============================
        // ADICIONAR LINHA NA TABELA
        // ===============================

        tabela.appendChild(linha)
        

    })

}

// ===============================
        // FUNÇÃO PARA EDITAR OCORRÊNCIA APENAS QUANDO FOR SELECIONADA
// ===============================


function editarOcorrencia(id){
    const ocorrencia = ocorrencias.find(item => item.id === id)
    if(ocorrencia){

        document.getElementById("nf").value = ocorrencia.nf 
        document.getElementById("transportadora").value = ocorrencia.transportadora
        document.getElementById("tipo").value = ocorrencia.tipo
        document.getElementById("status").value = ocorrencia.status
        document.getElementById("mtv").value = ocorrencia.mtv
        document.getElementById("cliente").value = ocorrencia.cliente

        idEmEdicao = id;
        document
        .getElementById("formCard")
        .classList.add("editando")

        openForm()
    }
}


// ===============================
    // DELETAR OCORRÊNCIA APENAS QUANDO FOR SELECIONADA
// ===============================

function deletarOcorrencia(id){

    const idString = String(id)

    const index =
        ocorrencias.findIndex(
            item => String(item.id) === idString
        )

    if(index === -1){

        alert("Ocorrência não encontrada.")

        return
    }

    if(confirm("Tem certeza que deseja deletar a ocorrência selecionada?")){

        backupOcorrencias = [...ocorrencias]

        ocorrencias.splice(index, 1)

        salvarLocalStorage()

        renderizarTabela()

        mostrarUndo("Ocorrência removida.")
    }
}

// ===============================
// DELETAR DELETAR TODAS AS OCORRÊNCIAS 
// ===============================

function delAll(){

    if(ocorrencias.length === 0){

        alert("Não há ocorrências para apagar.")

        return
    }

    if(confirm("Tem certeza que deseja apagar todas as ocorrências?")){

        backupOcorrencias = [...ocorrencias]

        ocorrencias = []

        salvarLocalStorage()

        renderizarTabela()

        mostrarUndo("Todas as ocorrências foram removidas.")
    }
}

// ===============================
// DESFAZER AÇÃO DE DELETAR 
// ===============================

function mostrarUndo(mensagem){

    const toast =
        document.getElementById("undoToast")

    if(!toast){
        console.error("Elemento #undoToast não encontrado.")
        return
    }

    const progress =
        toast.querySelector(".undo-progress")

    document.getElementById(
        "undoMessage"
    ).textContent = mensagem

    toast.classList.add("show")

    progress.classList.remove("animate")

    void progress.offsetWidth

    progress.classList.add("animate")

    clearTimeout(undoTimeout)

    undoTimeout = setTimeout(() => {

        backupOcorrencias = null

        toast.classList.remove("show")

    }, 5000)
}



// ===============================
// DESFAZER EXCLUSÃO
// ===============================

function desfazerExclusao(){

    if(!backupOcorrencias){
        return
    }

    ocorrencias = [...backupOcorrencias]

    salvarLocalStorage()

    renderizarTabela()          

    backupOcorrencias = null

    clearTimeout(undoTimeout)

    document
        .getElementById("undoToast")
        .classList.remove("show")
}

// ===============================
// RENDERIZAR DADOS AO ABRIR
// ===============================

renderizarTabela()

// ===============================
// FUNÇÃO PARA EXPORTAR DADOS PARA EXCEL
// ===============================

function exportXls(){

// ==========================================
// FORMATAR DADOS
// ==========================================

    const dadosFormatados =

        ocorrencias.map(item => ({

            "NF": item.nf,

            "CLIENTE": item.cliente,

            "TRANSPORTADORA": item.transportadora,

            "TIPO": item.tipo,

            "DATA": item.data,

            "AÇÃO": item.status,

            "MOTIVO": item.mtv,

        }))

    // ==========================================
    // CRIAR PLANILHA
    // ==========================================

    const planilha =

        XLSX.utils.json_to_sheet(
            dadosFormatados
        )



    // ==========================================
    // CRIAR WORKBOOK
    // ==========================================

    const workbook =

        XLSX.utils.book_new()

    // ==========================================
    // ADICIONAR PLANILHA
    // ==========================================

    XLSX.utils.book_append_sheet(

        workbook,

        planilha,

        "Ocorrencias"
    )



    // ==========================================
    // EXPORTAR ARQUIVO
    // ==========================================

    XLSX.writeFile(

        workbook,

        "Ocorrencias_Logistica.xlsx"
    )
}


// ==========================================
// IMPORTAR ARQUIVO
// ==========================================

document
    .getElementById("importarXls")
    .addEventListener("change", importarPlanilha)



function importarPlanilha(event){

    const arquivo = event.target.files[0]

    if(!arquivo){

        alert("Nenhum arquivo selecionado.")

        return
    }

    const leitor = new FileReader()

    
    // ===============================
    // LER ARQUIVO
    // ===============================

    leitor.onload = function(e){

        const dados = new Uint8Array(e.target.result)

        
        // ===============================
        // LER WORKBOOK
        // ===============================

        const workbook = XLSX.read(dados, {
            type: "array"
        })

        
        // ===============================
        // PEGAR PRIMEIRA PLANILHA
        // ===============================

        const primeiraAba =
            workbook.SheetNames[0]

        const planilha =
            workbook.Sheets[primeiraAba]

        
        // ===============================
        // CONVERTER PARA JSON
        // ===============================

        const dadosPlanilha =
            XLSX.utils.sheet_to_json(planilha)

        console.log(dadosPlanilha)

        
        // ===============================
        // ADICIONAR DADOS AO ARRAY
        // ===============================

        dadosPlanilha.forEach(item => {

            ocorrencias.push({

                id: Date.now() + Math.random(),

                nf: item.NF || "",

                cliente: item.CLIENTE || "",

                transportadora:
                    item.TRANSPORTADORA || "",

                tipo: item.TIPO || "",

                status: item.AÇÃO || "Pendente",

                mtv: item.MOTIVO || "",

                data:
                    item.DATA ||
                    new Date().toLocaleString("pt-BR")
            })

        })

        
        // ===============================
        // SALVAR E RENDERIZAR
        // ===============================

        salvarLocalStorage()

        renderizarTabela()

        alert("Planilha importada com sucesso!")
    }

    
    // ===============================
    // LER COMO ARRAY BUFFER
    // ===============================

    leitor.readAsArrayBuffer(arquivo)
}
