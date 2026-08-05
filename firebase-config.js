// ============================================================
// PASTE YOUR FIREBASE CONFIG HERE
// Get this from: Firebase Console → Project Settings → General
// → scroll to "Your apps" → Web app → the firebaseConfig object
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyADcACNlH5etv8rVhd8DtX5jmgdVDOokRs",
  authDomain: "islamic-f6f40.firebaseapp.com",
  projectId: "islamic-f6f40",
  storageBucket: "islamic-f6f40.firebasestorage.app",
  messagingSenderId: "663854937617",
  appId: "1:663854937617:web:f2451a9657a62c55e2e3b0",
  measurementId: "G-JZ99WW0W30",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
