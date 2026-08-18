import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getDatabase } from "firebase/database";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

export const firebaseConfig = {
    apiKey: "AIzaSyBUyM6Ep-hY6wQthp8IBo5wg0qHqMBlwek",
    authDomain: "ai-filmmaking-spectrum.firebaseapp.com",
    databaseURL: "https://ai-filmmaking-spectrum-default-rtdb.firebaseio.com",
    projectId: "ai-filmmaking-spectrum",
    storageBucket: "ai-filmmaking-spectrum.firebasestorage.app",
    messagingSenderId: "384429643425",
    appId: "1:384429643425:web:66f5fd3c2bd52ccd6702e0",
    measurementId: "G-7WXWDMKW8R",
};

export const app = initializeApp(firebaseConfig);
export let analytics = null;
if (typeof window !== "undefined" && typeof indexedDB !== "undefined") {
    isSupported().then((supported) => {
        if (supported) analytics = getAnalytics(app);
    }).catch(() => {});
}

export const db = getDatabase(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
