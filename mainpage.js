// ===============================
// SISTEMA DE USUARIOS E LOGIN
// ===============================

const usuarios = [
    {
        usuario: "kaique",
        senha: "123456",
        nome: "Kaique Costa",
        nivel: "Administrador"
    },
    {
        usuario: "logistica",
        senha: "italac2026",
        nome: "Equipe Logística",
        nivel: "Operador"
    }
];

document.getElementById("loginForm").addEventListener("submit", function(e){
    e.preventDefault();

    const usuario = document.getElementById("user").value;
    const senha = document.getElementById("password").value;

    const usuarioEncontrado = usuarios.find(u =>
        u.usuario === usuario &&
        u.senha === senha
    );

    if(usuarioEncontrado){
        localStorage.setItem("usuarioLogado", JSON.stringify(usuarioEncontrado));
        window.location.href = "index.html";
    } else {
        alert("Usuário ou senha inválidos.");
    }
});
