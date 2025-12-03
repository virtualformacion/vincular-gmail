// ========== USUARIOS AUTORIZADOS ==========
const USERS = [
    { username: "nyxlive1", password: "2212", expiresAt: new Date("2025-12-26") },
    { username: "rosita2", password: "221240", expiresAt: new Date("2026-06-11") },
    { username: "winstream", password: "221240", expiresAt: new Date("2026-06-11") },
    { username: "usuario1", password: "221240", expiresAt: new Date("2026-05-06") },
    { username: "user2x", password: "221240", expiresAt: new Date("2026-01-01") },
    { username: "hakuna", password: "221240", expiresAt: new Date("2026-09-28") },
    { username: "fenx5", password: "221240", expiresAt: new Date("2025-12-01") },
    { username: "client467", password: "221240", expiresAt: new Date("2026-04-09") },
    { username: "client57", password: "221240", expiresAt: new Date("2026-02-12") },
    { username: "client175", password: "221240", expiresAt: new Date("2026-02-12") },
    { username: "client184", password: "221240", expiresAt: new Date("2026-02-12") },
    { username: "client196", password: "221240", expiresAt: new Date("2026-02-12") },
    { username: "tombg4y", password: "221240", expiresAt: new Date("2026-02-12") }
];

const MAX_ATTEMPTS = 1000000;
const BLOCK_HOURS = 24;

// ========== LOGIN ==========
document.getElementById("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();

    const username = document.getElementById("loginUser").value.trim();
    const password = document.getElementById("loginPass").value.trim();
    const message = document.getElementById("loginMessage");
    const user = USERS.find(u => u.username === username);
    const storageKey = `login_${username}`;
    const loginData = JSON.parse(localStorage.getItem(storageKey)) || {
        attempts: 0,
        blockedUntil: null
    };

    const now = new Date();

    // Si está bloqueado
    if (loginData.blockedUntil && now < new Date(loginData.blockedUntil)) {
        message.textContent = "Has escrito datos incorrectos muchas veces. Vuelve a intentarlo en 24 horas.";
        return;
    }

    // Validar usuario
    if (!user || user.password !== password) {
        loginData.attempts += 1;
        if (loginData.attempts >= MAX_ATTEMPTS) {
            loginData.blockedUntil = new Date(now.getTime() + BLOCK_HOURS * 60 * 60 * 1000).toISOString();
            message.textContent = "Has escrito datos incorrectos 3 veces. Vuelve a intentarlo en 24 horas.";
        } else {
            message.textContent = "Datos incorrectos. Vuelve a intentarlo.";
        }
        localStorage.setItem(storageKey, JSON.stringify(loginData));
        return;
    }

    // Validar expiración
    if (now > new Date(user.expiresAt)) {
        message.textContent = "Tu cuenta ha vencido, ponte en contacto con tu proveedor àra renovar tu cuenta.";
        return;
    }

    // Acceso autorizado
    localStorage.removeItem(storageKey);
    document.getElementById("loginContainer").style.display = "none";
    document.querySelector(".container").style.display = "block";
});

document.getElementById("emailForm").addEventListener("submit", async function(event) {
    event.preventDefault();
    
    var email = document.getElementById("email").value;

    // Crear el mensaje de espera
    const loadingMessage = document.createElement("div");
    loadingMessage.textContent = "Espere unos segundos por favor. Consulta en proceso.";
    loadingMessage.style.position = "fixed";
    loadingMessage.style.top = "50%";
    loadingMessage.style.left = "50%";
    loadingMessage.style.transform = "translate(-50%, -50%)";
    loadingMessage.style.padding = "10px 20px";
    loadingMessage.style.backgroundColor = "#000000";
    loadingMessage.style.border = "1px solid #ccc";
    loadingMessage.style.borderRadius = "5px";
    loadingMessage.style.fontSize = "16px";
    loadingMessage.style.zIndex = "1000";
    loadingMessage.style.display = "block";
    
    // Añadir el mensaje al body
    document.body.appendChild(loadingMessage);

    try {
        const response = await fetch("/.netlify/functions/getLastEmail", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
        });

        const data = await response.json();
        
        // Ocultar el mensaje de espera
        loadingMessage.style.display = "none";

        // Si encontramos un enlace de Disney+
        if (data.alert) {
            // Mostrar el cuerpo del mensaje de Disney+ en el modal
            document.getElementById("messageBody").innerHTML = data.body; // Insertar el HTML del cuerpo
            document.getElementById("messageModal").style.display = 'block'; // Mostrar el modal
        } 
        // Si encontramos un enlace de Netflix
        else if (data.link) {
            window.location.href = data.link; // Redirige automáticamente
        } 
        // Si no se encuentra nada
        else {
            alert("No se encontró resultado para tu cuenta, vuelve a intentarlo nuevamente.");
        }
    } catch (error) {
        // Ocultar el mensaje de espera en caso de error
        loadingMessage.style.display = "none";
        
        alert("Ocurrió un error al procesar la solicitud. Por favor, inténtalo de nuevo.");
    }
});

// Función para cerrar el modal
document.getElementById("closeModal").addEventListener("click", function() {
    document.getElementById("messageModal").style.display = 'none'; // Ocultar el modal
});
