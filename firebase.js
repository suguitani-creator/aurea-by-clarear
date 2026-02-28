// Importações Firebase via CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Configuração do seu projeto
const firebaseConfig = {
  apiKey: "AIzaSyAmZyPRKTTsYonZfau3JUdxjAxEOsOjw5c",
  authDomain: "aurea-by-clarear.firebaseapp.com",
  projectId: "aurea-by-clarear",
  storageBucket: "aurea-by-clarear.firebasestorage.app",
  messagingSenderId: "551382080611",
  appId: "1:551382080611:web:0c2182a4384a457bad2c56"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar auth e db
export const auth = getAuth(app);
export const db = getFirestore(app);