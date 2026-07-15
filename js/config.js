// Editá únicamente este archivo para cambiar participantes, días y horarios.
export const PARTICIPANTES = [
  { id: "rodrigo", nombre: "Rodrigo" },
  { id: "alvaro", nombre: "Alvaro" },
  { id: "mauro", nombre: "Mauro" },
  { id: "pierina", nombre: "Pierina" },
  { id: "martin", nombre: "Martín" },
  { id: "daniel", nombre: "Daniel" },
  { id: "ivanna", nombre: "Ivanna" },
  { id: "cecilia", nombre: "Cecilia" },
  { id: "johana", nombre: "Johana" },
];

export const DIAS = [
  { id: "lunes", nombre: "Lunes" },
  { id: "martes", nombre: "Martes" },
  { id: "miercoles", nombre: "Miércoles" },
  { id: "jueves", nombre: "Jueves" },
  { id: "viernes", nombre: "Viernes" },
  { id: "sabado", nombre: "Sábado" },
  { id: "domingo", nombre: "Domingo" },
];

export const HORAS = ["18:00", "19:00", "20:00", "21:00"];

// Reemplazá estos valores por los que entrega Firebase al registrar la app web.
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC4j8n20R8KxPe9jKWQkxHFF6fo5wTaYdY",

  authDomain: "antel-voley.firebaseapp.com",

  databaseURL: "https://antel-voley-default-rtdb.firebaseio.com",

  projectId: "antel-voley",

  storageBucket: "antel-voley.firebasestorage.app",

  messagingSenderId: "86551310983",

  appId: "1:86551310983:web:08a0a67484bfd4e0d6be22",

  measurementId: "G-Z30SYLSHKD"

};

// Permite alojar varios grupos en la misma base si alguna vez fuera necesario.
export const ID_GRUPO = "antel-voley";
