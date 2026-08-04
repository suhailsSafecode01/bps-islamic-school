// ============================================================
// PASTE YOUR FIREBASE CONFIG HERE
// Get this from: Firebase Console → Project Settings → General
// → scroll to "Your apps" → Web app → the firebaseConfig object
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyApl3e7X-Iid6mba7tgEFsGR0B0n4WNRXA",
  authDomain: "bps-islamic-school-d95d7.firebaseapp.com",
  projectId: "bps-islamic-school-d95d7",
  storageBucket: "bps-islamic-school-d95d7.firebasestorage.app",
  messagingSenderId: "177285025685",
  appId: "1:177285025685:web:de499937b0c89dace5709c",
  measurementId: "G-6QVWXZEH7B",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
