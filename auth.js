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
  tabSignIn.click();
});
rejectedBackBtn.addEventListener("click", () => {
  tabSignIn.click();
});

// ---------- SESSION ----------
function saveSession(userDoc) {
  localStorage.setItem(
    "bps_session",
    JSON.stringify({ mobile: userDoc.mobile, role: userDoc.role, name: userDoc.name })
  );
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem("bps_session"));
  } catch (e) {
    return null;
  }
}

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

  try {
    const snap = await db.collection("users").doc(mobile).get();
    if (!snap.exists) {
      loginStatus.textContent = "No account found with that mobile number.";
      loginBtn.disabled = false;
      return;
    }
    const data = snap.data();

    const ok = await verifyPassword(password, data.passwordSalt, data.passwordHash);
    if (!ok) {
      loginStatus.textContent = "Incorrect password. Please try again.";
      loginBtn.disabled = false;
      return;
    }

    if (data.status === "pending") {
      showAuthCard(pendingCard);
      loginBtn.disabled = false;
      loginStatus.textContent = "";
      return;
    }
    if (data.status === "rejected") {
      showAuthCard(rejectedCard);
      loginBtn.disabled = false;
      loginStatus.textContent = "";
      return;
    }

    saveSession(data);
    window.location.href = "dashboard.html";
  } catch (err) {
    console.error(err);
    loginStatus.textContent = "Something went wrong. Please try again.";
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
  registerStatus.textContent = "Sending request…";

  try {
    const existing = await db.collection("users").doc(mobile).get();
    if (existing.exists) {
      registerStatus.textContent = "An account with this mobile number already exists.";
      registerBtn.disabled = false;
      return;
    }

    const salt = generateSaltHex();
    const hash = await hashPassword(password, salt);

    const userDoc = {
      name,
      mobile,
      admissionNumber: admission,
      role: "parent",
      status: "pending",
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("users").doc(mobile).set(userDoc);

    regName.value = "";
    regMobile.value = "";
    regAdmission.value = "";
    regPassword.value = "";
    registerStatus.textContent = "";
    showAuthCard(pendingCard);
  } catch (err) {
    console.error(err);
    registerStatus.textContent = "Something went wrong. Please try again.";
  }
  registerBtn.disabled = false;
}
registerBtn.addEventListener("click", handleRegister);

// ---------- INIT ----------
(function init() {
  const session = getSession();
  if (session) {
    window.location.href = "dashboard.html";
    return;
  }
  showScreen("splash");
  setTimeout(() => showScreen("auth"), 900);
})();
