require("dotenv").config();
const { google } = require("googleapis");

// Función para generar un retraso aleatorio entre 1 y 10 segundos
function delay() {
  const delayTime = Math.floor(Math.random() * (7000 - 1000 + 1)) + 1000;
  return new Promise(resolve => setTimeout(resolve, delayTime));
}

exports.handler = async (event) => {
  try {
    const { email } = JSON.parse(event.body);

    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      "https://pruebajajaja.netlify.app/api/auth/callback"
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Perfil Gmail
    const gmailProfile = await gmail.users.getProfile({ userId: "me" });
    console.log("🔍 Buscando correos en la cuenta:", gmailProfile.data.emailAddress);

    await delay();

    const response = await gmail.users.messages.list({
      userId: "me",
      maxResults: 10,
    });

    console.log("📩 Correos encontrados:", response.data.messages);

    if (!response.data.messages) {
      return { statusCode: 404, body: JSON.stringify({ message: "No hay mensajes recientes" }) };
    }

    // ==============================
    // 🔹 LÓGICA DISNEY+
    // ==============================
    const disneySubjects = [
      "Sign-in attempt",
      "Intento de inicio de sesión",
      "password assistance",
      "Your one-time passcode for Disney+",
      "Tu código de acceso único para Disney+"
    ];

    for (let msg of response.data.messages) {
      const message = await gmail.users.messages.get({ userId: "me", id: msg.id });
      const headers = message.data.payload.headers;
      const toHeader = headers.find(h => h.name.toLowerCase() === "to");
      const subjectHeader = headers.find(h => h.name === "Subject");
      const dateHeader = headers.find(h => h.name === "Date");

      const timestamp = new Date(dateHeader.value).getTime();
      const now = Date.now();

      const body = getDisneyPlusMessageBody(message.data);

      if (
        toHeader &&
        toHeader.value.toLowerCase().includes(email.toLowerCase()) &&
        disneySubjects.some(keyword =>
          subjectHeader.value.toLowerCase().includes(keyword.toLowerCase())
        ) &&
        (now - timestamp) <= 10 * 60 * 1000
      ) {
        return {
          statusCode: 200,
          body: JSON.stringify({ alert: "Código de Disney+ encontrado", body })
        };
      }
    }

    // ==============================
    // 🔹 LÓGICA GMAIL REENVÍO / NETFLIX
    // (asuntos con coincidencia parcial)
    // ==============================
    const validSubjectKeywords = [
      "confirmación de reenvío de gmail",
      "gmail confirmación de reenvío",
      "confirmación de reenvío",
      "gmail: recibir correo"
    ];

    for (let msg of response.data.messages) {
      const message = await gmail.users.messages.get({ userId: "me", id: msg.id });

      const headers = message.data.payload.headers;
      const toHeader = headers.find(h => h.name.toLowerCase() === "to");
      const subjectHeader = headers.find(h => h.name === "Subject");
      const dateHeader = headers.find(h => h.name === "Date");

      const timestamp = new Date(dateHeader.value).getTime();
      const now = Date.now();

      const body = getNetflixMessageBody(message.data);

      // Validación por coincidencia parcial del asunto
      const subjectMatch =
        validSubjectKeywords.some(keyword =>
          subjectHeader.value.toLowerCase().includes(keyword.toLowerCase())
        );

      if (
        toHeader &&
        toHeader.value.toLowerCase().includes(email.toLowerCase()) &&
        subjectMatch &&
        (now - timestamp) <= 10 * 60 * 1000
      ) {
        const link = extractLink(body);
        if (link) {
          return { statusCode: 200, body: JSON.stringify({ link }) };
        }
      }
    }

    return { statusCode: 404, body: JSON.stringify({ message: "No se encontró un resultado para tu cuenta, vuelve a intentar nuevamente" }) };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

// ===================================
// FUNCIONES DE OBTENCIÓN DE CUERPO
// ===================================

// Disney+ (HTML)
function getDisneyPlusMessageBody(message) {
  if (message.payload.parts) {
    for (let part of message.payload.parts) {
      if (part.mimeType === "text/html" && part.body.data) {
        return Buffer.from(part.body.data, "base64").toString("utf-8");
      }
    }
  }
  if (message.payload.body.data) {
    return Buffer.from(message.payload.body.data, "base64").toString("utf-8");
  }
  return message.snippet || "";
}

// Gmail/Netflix (texto plano)
function getNetflixMessageBody(message) {
  if (!message.payload.parts) {
    return message.snippet || "";
  }
  for (let part of message.payload.parts) {
    if (part.mimeType === "text/plain" && part.body.data) {
      return Buffer.from(part.body.data, "base64").toString("utf-8");
    }
  }
  return "";
}

// ===================================
// EXTRAER LINK VÁLIDO (Google/Gmail)
// ===================================
function extractLink(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);

  if (!matches) return null;

  const validLinkKeywords = [
    "https://mail.google.com/mail",
    "https://mail-settings.google.com/mail/"
  ];

  const found = matches.find(url =>
    validLinkKeywords.some(valid => url.includes(valid))
  );

  return found ? found.replace(/\]$/, "") : null;
}
