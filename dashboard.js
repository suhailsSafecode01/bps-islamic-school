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
      const docCount = countDocuments(d.documents || {});
      const docsBtn = d.role === "parent"
        ? `<button class="btn-view-docs" data-mobile="${d.mobile}">Documents (${docCount})</button>`
        : "";
      row.innerHTML = `
        <div class="member-row-top">
          <span class="member-name">${d.name} <span class="member-role">${roleText}</span></span>
          ${canRemove ? `<button class="btn-remove" data-mobile="${d.mobile}" data-name="${d.name}">Remove</button>` : ""}
        </div>
        ${docsBtn}
        <div class="admin-doc-view hidden" id="docview-${d.mobile}"></div>
      `;
      memberList.appendChild(row);
    });

    memberList.querySelectorAll(".btn-view-docs").forEach((btn) => {
      btn.addEventListener("click", () => toggleAdminDocView(btn.dataset.mobile));
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

function countDocuments(docs) {
  let count = 0;
  DOCUMENT_TYPES_FOR_COUNT.forEach((key) => { if (docs[key]) count++; });
  if (docs.otherDocuments) count += docs.otherDocuments.length;
  return count;
}
const DOCUMENT_TYPES_FOR_COUNT = ["birthCertificate", "aadhaar", "transferCertificate", "reportCard", "photo"];

async function toggleAdminDocView(mobile) {
  const panel = document.getElementById(`docview-${mobile}`);
  if (!panel) return;

  if (!panel.classList.contains("hidden")) {
    panel.classList.add("hidden");
    return;
  }

  panel.classList.remove("hidden");
  panel.innerHTML = `<p class="card-copy">Loading documents…</p>`;

  try {
    const snap = await db.collection("users").doc(mobile).get();
    const docs = snap.data().documents || {};
    const fixedLabels = {
      birthCertificate: "Birth Certificate",
      aadhaar: "Aadhaar Card",
      transferCertificate: "Transfer Certificate",
      reportCard: "Previous Report Card",
      photo: "Passport-size Photo",
    };

    let html = "";
    Object.keys(fixedLabels).forEach((key) => {
      const info = docs[key];
      html += `<div class="admin-doc-row">
        <span>${fixedLabels[key]}</span>
        ${info ? `<a href="${info.url}" target="_blank" rel="noopener">View</a>` : `<span class="doc-status">Not uploaded</span>`}
      </div>`;
    });
    (docs.otherDocuments || []).forEach((doc) => {
      html += `<div class="admin-doc-row">
        <span>${doc.label}</span>
        <a href="${doc.url}" target="_blank" rel="noopener">View</a>
      </div>`;
    });

    panel.innerHTML = html || `<p class="card-copy">No documents uploaded yet.</p>`;
  } catch (err) {
    panel.innerHTML = `<p class="card-copy">Couldn't load documents.</p>`;
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
];

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const documentsList = document.getElementById("documentsList");
const documentsStatus = document.getElementById("documentsStatus");
const otherDocumentsList = document.getElementById("otherDocumentsList");
const otherDocLabel = document.getElementById("otherDocLabel");
const otherDocFile = document.getElementById("otherDocFile");
const addOtherDocBtn = document.getElementById("addOtherDocBtn");

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

  renderOtherDocuments(existingDocs.otherDocuments || []);
}

function renderOtherDocuments(otherDocs) {
  if (!otherDocumentsList) return;
  if (otherDocs.length === 0) {
    otherDocumentsList.innerHTML = `<p class="card-copy" style="font-size:0.85rem;">No additional documents added yet.</p>`;
    return;
  }
  otherDocumentsList.innerHTML = "";
  otherDocs.forEach((doc, index) => {
    const row = document.createElement("div");
    row.className = "doc-row";
    row.innerHTML = `
      <div class="doc-row-header">
        <span class="doc-label">${doc.label}</span>
        <span class="doc-status uploaded">Uploaded ✓</span>
      </div>
      <div class="doc-row-actions">
        <a href="${doc.url}" target="_blank" rel="noopener" class="doc-view-link">View</a>
        <button class="btn-remove other-doc-remove-btn" data-index="${index}">Remove</button>
      </div>
    `;
    otherDocumentsList.appendChild(row);
  });

  otherDocumentsList.querySelectorAll(".other-doc-remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => removeOtherDocument(parseInt(btn.dataset.index, 10)));
  });
}

async function removeOtherDocument(index) {
  try {
    const snap = await db.collection("users").doc(currentParentMobile).get();
    const existing = snap.data().documents || {};
    const list = existing.otherDocuments || [];
    list.splice(index, 1);
    existing.otherDocuments = list;
    await db.collection("users").doc(currentParentMobile).update({ documents: existing });
    renderOtherDocuments(list);
  } catch (err) {
    console.error(err);
    alert("Couldn't remove this document. Please try again.");
  }
}

async function uploadFileToCloudinary(file, subfolder) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", `bps-school/${currentParentMobile}${subfolder ? "/" + subfolder : ""}`);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
  const res = await fetch(uploadUrl, { method: "POST", body: formData });
  if (!res.ok) {
    throw new Error(`Upload failed (${res.status})`);
  }
  const result = await res.json();
  return result.secure_url;
}

function validateFile(file) {
  if (!file) return "Please choose a file first.";
  if (!ALLOWED_TYPES.includes(file.type)) return "Please choose an image (JPG/PNG) or PDF file.";
  if (file.size > MAX_FILE_SIZE) return "File is too large. Please choose a file under 8MB.";
  if (CLOUDINARY_CLOUD_NAME.startsWith("PASTE_")) return "Document storage isn't set up yet. Contact the developer.";
  return null;
}

async function handleDocUpload(docKey, btn) {
  const fileInput = document.getElementById(`file-${docKey}`);
  const file = fileInput.files[0];

  const error = validateFile(file);
  if (error) {
    documentsStatus.textContent = error;
    return;
  }

  btn.disabled = true;
  documentsStatus.textContent = "Uploading…";

  try {
    const url = await uploadFileToCloudinary(file);

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

if (addOtherDocBtn) {
  addOtherDocBtn.addEventListener("click", async () => {
    const label = otherDocLabel.value.trim();
    const file = otherDocFile.files[0];

    if (!label) {
      documentsStatus.textContent = "Please give this document a name.";
      return;
    }
    const error = validateFile(file);
    if (error) {
      documentsStatus.textContent = error;
      return;
    }

    addOtherDocBtn.disabled = true;
    documentsStatus.textContent = "Uploading…";

    try {
      const url = await uploadFileToCloudinary(file, "other");

      const snap = await db.collection("users").doc(currentParentMobile).get();
      const existing = snap.data().documents || {};
      const list = existing.otherDocuments || [];
      list.push({ label, url, fileName: file.name, uploadedAt: Date.now() });
      existing.otherDocuments = list;
      await db.collection("users").doc(currentParentMobile).update({ documents: existing });

      documentsStatus.textContent = "Document added.";
      otherDocLabel.value = "";
      otherDocFile.value = "";
      renderOtherDocuments(list);
    } catch (err) {
      console.error(err);
      documentsStatus.textContent = "Upload failed. Please check your connection and try again.";
    }
    addOtherDocBtn.disabled = false;
  });
}
