// Reusing your existing "islamic-f6f40" Firebase project — its Firestore
// database is already set up and working. We are NOT using Firebase
// Authentication at all anymore, so no email/SMS quota can ever apply.
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
const db = firebase.firestore();
