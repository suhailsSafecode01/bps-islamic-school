const loadingCard = document.getElementById("loadingCard");
const notSignedInCard = document.getElementById("notSignedInCard");
const adminCard = document.getElementById("adminCard");
const pendingRequestsCard = document.getElementById("pendingRequestsCard");
const addMemberCard = document.getElementById("addMemberCard");
const teacherCard = document.getElementById("teacherCard");
const parentCard = document.getElementById("parentCard");
const roleLabel = document.getElementById("roleLabel");
const signOutBtn = document.getElementById("signOutBtn");

const ALL_CARDS = [notSignedInCard, adminCard, pendingRequestsCard, addMemberCard, teacherCard, parentCard];

function showOnly(elOrList) {
  const toShow = Array.isArray(elOrList) ? elOrList : [elOrList];
  ALL_CARDS.forEach((c) => c.classList.toggle("hidden", !toShow.includes(c)));
  loadingCard.classList.add("hidden");
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem("bps_session"));
  } catch (e) {
    return null;
  }
}

signOutBtn.addEventListener("click", () => {
  localStorage.removeItem("bps_session");
  window.location.href = "index.html";
});

async function init() {
  const session = getSession();
  if (!session) {
    showOnly(notSignedInCard);
    roleLabel.textContent = "Signed out";
    return;
  }

  // Re-check current status/role from the database (in case admin changed it)
  try {
    const snap = await db.collection("users").doc(session.mobile).get();
    if (!snap.exists) {
      localStorage.removeItem("bps_session");
      showOnly(notSignedInCard);
      return;
    }
    const data = snap.data();

    if (data.status === "pending" || data.status === "rejected") {
      localStorage.removeItem("bps_session");
      showOnly(notSignedInCard);
      return;
    }

    if (data.role === "admin") {
      roleLabel.textContent = "Admin — " + data.name;
      showOnly([adminCard, pendingRequestsCard, addMemberCard]);
      loadPendingRequests();
      loadMemberList();
    } else if (data.role === "teacher") {
      roleLabel.textContent = "Teacher — " + data.name;
      showOnly(teacherCard);
    } else {
      roleLabel.textContent = "Parent — " + data.name;
      showOnly(parentCard);
    }
  } catch (err) {
    console.error(err);
    showOnly(notSignedInCard);
  }
}
init();

// ---------- PENDING REQUESTS (admin) ----------
const pendingRequestsList = document.getElementById("pendingRequestsList");

async function loadPendingRequests() {
  pendingRequestsList.innerHTML = "<p class=\"card-copy\">Loading…</p>";
  try {
    const snap = await db.collection("users").where("status", "==", "pending").get();
    if (snap.empty) {
      pendingRequestsList.innerHTML = "<p class=\"card-copy\">No pending requests.</p>";
      return;
    }
    pendingRequestsList.innerHTML = "";
    snap.forEach((doc) => {
      const d = doc.data();
      const row = document.createElement("div");
      row.className = "request-row";
      row.innerHTML = `
        <div class="request-name">${d.name}</div>
        <div class="request-detail">Mobile: ${d.mobile}</div>
        <div class="request-detail">Admission No: ${d.admissionNumber}</div>
        <div class="request-actions">
          <button class="btn-approve" data-mobile="${d.mobile}">Approve</button>
          <button class="btn-reject" data-mobile="${d.mobile}">Reject</button>
        </div>
      `;
      pendingRequestsList.appendChild(row);
    });

    pendingRequestsList.querySelectorAll(".btn-approve").forEach((btn) => {
      btn.addEventListener("click", () => setRequestStatus(btn.dataset.mobile, "approved"));
    });
    pendingRequestsList.querySelectorAll(".btn-reject").forEach((btn) => {
      btn.addEventListener("click", () => setRequestStatus(btn.dataset.mobile, "rejected"));
    });
  } catch (err) {
    console.error(err);
    pendingRequestsList.innerHTML = "<p class=\"card-copy\">Couldn't load requests.</p>";
  }
}

async function setRequestStatus(mobile, status) {
  try {
    await db.collection("users").doc(mobile).update({ status });
    loadPendingRequests();
    loadMemberList();
  } catch (err) {
    console.error(err);
    alert("Couldn't update request. Please try again.");
  }
}

// ---------- ADD TEACHER (admin only) ----------
const newMemberName = document.getElementById("newMemberName");
const newMemberMobile = document.getElementById("newMemberMobile");
const addMemberBtn = document.getElementById("addMemberBtn");
const addMemberStatus = document.getElementById("addMemberStatus");
const newMemberResult = document.getElementById("newMemberResult");
const resultMobile = document.getElementById("resultMobile");
const resultPassword = document.getElementById("resultPassword");
const copyCredsBtn = document.getElementById("copyCredsBtn");
const memberList = document.getElementById("memberList");

function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let pw = "";
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

function normalizeMobile(raw) {
  return raw.replace(/\D/g, "");
}

addMemberBtn.addEventListener("click", async () => {
  const name = newMemberName.value.trim();
  const mobile = normalizeMobile(newMemberMobile.value);

  if (!name) {
    addMemberStatus.textContent = "Please enter a name.";
    return;
  }
  if (mobile.length !== 10) {
    addMemberStatus.textContent = "Please enter a valid 10-digit mobile number.";
    return;
  }

  addMemberBtn.disabled = true;
  addMemberStatus.textContent = "Creating login…";

  try {
    const existing = await db.collection("users").doc(mobile).get();
    if (existing.exists) {
      addMemberStatus.textContent = "An account with this mobile number already exists.";
      addMemberBtn.disabled = false;
      return;
    }

    const tempPassword = generateTempPassword();
    const salt = generateSaltHex();
    const hash = await hashPassword(tempPassword, salt);

    await db.collection("users").doc(mobile).set({
      name,
      mobile,
      role: "teacher",
      status: "approved",
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    resultMobile.textContent = mobile;
    resultPassword.textContent = tempPassword;
    newMemberResult.classList.remove("hidden");
    addMemberStatus.textContent = "";
    newMemberName.value = "";
    newMemberMobile.value = "";
    loadMemberList();
  } catch (err) {
    console.error(err);
    addMemberStatus.textContent = "Couldn't create login. Please try again.";
  }
  addMemberBtn.disabled = false;
});

copyCredsBtn.addEventListener("click", async () => {
  const text = `Mobile: ${resultMobile.textContent}\nPassword: ${resultPassword.textContent}`;
  try {
    await navigator.clipboard.writeText(text);
    copyCredsBtn.textContent = "Copied!";
    setTimeout(() => { copyCredsBtn.textContent = "Copy details"; }, 2000);
  } catch (e) {
    // clipboard not available — text is already visible on screen
  }
});

async function loadMemberList() {
  memberList.innerHTML = "<p class=\"card-copy\">Loading members…</p>";
  try {
    const snap = await db.collection("users").get();
    const approved = [];
    snap.forEach((doc) => {
      const d = doc.data();
      if (d.status === "approved") approved.push(d);
    });
    if (approved.length === 0) {
      memberList.innerHTML = "<p class=\"card-copy\">No members yet.</p>";
      return;
    }
    memberList.innerHTML = "";
    approved.forEach((d) => {
      const row = document.createElement("div");
      row.className = "member-row";
      const roleText = d.role === "teacher" ? "Teacher" : d.role === "admin" ? "Admin" : "Parent";
      row.innerHTML = `<span class="member-name">${d.name}</span><span class="member-role">${roleText}</span>`;
      memberList.appendChild(row);
    });
  } catch (err) {
    memberList.innerHTML = "<p class=\"card-copy\">Couldn't load member list.</p>";
  }
}
