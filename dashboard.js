const loadingCard = document.getElementById("loadingCard");
const notSignedInCard = document.getElementById("notSignedInCard");
const adminCard = document.getElementById("adminCard");
const pendingRequestsCard = document.getElementById("pendingRequestsCard");
const addMemberCard = document.getElementById("addMemberCard");
const teacherCard = document.getElementById("teacherCard");
const parentCard = document.getElementById("parentCard");
const documentsCard = document.getElementById("documentsCard");
const roleLabel = document.getElementById("roleLabel");
const signOutBtn = document.getElementById("signOutBtn");

const ALL_CARDS = [notSignedInCard, adminCard, pendingRequestsCard, addMemberCard, teacherCard, parentCard, documentsCard];

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
      showOnly([parentCard, documentsCard]);
      currentParentMobile = data.mobile;
      renderDocuments(data.documents || {});
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
      const canRemove = d.role !== "admin"; // safety: never let admin remove themselves from this list
      row.innerHTML = `
        <span class="member-name">${d.name} <span class="member-role">${roleText}</span></span>
        ${canRemove ? `<button class="btn-remove" data-mobile="${d.mobile}" data-name="${d.name}">Remove</button>` : ""}
      `;
      memberList.appendChild(row);
    });

    memberList.querySelectorAll(".btn-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mobile = btn.dataset.mobile;
        const name = btn.dataset.name;
        if (confirm(`Remove ${name}'s access? They will need to register again to regain access.`)) {
          removeMember(mobile);
        }
      });
    });
  } catch (err) {
    memberList.innerHTML = "<p class=\"card-copy\">Couldn't load member list.</p>";
  }
}

async function removeMember(mobile) {
  try {
    await db.collection("users").doc(mobile).delete();
    loadMemberList();
  } catch (err) {
    console.error(err);
    alert("Couldn't remove this member. Please try again.");
  }
}

// ---------- PARENT DOCUMENTS ----------
let currentParentMobile = null;

const DOCUMENT_TYPES = [
  { key: "birthCertificate", label: "Birth Certificate" },
  { key: "aadhaar", label: "Aadhaar Card" },
  { key: "transferCertificate", label: "Transfer Certificate" },
  { key: "reportCard", label: "Previous Report Card" },
  { key: "photo", label: "Passport-size Photo" },
  { key: "other", label: "Other Document" },
];

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const documentsList = document.getElementById("documentsList");
const documentsStatus = document.getElementById("documentsStatus");

function renderDocuments(existingDocs) {
  if (!documentsList) return;
  documentsList.innerHTML = "";

  DOCUMENT_TYPES.forEach((docType) => {
    const info = existingDocs[docType.key];
    const row = document.createElement("div");
    row.className = "doc-row";

    const statusText = info
      ? `<span class="doc-status uploaded">Uploaded ✓</span>`
      : `<span class="doc-status">Not uploaded</span>`;

    const viewLink = info
      ? `<a href="${info.url}" target="_blank" rel="noopener" class="doc-view-link">View</a>`
      : "";

    row.innerHTML = `
      <div class="doc-row-header">
        <span class="doc-label">${docType.label}</span>
        ${statusText}
      </div>
      <div class="doc-row-actions">
        <input type="file" accept="image/*,application/pdf" id="file-${docType.key}" class="doc-file-input" />
        <button class="btn-secondary doc-upload-btn" data-key="${docType.key}">
          ${info ? "Replace" : "Upload"}
        </button>
        ${viewLink}
      </div>
    `;
    documentsList.appendChild(row);
  });

  documentsList.querySelectorAll(".doc-upload-btn").forEach((btn) => {
    btn.addEventListener("click", () => handleDocUpload(btn.dataset.key, btn));
  });
}

async function handleDocUpload(docKey, btn) {
  const fileInput = document.getElementById(`file-${docKey}`);
  const file = fileInput.files[0];

  if (!file) {
    documentsStatus.textContent = "Please choose a file first.";
    return;
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    documentsStatus.textContent = "Please choose an image (JPG/PNG) or PDF file.";
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    documentsStatus.textContent = "File is too large. Please choose a file under 8MB.";
    return;
  }
  if (CLOUDINARY_CLOUD_NAME.startsWith("PASTE_")) {
    documentsStatus.textContent = "Document storage isn't set up yet. Contact the developer.";
    return;
  }

  btn.disabled = true;
  documentsStatus.textContent = "Uploading…";

  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    // Organize uploads per-parent so files are at least grouped sensibly,
    // even though (being honest) this isn't real per-user access control —
    // see the security note in project docs.
    formData.append("folder", `bps-school/${currentParentMobile}`);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
    const res = await fetch(uploadUrl, { method: "POST", body: formData });
    if (!res.ok) {
      throw new Error(`Upload failed (${res.status})`);
    }
    const result = await res.json();
    const url = result.secure_url;

    const snap = await db.collection("users").doc(currentParentMobile).get();
    const existing = snap.data().documents || {};
    existing[docKey] = {
      url,
      fileName: file.name,
      uploadedAt: Date.now(),
    };
    await db.collection("users").doc(currentParentMobile).update({ documents: existing });

    documentsStatus.textContent = "Uploaded successfully.";
    renderDocuments(existing);
  } catch (err) {
    console.error(err);
    documentsStatus.textContent = "Upload failed. Please check your connection and try again.";
    btn.disabled = false;
  }
}
