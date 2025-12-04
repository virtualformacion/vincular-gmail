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

    // ------------ Lógica Disney+ -----------------
    const disneySubjects = [
      "amazon.com: Sign-in attempt",
      "amazon.com: Intento de inicio de sesión",
      "Amazon password assistance",
      "Your one-time passcode for Disney+",
      "Tu código de acceso único para Disney+"
    ];

    for (let msg of response.data.messages) {
      const message = await gmail.users.messages.get({ userId: "me", id: msg.id });
      const headers = message.data.payload.headers;
      const toHeader = headers.find(h => h.name === "To");
      const subjectHeader = headers.find(h => h.name === "Subject");
      const dateHeader = headers.find(h => h.name === "Date");

      const timestamp = new Date(dateHeader.value).getTime();
      const now = new Date().getTime();

      if (
        toHeader &&
        toHeader.value.toLowerCase().includes(email.toLowerCase()) &&
        disneySubjects.some(subject => subjectHeader.value.includes(subject)) &&
        (now - timestamp) <= 10 * 60 * 1000
      ) {
        const body = getDisneyPlusMessageBody(message.data);
        return { statusCode: 200, body: JSON.stringify({ alert: "Código de Disney+ encontrado", body }) };
      }
    }

    // ------------ Lógica Netflix + Gmail Forward -----------------

    const validSubjects = [
      "Importante: Cómo actualizar tu Hogar con Netflix",
      "Importante: Cómo cambiar tu hogar Netflix",
      "Tu código de acceso temporal de Netflix",
      "Completa tu solicitud de cambio de contraseña",
      "Completa tu solicitud de restablecimiento de contraseña",
      "Confirmación de reenvío de Gmail" // Nuevo asunto
    ];

    const validLinks = [
      "https://www.netflix.com/account/travel/verify?nftoken=",
      "https://www.netflix.com/password?g=",
      "https://www.netflix.com/account/update-primary-location?nftoken=",
      "https://mail.google.com/mail/"  // Nuevo enlace Gmail
    ];

    for (let msg of response.data.messages) {
      const message = await gmail.users.messages.get({ userId: "me", id: msg.id });

      const headers = message.data.payload.headers;
      const toHeader = headers.find(h => h.name === "To");
      const subjectHeader = headers.find(h => h.name === "Subject");
      const dateHeader = headers.find(h => h.name === "Date");

      const timestamp = new Date(dateHeader.value).getTime();
      const now = new Date().getTime();

      if (
        toHeader &&
        toHeader.value.toLowerCase().includes(email.toLowerCase()) &&
        (
          validSubjects.some(subject => subjectHeader.value.includes(subject)) ||
          subjectHeader.value.startsWith("Confirmación de reenvío de Gmail")
        ) &&
        (now - timestamp) <= 10 * 60 * 1000
      ) {
        const body = getNetflixMessageBody(message.data);
        const link = extractLink(body, validLinks);

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


// Función específica Disney+
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

// Función específica Netflix + Gmail forward
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

// Extraer enlaces
function extractLink(text, validLinks) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);

  if (matches) {
    console.log("🔗 Enlaces encontrados:", matches);

    const preferredLinks = [
      "https://www.netflix.com/account/travel/verify?nftoken=",
      "https://www.netflix.com/account/update-primary-location?nftoken=",
      "https://mail.google.com/mail/" // Preferido también
    ];

    const preferred = matches.find(url =>
      preferredLinks.some(valid => url.includes(valid))
    );

    if (preferred) return preferred.replace(/\]$/, "");

    const fallback =
      matches.find(url => url.includes("https://www.netflix.com/password?g=")) ||
      matches.find(url => url.includes("https://mail.google.com/mail/"));

    if (fallback) return fallback.replace(/\]$/, "");
  }

  return null;
}
