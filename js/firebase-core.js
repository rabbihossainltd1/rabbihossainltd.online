import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA7VMETaS1R4hq1WUBXgsVnvgEyzFhKGfs",
  authDomain: "rabbihossainltd-63709.firebaseapp.com",
  projectId: "rabbihossainltd-63709",
  storageBucket: "rabbihossainltd-63709.firebasestorage.app",
  messagingSenderId: "658498014345",
  appId: "1:658498014345:web:89db9e029a6930d3e2ca58",
  measurementId: "G-RT4WQL8R0H"
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
