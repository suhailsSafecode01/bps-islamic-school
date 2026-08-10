// ---------- DOM ----------
const splashScreen = document.getElementById("splashScreen");
const authScreen = document.getElementById("authScreen");

const tabSignIn = document.getElementById("tabSignIn");
const tabRegister = document.getElementById("tabRegister");
const signInCard = document.getElementById("signInCard");
const registerCard = document.getElementById("registerCard");
const pendingCard = document.getElementById("pendingCard");
const rejectedCard = document.getElementById("rejectedCard");

const loginMobile = document.getElementById("loginMobile");
const loginPassword = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");
const loginStatus = document.getElementById("loginStatus");

const regName = document.getElementById("regName");
const regMobile = document.getElementById("regMobile");
const regAdmission = document.getElementById("regAdmission");
const regPassword = document.getElementById("regPassword");
const registerBtn = document.getElementById("registerBtn");
const registerStatus = document.getElementById("registerStatus");

const pendingBackBtn = document.getElementById("pendingBackBtn");
const rejectedBackBtn = document.getElementById("rejectedBackBtn");

const AUTH_CARDS = [signInCard, registerCard, pendingCard, rejectedCard];

function showAuthCard(card) {
  AUTH_CARDS.forEach((c) => c.classList.toggle("hidden", c !== card));
}

function showScreen(name) {
  splashScreen.classList.toggle("hidden", name !== "splash");
  authScreen.classList.toggle("hidden", name !== "auth");
}

function normalizeMobile(raw) {
  return raw.replace(/\D/g, "");
}

// ---------- TABS ----------
tabSignIn.addEventListener("click", () => {
  tabSignIn.classList.add("active");
  tabRegister.classList.remove("active");
  showAuthCard(signInCard);
});
tabRegister.addEventListener("click", () => {
  tabRegister.classList.add("active");
  tabSignIn.classList.remove("active");
  showAuthCard(registerCard);
});
pendingBackBtn.addEventListener("click", () => {
  auth.signOut();
  tabSignIn.click();
});
rejectedBackBtn.addEventListener("click", () => {
  auth.signOut();
  tabSignIn.click();
});

// ---------- LOGIN ----------
async function handleLogin() {
  const mobile = normalizeMobile(loginMobile.value);
  const password = loginPassword.value;

  if (mobile.length !== 10) {
    loginStatus.textContent = "Please enter a valid 10-digit mobile number.";
    return;
  }
  if (!password) {
    loginStatus.textContent = "Please enter your password.";
    return;
  }

  loginBtn.disabled = true;
  loginStatus.textContent = "Signing in…";
  suppressAutoRedirect = true;

  try {
    const cred = await auth.signInWithEmailAndPassword(mobileToEmail(mobile), password);
    const snap = await db.collection("users").doc(cred.user.uid).get();

    if (!snap.exists) {
      loginStatus.textContent = "Account not found. Please contact the school office.";
      await auth.signOut();
      suppressAutoRedirect = false;
      loginBtn.disabled = false;
      return;
    }
    const data = snap.data();

    if (data.status === "pending") {
      showAuthCard(pendingCard);
      suppressAutoRedirect = false;
      loginBtn.disabled = false;
      loginStatus.textContent = "";
      return;
    }
    if (data.status === "rejected") {
      showAuthCard(rejectedCard);
      suppressAutoRedirect = false;
      loginBtn.disabled = false;
      loginStatus.textContent = "";
      return;
    }

    window.location.href = "dashboard.html";
  } catch (err) {
    console.error(err);
    suppressAutoRedirect = false;
    let msg = "Sign-in failed. Please check your mobile number and password.";
    if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential" || err.code === "auth/invalid-login-credentials") {
      msg = "No account found with that mobile number and password.";
    } else if (err.code === "auth/wrong-password") {
      msg = "Incorrect password. Please try again.";
    } else if (err.code === "auth/too-many-requests") {
      msg = "Too many attempts. Please wait a bit and try again.";
    }
    loginStatus.textContent = msg;
    loginBtn.disabled = false;
  }
}
loginBtn.addEventListener("click", handleLogin);
loginPassword.addEventListener("keydown", (e) => { if (e.key === "Enter") handleLogin(); });

// ---------- REGISTER (Parent) ----------
async function handleRegister() {
  const name = regName.value.trim();
  const mobile = normalizeMobile(regMobile.value);
  const admission = regAdmission.value.trim();
  const password = regPassword.value;

  if (!name) {
    registerStatus.textContent = "Please enter your full name.";
    return;
  }
  if (mobile.length !== 10) {
    registerStatus.textContent = "Please enter a valid 10-digit mobile number.";
    return;
  }
  if (!admission) {
    registerStatus.textContent = "Please enter the student's admission number.";
    return;
  }
  if (!password || password.length < 6) {
    registerStatus.textContent = "Password must be at least 6 characters.";
    return;
  }

  registerBtn.disabled = true;
  registerStatus.textContent = "Creating your account…";
  suppressAutoRedirect = true;

  let cred = null;
  try {
    cred = await auth.createUserWithEmailAndPassword(mobileToEmail(mobile), password);

    registerStatus.textContent = "Checking admission number…";
    const studentMatch = await db.collection("students").where("admissionNumber", "==", admission).get();
    if (studentMatch.empty) {
      // Roll back — don't leave an orphaned, unverifiable account behind.
      await cred.user.delete();
      await auth.signOut();
      registerStatus.textContent = "We couldn't find a student with that admission number. Please check with the school office, or check for typos.";
      suppressAutoRedirect = false;
      registerBtn.disabled = false;
      return;
    }
    let studentId = null, studentName = "", studentClassName = "";
    studentMatch.forEach((doc) => {
      studentId = doc.id;
      studentName = doc.data().name;
      studentClassName = doc.data().className;
    });

    await db.collection("users").doc(cred.user.uid).set({
      name, mobile, admissionNumber: admission,
      studentId, studentName, studentClassName,
      role: "parent",
      status: "pending",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    regName.value = "";
    regMobile.value = "";
    regAdmission.value = "";
    regPassword.value = "";
    registerStatus.textContent = "";
    suppressAutoRedirect = false;
    showAuthCard(pendingCard);
  } catch (err) {
    console.error(err);
    suppressAutoRedirect = false;
    let msg = "Something went wrong. Please try again.";
    if (err.code === "auth/email-already-in-use") {
      msg = "An account with this mobile number already exists.";
    } else if (err.code === "auth/weak-password") {
      msg = "Password must be at least 6 characters.";
    }
    registerStatus.textContent = msg;
  }
  registerBtn.disabled = false;
}
registerBtn.addEventListener("click", handleRegister);

// ---------- INIT ----------
let suppressAutoRedirect = false;

(function init() {
  auth.onAuthStateChanged((user) => {
    if (user && !suppressAutoRedirect) {
      window.location.href = "dashboard.html";
      return;
    }
  });
  showScreen("splash");
  setTimeout(() => showScreen("auth"), 900);
})();
