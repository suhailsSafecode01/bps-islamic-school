// Reusing your existing "islamic-f6f40" Firebase project.
// We now use REAL Firebase Authentication (email/password method) —
// this is genuinely free forever, no card, no quota. This is different
// from "Email Link" sign-in (which has a 5/day free limit and caused
// our earlier problems) — plain password authentication has no such limit.
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

// Mobile numbers become a "fake" email behind the scenes, since Firebase
// Authentication requires an email format — completely invisible to
// users, who only ever see "mobile number" on screen.
function mobileToEmail(mobile) {
  return `${mobile}@bpsschool.local`;
}

// Cloudinary — used for document uploads instead of Firebase Storage
// (Firebase Storage now requires a paid Blaze plan; Cloudinary's free
// tier needs no card at all). Fill these in after creating a free
// Cloudinary account — see the setup steps you were given.
const CLOUDINARY_CLOUD_NAME = "ctuvsrin";
const CLOUDINARY_UPLOAD_PRESET = "bps-islamic-school";
