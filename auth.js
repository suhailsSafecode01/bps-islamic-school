// ---------- CONFIG ----------
// Where the sign-in link should point back to (must match this deployed URL)
const REDIRECT_URL = "https://suhailssafecode01.github.io/bps-islamic-school/index.html";
const PENDING_EMAIL_KEY = "bps_pendingEmail";
const PENDING_ROLE_KEY = "bps_pendingRole";

// ---------- DOM ----------
const splashScreen = document.getElementById("splashScreen");
const authScreen = document.getElementById("authScreen");
const emailStep = document.getElementById("emailStep");
const checkEmailStep = document.getElementById("checkEmailStep");
const confirmEmailStep = document.getElementById("confirmEmailStep");
const emailInput = document.getElementById("emailInput");
const sendLinkBtn = document.getElementById("sendLinkBtn");
const emailStatus = document.getElementById("emailStatus");
const backToEmailBtn = document.getElementById("backToEmailBtn");
const confirmEmailInput = document.getElementById("confirmEmailInput");
const confirmSignInBtn = document.getElementById("confirmSignInBtn");
const confirmStatus = document.getElementById("confirmStatus");
const sentToCopy = document.getElementById("sentToCopy");
const roleButtons = document.querySelectorAll(".role-btn");

let selectedRole = "parent";

function showScreen(name) {
  splashScreen.classList.toggle("hidden", name !== "splash");
  authScreen.classList.toggle("hidden", name !== "auth");
}
function showStep(name) {
  emailStep.classList.toggle("hidden", name !== "email");
  checkEmailStep.classList.toggle("hidden", name !== "check");
  confirmEmailStep.classList.toggle("hidden", name !== "confirm");
}

roleButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    roleButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedRole = btn.dataset.role;
  });
});

// ---------- SEND SIGN-IN LINK ----------
sendLinkBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  if (!email || !email.includes("@")) {
    emailStatus.textContent = "Please enter a valid email address.";
    return;
  }
  sendLinkBtn.disabled = true;
  emailStatus.textContent = "Sending…";

  const actionCodeSettings = {
    url: REDIRECT_URL,
    handleCodeInApp: true,
  };

  try {
    await auth.sendSignInLinkToEmail(email, actionCodeSettings);
    window.localStorage.setItem(PENDING_EMAIL_KEY, email);
    window.localStorage.setItem(PENDING_ROLE_KEY, selectedRole);
    sentToCopy.textContent = `We sent a sign-in link to ${email}. Open it on this device to continue.`;
    showStep("check");
    emailStatus.textContent = "";
  } catch (err) {
    emailStatus.textContent = "Couldn't send the link: " + (err.message || "please try again.");
  }
  sendLinkBtn.disabled = false;
});

backToEmailBtn.addEventListener("click", () => {
  showStep("email");
});

// ---------- COMPLETE SIGN-IN (when link is opened) ----------
async function handleIncomingLink() {
  if (!auth.isSignInWithEmailLink(window.location.href)) return;

  let email = window.localStorage.getItem(PENDING_EMAIL_KEY);
  if (email) {
    await completeSignIn(email);
  } else {
    // Link opened on a different device/browser — ask to confirm email
    showScreen("auth");
    showStep("confirm");
  }
}

confirmSignInBtn.addEventListener("click", async () => {
  const email = confirmEmailInput.value.trim();
  if (!email || !email.includes("@")) {
    confirmStatus.textContent = "Please enter a valid email address.";
    return;
  }
  confirmSignInBtn.disabled = true;
  confirmStatus.textContent = "Signing in…";
  await completeSignIn(email);
  confirmSignInBtn.disabled = false;
});

async function completeSignIn(email) {
  try {
    const result = await auth.signInWithEmailLink(email, window.location.href);
    window.localStorage.removeItem(PENDING_EMAIL_KEY);

    const role = window.localStorage.getItem(PENDING_ROLE_KEY) || "parent";
    window.localStorage.removeItem(PENDING_ROLE_KEY);

    await ensureUserDocument(result.user, role);

    // Clean the sign-in link params out of the URL, then go to dashboard
    window.history.replaceState({}, document.title, window.location.pathname);
    window.location.href = "dashboard.html";
  } catch (err) {
    confirmStatus.textContent = "Sign-in failed: " + (err.message || "please try again.");
    emailStatus.textContent = "Sign-in failed: " + (err.message || "please try again.");
  }
}

// ---------- FIRESTORE USER DOCUMENT ----------
// Creates the user's role record on first sign-in. Admin accounts are never
// created this way — they're set up directly in Firestore by the school.
async function ensureUserDocument(user, requestedRole) {
  const ref = db.collection("users").doc(user.uid);
  const snap = await ref.get();
  if (snap.exists) return; // already set up — role stays whatever it already is

  const role = requestedRole === "teacher" ? "teacher" : "parent";
  const docData = {
    email: user.email,
    role: role,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  if (role === "teacher") {
    docData.approved = false; // admin must approve before full access
  }
  await ref.set(docData);
}

// ---------- INIT ----------
(async function init() {
  // If already signed in, skip straight to dashboard
  auth.onAuthStateChanged((user) => {
    if (user && !auth.isSignInWithEmailLink(window.location.href)) {
      window.location.href = "dashboard.html";
      return;
    }
  });

  if (auth.isSignInWithEmailLink(window.location.href)) {
    await handleIncomingLink();
  } else {
    showScreen("splash");
    setTimeout(() => {
      showScreen("auth");
      showStep("email");
    }, 900);
  }
})();
