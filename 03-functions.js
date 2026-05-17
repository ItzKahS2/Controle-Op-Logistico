// ===============================
// BANCO DE DADOS TEMPORÁRIO
// ===============================

let ocorrencias =
    JSON.parse(localStorage.getItem("ocorrencias")) || []


// ===============================
// FUNÇÃO PARA EDITAR OCORRÊNCIAS
// ===============================

let idEmEdicao = null

// ===============================
// FUNÇÃO PARA ADICIONAR OCORRÊNCIA
// ===============================
function salvarLocalStorage(){

    localStorage.setItem(
        "ocorrencias",
        JSON.stringify(ocorrencias)
    )
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
            document.createElement("tr")


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
                <button class="deleteBtn" onclick="deletarOcorrencia(${item.id})">
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

        openForm()
    }
}


// ===============================
        // DELETAR OCORRÊNCIA APENAS QUANDO FOR SELECIONADA
// ===============================

 function deletarOcorrencia(id){

    if(ocorrencias.length === 0){

        alert("Não há ocorrências para deletar.")   
    }
        else{
            if(confirm("Tem certeza que deseja deletar a ocorrência selecionada?")){
                ocorrencias.pop();
                salvarLocalStorage();
                renderizarTabela();
            }
        }
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