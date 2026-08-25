"use strict";

/* ==================================================================
   HELPER.LOG — AUTENTICAÇÃO LOCAL
   ------------------------------------------------------------------
   Sistema simples de login baseado em localStorage/sessionStorage.
   Não substitui um backend real (qualquer pessoa com acesso ao
   navegador pode limpar os dados), mas garante que a tela de
   ocorrências só seja aberta depois de um login válido. Simples, somente
   para tarefas repetitivas do dia-a-dia e ajuda a evitar multiplas planilhas em aberto.
   

   - localStorage  -> guarda a conta (usuário + hash da senha),
                       sobrevive ao fechar o navegador.
   - sessionStorage -> guarda a sessão ativa, dura só a aba atual.
================================================================== */

const AUTH_STORAGE_KEY    = "helperlog_conta";
const SESSION_STORAGE_KEY = "helperlog_sessao";
const PAGINA_APOS_LOGIN   = "hub2.html";
const PAGINA_APOS_LOGOUT  = "hub1.html";

/* ------------------------------------------------------------------
   UTILITÁRIOS DE CONTA
------------------------------------------------------------------ */

/**
 * Gera um hash SHA-256 (hexadecimal) de um texto.
 * Evita salvar a senha em texto puro no localStorage.
 */
async function gerarHash(texto) {
    const bytes = new TextEncoder().encode(texto);
    const buffer = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(buffer))
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}

function obterContaSalva() {
    const bruto = localStorage.getItem(AUTH_STORAGE_KEY);
    return bruto ? JSON.parse(bruto) : null;
}

function salvarConta(usuario, hashSenha) {
    localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ usuario, hashSenha })
    );
}

/* ------------------------------------------------------------------
   UTILITÁRIOS DE SESSÃO
------------------------------------------------------------------ */

function iniciarSessao(usuario) {
    sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ usuario, inicio: Date.now() })
    );
}

function sessaoAtiva() {
    return sessionStorage.getItem(SESSION_STORAGE_KEY) !== null;
}

function encerrarSessao() {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    window.location.href = PAGINA_APOS_LOGOUT;
}

/**
 * Bloqueia o acesso a páginas internas quando não há sessão ativa.
 * Deve ser chamada no <head>, antes do <body> ser desenhado, para
 * a página protegida não "piscar" antes do redirecionamento.
 */
function exigirLogin() {
    if (!sessaoAtiva()) {
        window.location.replace(PAGINA_APOS_LOGOUT);
    }
}

/* ------------------------------------------------------------------
   FORMULÁRIO DE LOGIN (hub1.html)
------------------------------------------------------------------ */

function exibirMensagemLogin(elemento, texto, ehErro) {
    if (!elemento) return;
    elemento.textContent = texto;
    elemento.classList.toggle("erro", ehErro);
    elemento.classList.add("visivel");
}

function inicializarFormularioLogin() {
    const formulario = document.getElementById("loginForm");
    if (!formulario) return;

    // Já logado? Pula direto para o sistema.
    if (sessaoAtiva()) {
        window.location.replace(PAGINA_APOS_LOGIN);
        return;
    }

    const campoUsuario = document.getElementById("user");
    const campoSenha   = document.getElementById("password");
    const feedback     = document.getElementById("loginError");

    if (!obterContaSalva()) {
        exibirMensagemLogin(
            feedback,
            "Nenhuma conta encontrada neste dispositivo. Preencha os campos para criar seu acesso.",
            false
        );
    }

    formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        const usuario = campoUsuario.value.trim();
        const senha   = campoSenha.value;

        if (!usuario || !senha) {
            exibirMensagemLogin(feedback, "Preencha usuário e senha.", true);
            return;
        }

        const contaExistente = obterContaSalva();
        const hashDigitado   = await gerarHash(senha);

        // Primeiro acesso: a própria tentativa de login cria a conta.
        if (!contaExistente) {
            salvarConta(usuario, hashDigitado);
            iniciarSessao(usuario);
            window.location.href = PAGINA_APOS_LOGIN;
            return;
        }

        const usuarioConfere = contaExistente.usuario.toLowerCase() === usuario.toLowerCase();
        const senhaConfere   = contaExistente.hashSenha === hashDigitado;

        if (usuarioConfere && senhaConfere) {
            iniciarSessao(usuario);
            window.location.href = PAGINA_APOS_LOGIN;
        } else {
            exibirMensagemLogin(feedback, "Usuário ou senha incorretos.", true);
            campoSenha.value = "";
            campoSenha.focus();
        }
    });
}

document.addEventListener("DOMContentLoaded", inicializarFormularioLogin);
