const loadingCard = document.getElementById("loadingCard");
const notSignedInCard = document.getElementById("notSignedInCard");
const adminCard = document.getElementById("adminCard");
const pendingRequestsCard = document.getElementById("pendingRequestsCard");
const addMemberCard = document.getElementById("addMemberCard");
const manageClassesCard = document.getElementById("manageClassesCard");
const manageStudentsCard = document.getElementById("manageStudentsCard");
const teacherCard = document.getElementById("teacherCard");
const attendanceCard = document.getElementById("attendanceCard");
const parentCard = document.getElementById("parentCard");
const documentsCard = document.getElementById("documentsCard");
const parentAttendanceCard = document.getElementById("parentAttendanceCard");
const roleLabel = document.getElementById("roleLabel");
const signOutBtn = document.getElementById("signOutBtn");

const ALL_CARDS = [notSignedInCard, adminCard, pendingRequestsCard, addMemberCard, manageClassesCard, manageStudentsCard, teacherCard, attendanceCard, parentCard, documentsCard, parentAttendanceCard];

function showOnly(elOrList) {
  const toShow = Array.isArray(elOrList) ? elOrList : [elOrList];
  ALL_CARDS.forEach((c) => c.classList.toggle("hidden", !toShow.includes(c)));
  loadingCard.classList.add("hidden");
}

signOutBtn.addEventListener("click", () => {
  auth.signOut();
  window.location.href = "index.html";
});

let currentUid = null;

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    showOnly(notSignedInCard);
    roleLabel.textContent = "Signed out";
    return;
  }
  currentUid = user.uid;

  try {
    const snap = await db.collection("users").doc(user.uid).get();
    if (!snap.exists) {
      showOnly(notSignedInCard);
      return;
    }
    const data = snap.data();

    if (data.status === "pending" || data.status === "rejected") {
      auth.signOut();
      showOnly(notSignedInCard);
      return;
    }

    if (data.role === "admin") {
      roleLabel.textContent = "Admin — " + data.name;
      showOnly([adminCard, pendingRequestsCard, addMemberCard, manageClassesCard, manageStudentsCard]);
      loadPendingRequests();
      await loadClasses(); // must finish first — loadMemberList's teacher-class dropdown depends on this cache
      loadMemberList();
      loadStudents();
    } else if (data.role === "teacher") {
      roleLabel.textContent = "Teacher — " + data.name;
      showOnly([teacherCard, attendanceCard]);
      currentTeacherClassId = data.classId || null;
      currentTeacherClassName = data.className || "";
      const label = document.getElementById("teacherClassLabel");
      if (label) label.textContent = currentTeacherClassId ? `Your class: ${currentTeacherClassName}` : "No class assigned yet — contact the school office.";
      loadAttendanceForToday();
    } else {
      roleLabel.textContent = "Parent — " + data.name;
      showOnly([parentCard, documentsCard, parentAttendanceCard]);
      currentUserId = user.uid;
      renderDocuments(data.documents || {});
      loadParentAttendance(data.studentId, data.studentClassName, data.studentName);
    }
  } catch (err) {
    console.error(err);
    showOnly(notSignedInCard);
  }
});

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
        <div class="request-detail">Admission No: ${d.admissionNumber}${d.studentName ? " — matched: " + d.studentName + (d.studentClassName ? " (" + d.studentClassName + ")" : "") : " — ⚠️ no matching student found"}</div>
        <div class="request-actions">
          <button class="btn-approve" data-uid="${doc.id}">Approve</button>
          <button class="btn-reject" data-uid="${doc.id}">Reject</button>
        </div>
      `;
      pendingRequestsList.appendChild(row);
    });

    pendingRequestsList.querySelectorAll(".btn-approve").forEach((btn) => {
      btn.addEventListener("click", () => setRequestStatus(btn.dataset.uid, "approved"));
    });
    pendingRequestsList.querySelectorAll(".btn-reject").forEach((btn) => {
      btn.addEventListener("click", () => setRequestStatus(btn.dataset.uid, "rejected"));
    });
  } catch (err) {
    console.error(err);
    pendingRequestsList.innerHTML = "<p class=\"card-copy\">Couldn't load requests.</p>";
  }
}

async function setRequestStatus(uid, status) {
  try {
    await db.collection("users").doc(uid).update({ status });
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
const newMemberClass = document.getElementById("newMemberClass");
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
  const classId = newMemberClass.value;

  if (!name) {
    addMemberStatus.textContent = "Please enter a name.";
    return;
  }
  if (mobile.length !== 10) {
    addMemberStatus.textContent = "Please enter a valid 10-digit mobile number.";
    return;
  }
  if (!classId) {
    addMemberStatus.textContent = "Please add a class first (in Manage Classes below), then select it.";
    return;
  }

  addMemberBtn.disabled = true;
  addMemberStatus.textContent = "Creating login…";

  try {
    const tempPassword = generateTempPassword();
    const className = (cachedClasses.find((c) => c.id === classId) || {}).name || "";

    // A secondary app instance means creating this new login doesn't
    // sign the admin out of their own session.
    const secondaryApp = firebase.apps.find((a) => a.name === "Secondary")
      || firebase.initializeApp(firebaseConfig, "Secondary");
    const secondaryAuth = secondaryApp.auth();

    const cred = await secondaryAuth.createUserWithEmailAndPassword(mobileToEmail(mobile), tempPassword);
    const newUid = cred.user.uid;

    await db.collection("users").doc(newUid).set({
      name,
      mobile,
      role: "teacher",
      status: "approved",
      classId,
      className,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    await secondaryAuth.signOut();

    resultMobile.textContent = mobile;
    resultPassword.textContent = tempPassword;
    newMemberResult.classList.remove("hidden");
    addMemberStatus.textContent = "";
    newMemberName.value = "";
    newMemberMobile.value = "";
    loadMemberList();
  } catch (err) {
    console.error(err);
    let msg = "Couldn't create login. Please try again.";
    if (err.code === "auth/email-already-in-use") {
      msg = "An account with this mobile number already exists.";
    }
    addMemberStatus.textContent = msg;
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
      if (d.status === "approved") approved.push({ ...d, uid: doc.id });
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
        ? `<button class="btn-view-docs" data-uid="${d.uid}">Documents (${docCount})</button>`
        : "";
      const classSwapControl = d.role === "teacher"
        ? `<div class="class-swap-row">
             <span class="request-detail">Current class: ${d.className || "none assigned"}</span>
             <select class="text-input class-swap-select" data-uid="${d.uid}" style="margin-top:0.3rem;">
               ${cachedClasses.map((c) => `<option value="${c.id}" ${c.id === d.classId ? "selected" : ""}>${c.name}</option>`).join("")}
             </select>
             <button class="btn-secondary class-swap-btn" data-uid="${d.uid}" style="margin-top:0.4rem;">Change class</button>
             <p class="status-note class-swap-status" data-uid="${d.uid}"></p>
           </div>`
        : "";
      row.innerHTML = `
        <div class="member-row-top">
          <span class="member-name">${d.name} <span class="member-role">${roleText}</span></span>
          ${canRemove ? `<button class="btn-remove" data-uid="${d.uid}" data-name="${d.name}">Remove</button>` : ""}
        </div>
        ${docsBtn}
        ${classSwapControl}
        <div class="admin-doc-view hidden" id="docview-${d.uid}"></div>
      `;
      memberList.appendChild(row);
    });

    memberList.querySelectorAll(".class-swap-btn").forEach((btn) => {
      btn.addEventListener("click", () => reassignTeacherClass(btn.dataset.uid));
    });

    memberList.querySelectorAll(".btn-view-docs").forEach((btn) => {
      btn.addEventListener("click", () => toggleAdminDocView(btn.dataset.uid));
    });

    memberList.querySelectorAll(".btn-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const uid = btn.dataset.uid;
        const name = btn.dataset.name;
        if (confirm(`Remove ${name}'s access? They will need to register again to regain access.`)) {
          removeMember(uid);
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

function renderDocumentsHTML(docs) {
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

  return html || `<p class="card-copy">No documents uploaded yet.</p>`;
}

async function toggleAdminDocView(uid) {
  const panel = document.getElementById(`docview-${uid}`);
  if (!panel) return;

  if (!panel.classList.contains("hidden")) {
    panel.classList.add("hidden");
    return;
  }

  panel.classList.remove("hidden");
  panel.innerHTML = `<p class="card-copy">Loading documents…</p>`;

  try {
    const snap = await db.collection("users").doc(uid).get();
    const docs = snap.data().documents || {};
    panel.innerHTML = renderDocumentsHTML(docs);
  } catch (err) {
    panel.innerHTML = `<p class="card-copy">Couldn't load documents.</p>`;
  }
}

async function reassignTeacherClass(uid) {
  const select = document.querySelector(`.class-swap-select[data-uid="${uid}"]`);
  const status = document.querySelector(`.class-swap-status[data-uid="${uid}"]`);
  if (!select) return;

  const newClassId = select.value;
  const newClass = cachedClasses.find((c) => c.id === newClassId);
  if (!newClass) {
    if (status) status.textContent = "Please add a class first.";
    return;
  }

  if (status) status.textContent = "Updating…";
  try {
    await db.collection("users").doc(uid).update({
      classId: newClassId,
      className: newClass.name,
    });
    if (status) status.textContent = `Now assigned to ${newClass.name}.`;
    loadMemberList();
  } catch (err) {
    console.error(err);
    if (status) status.textContent = "Couldn't update. Please try again.";
  }
}

async function removeMember(uid) {
  try {
    await db.collection("users").doc(uid).delete();
    loadMemberList();
  } catch (err) {
    console.error(err);
    alert("Couldn't remove this member. Please try again.");
  }
}

// ---------- PARENT DOCUMENTS ----------
let currentUserId = null;

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
    const snap = await db.collection("users").doc(currentUserId).get();
    const existing = snap.data().documents || {};
    const list = existing.otherDocuments || [];
    list.splice(index, 1);
    existing.otherDocuments = list;
    await db.collection("users").doc(currentUserId).update({ documents: existing });
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
  formData.append("folder", `bps-school/${currentUserId}${subfolder ? "/" + subfolder : ""}`);

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

    const snap = await db.collection("users").doc(currentUserId).get();
    const existing = snap.data().documents || {};
    existing[docKey] = {
      url,
      fileName: file.name,
      uploadedAt: Date.now(),
    };
    await db.collection("users").doc(currentUserId).update({ documents: existing });

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

      const snap = await db.collection("users").doc(currentUserId).get();
      const existing = snap.data().documents || {};
      const list = existing.otherDocuments || [];
      list.push({ label, url, fileName: file.name, uploadedAt: Date.now() });
      existing.otherDocuments = list;
      await db.collection("users").doc(currentUserId).update({ documents: existing });

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

// ---------- MANAGE CLASSES (admin) ----------
const newClassName = document.getElementById("newClassName");
const addClassBtn = document.getElementById("addClassBtn");
const classStatus = document.getElementById("classStatus");
const classesList = document.getElementById("classesList");
const newStudentClass = document.getElementById("newStudentClass");

let cachedClasses = [];

function slugify(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

addClassBtn.addEventListener("click", async () => {
  const name = newClassName.value.trim();
  if (!name) {
    classStatus.textContent = "Please enter a class name.";
    return;
  }
  const classId = slugify(name);
  if (!classId) {
    classStatus.textContent = "Please enter a valid class name.";
    return;
  }

  addClassBtn.disabled = true;
  classStatus.textContent = "Adding…";

  try {
    const existing = await db.collection("classes").doc(classId).get();
    if (existing.exists) {
      classStatus.textContent = "A class with this name already exists.";
      addClassBtn.disabled = false;
      return;
    }
    await db.collection("classes").doc(classId).set({ name, createdAt: Date.now() });
    newClassName.value = "";
    classStatus.textContent = "Class added.";
    loadClasses();
  } catch (err) {
    console.error(err);
    classStatus.textContent = "Couldn't add class. Please try again.";
  }
  addClassBtn.disabled = false;
});

async function loadClasses() {
  if (!classesList) return;
  classesList.innerHTML = "<p class=\"card-copy\">Loading…</p>";
  try {
    const snap = await db.collection("classes").get();
    cachedClasses = [];
    snap.forEach((doc) => cachedClasses.push({ id: doc.id, ...doc.data() }));
    cachedClasses.sort((a, b) => a.name.localeCompare(b.name));

    if (cachedClasses.length === 0) {
      classesList.innerHTML = "<p class=\"card-copy\">No classes yet.</p>";
    } else {
      classesList.innerHTML = "";
      cachedClasses.forEach((c) => {
        const row = document.createElement("div");
        row.className = "member-row";
        row.innerHTML = `<span class="member-name">${c.name}</span><button class="btn-remove" data-id="${c.id}" data-name="${c.name}">Delete</button>`;
        classesList.appendChild(row);
      });
      classesList.querySelectorAll(".btn-remove").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (confirm(`Delete "${btn.dataset.name}"? This won't remove students already assigned to it.`)) {
            deleteClass(btn.dataset.id);
          }
        });
      });
    }

    // Refresh the dropdowns used when adding a student or a teacher
    if (newStudentClass) {
      newStudentClass.innerHTML = cachedClasses.length
        ? cachedClasses.map((c) => `<option value="${c.id}">${c.name}</option>`).join("")
        : `<option value="">No classes yet — add one above first</option>`;
    }
    if (newMemberClass) {
      newMemberClass.innerHTML = cachedClasses.length
        ? cachedClasses.map((c) => `<option value="${c.id}">${c.name}</option>`).join("")
        : `<option value="">No classes yet — add one first</option>`;
    }
  } catch (err) {
    classesList.innerHTML = "<p class=\"card-copy\">Couldn't load classes.</p>";
  }
}

async function deleteClass(classId) {
  try {
    await db.collection("classes").doc(classId).delete();
    loadClasses();
  } catch (err) {
    alert("Couldn't delete class. Please try again.");
  }
}

// ---------- MANAGE STUDENTS (admin) ----------
const newStudentName = document.getElementById("newStudentName");
const newStudentAdmission = document.getElementById("newStudentAdmission");
const newStudentParentMobile = document.getElementById("newStudentParentMobile");
const addStudentBtn = document.getElementById("addStudentBtn");
const studentStatus = document.getElementById("studentStatus");
const studentsList = document.getElementById("studentsList");
const studentSearchInput = document.getElementById("studentSearchInput");

let cachedStudents = [];

addStudentBtn.addEventListener("click", async () => {
  const name = newStudentName.value.trim();
  const admissionNumber = newStudentAdmission.value.trim();
  const classId = newStudentClass.value;
  const parentMobile = newStudentParentMobile.value.trim().replace(/\D/g, "");

  if (!name) { studentStatus.textContent = "Please enter the student's name."; return; }
  if (!admissionNumber) { studentStatus.textContent = "Please enter an admission number."; return; }
  if (!classId) { studentStatus.textContent = "Please add a class first, then select it."; return; }
  if (parentMobile && parentMobile.length !== 10) { studentStatus.textContent = "Parent mobile number should be 10 digits, or left blank."; return; }

  addStudentBtn.disabled = true;
  studentStatus.textContent = "Adding…";

  try {
    const existing = await db.collection("students").where("admissionNumber", "==", admissionNumber).get();
    if (!existing.empty) {
      studentStatus.textContent = "A student with this admission number already exists.";
      addStudentBtn.disabled = false;
      return;
    }

    const className = (cachedClasses.find((c) => c.id === classId) || {}).name || "";
    await db.collection("students").add({
      name, admissionNumber, classId, className,
      parentMobile: parentMobile || null,
      createdAt: Date.now(),
    });

    newStudentName.value = "";
    newStudentAdmission.value = "";
    newStudentParentMobile.value = "";
    studentStatus.textContent = "Student added.";
    loadStudents();
  } catch (err) {
    console.error(err);
    studentStatus.textContent = "Couldn't add student. Please try again.";
  }
  addStudentBtn.disabled = false;
});

async function loadStudents() {
  if (!studentsList) return;
  studentsList.innerHTML = "<p class=\"card-copy\">Loading…</p>";
  try {
    const snap = await db.collection("students").get();
    cachedStudents = [];
    snap.forEach((doc) => cachedStudents.push({ id: doc.id, ...doc.data() }));
    cachedStudents.sort((a, b) => a.name.localeCompare(b.name));
    renderStudents(cachedStudents);
  } catch (err) {
    studentsList.innerHTML = "<p class=\"card-copy\">Couldn't load students.</p>";
  }
}

function renderStudents(students) {
  if (students.length === 0) {
    studentsList.innerHTML = "<p class=\"card-copy\">No students found.</p>";
    return;
  }
  studentsList.innerHTML = "";
  students.forEach((s) => {
    const row = document.createElement("div");
    row.className = "student-row";
    row.innerHTML = `
      <div class="member-row-top">
        <span class="member-name">${s.name} <span class="member-role">${s.className || "No class"}</span></span>
        <button class="btn-remove" data-id="${s.id}" data-name="${s.name}">Delete</button>
      </div>
      <div class="request-detail">Admission No: ${s.admissionNumber}${s.parentMobile ? " · Parent: " + s.parentMobile : ""}</div>
      <button class="btn-view-docs" data-student-id="${s.id}" data-admission="${s.admissionNumber}">View Documents</button>
      <div class="admin-doc-view hidden" id="studentdocview-${s.id}"></div>
    `;
    studentsList.appendChild(row);
  });
  studentsList.querySelectorAll(".btn-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (confirm(`Delete student "${btn.dataset.name}"? This cannot be undone.`)) {
        deleteStudent(btn.dataset.id);
      }
    });
  });
  studentsList.querySelectorAll(".btn-view-docs").forEach((btn) => {
    btn.addEventListener("click", () => toggleStudentDocView(btn.dataset.studentId, btn.dataset.admission));
  });
}

async function toggleStudentDocView(studentId, admissionNumber) {
  const panel = document.getElementById(`studentdocview-${studentId}`);
  if (!panel) return;

  if (!panel.classList.contains("hidden")) {
    panel.classList.add("hidden");
    return;
  }

  panel.classList.remove("hidden");
  panel.innerHTML = `<p class="card-copy">Loading…</p>`;

  try {
    // Find the parent account linked to this student (by studentId first,
    // falling back to matching admission number for older records).
    let parentSnap = await db.collection("users").where("studentId", "==", studentId).get();
    let parentDoc = null;
    parentSnap.forEach((doc) => { parentDoc = doc.data(); });

    if (!parentDoc) {
      const fallback = await db.collection("users").where("admissionNumber", "==", admissionNumber).get();
      fallback.forEach((doc) => { parentDoc = doc.data(); });
    }

    if (!parentDoc) {
      panel.innerHTML = `<p class="card-copy">No parent has registered for this student yet.</p>`;
      return;
    }
    if (parentDoc.status === "pending") {
      panel.innerHTML = `<p class="card-copy">A parent has registered but is still pending approval.</p>`;
      return;
    }

    panel.innerHTML = renderDocumentsHTML(parentDoc.documents || {});
  } catch (err) {
    console.error(err);
    panel.innerHTML = `<p class="card-copy">Couldn't load documents.</p>`;
  }
}

async function deleteStudent(studentId) {
  try {
    await db.collection("students").doc(studentId).delete();
    loadStudents();
  } catch (err) {
    alert("Couldn't delete student. Please try again.");
  }
}

if (studentSearchInput) {
  studentSearchInput.addEventListener("input", () => {
    const q = studentSearchInput.value.trim().toLowerCase();
    if (!q) {
      renderStudents(cachedStudents);
      return;
    }
    const filtered = cachedStudents.filter((s) =>
      (s.name || "").toLowerCase().includes(q) ||
      (s.admissionNumber || "").toLowerCase().includes(q) ||
      (s.className || "").toLowerCase().includes(q) ||
      (s.parentMobile || "").includes(q)
    );
    renderStudents(filtered);
  });
}

// ---------- ATTENDANCE (Teacher marks, Parent views) ----------
let currentTeacherClassId = null;
let currentTeacherClassName = "";
let attendanceStudentsCache = [];

const attendanceDate = document.getElementById("attendanceDate");
const attendanceStudentList = document.getElementById("attendanceStudentList");
const saveAttendanceBtn = document.getElementById("saveAttendanceBtn");
const attendanceStatus = document.getElementById("attendanceStatus");

function todayDateString() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

if (attendanceDate) {
  attendanceDate.value = todayDateString();
  attendanceDate.addEventListener("change", () => loadAttendanceForDate(attendanceDate.value));
}

async function loadAttendanceForToday() {
  if (!currentTeacherClassId) {
    attendanceStudentList.innerHTML = `<p class="card-copy">No class assigned yet — contact the school office.</p>`;
    return;
  }
  await loadAttendanceForDate(attendanceDate.value || todayDateString());
}

async function loadAttendanceForDate(dateStr) {
  if (!currentTeacherClassId) return;
  attendanceStudentList.innerHTML = `<p class="card-copy">Loading students…</p>`;

  try {
    const snap = await db.collection("students").where("classId", "==", currentTeacherClassId).get();
    attendanceStudentsCache = [];
    snap.forEach((doc) => attendanceStudentsCache.push({ id: doc.id, ...doc.data() }));
    attendanceStudentsCache.sort((a, b) => a.name.localeCompare(b.name));

    if (attendanceStudentsCache.length === 0) {
      attendanceStudentList.innerHTML = `<p class="card-copy">No students in your class yet.</p>`;
      return;
    }

    // Load any existing attendance already saved for this date, so it's editable
    const attendanceId = `${currentTeacherClassId}_${dateStr}`;
    const existingSnap = await db.collection("attendance").doc(attendanceId).get();
    const existingRecords = existingSnap.exists ? (existingSnap.data().records || {}) : {};

    attendanceStudentList.innerHTML = "";
    attendanceStudentsCache.forEach((s) => {
      const current = existingRecords[s.id] || "present";
      const row = document.createElement("div");
      row.className = "attendance-row";
      row.innerHTML = `
        <span class="member-name">${s.name}</span>
        <div class="attendance-toggle" data-student-id="${s.id}">
          <button type="button" class="att-btn ${current === "present" ? "active-present" : ""}" data-value="present">Present</button>
          <button type="button" class="att-btn ${current === "absent" ? "active-absent" : ""}" data-value="absent">Absent</button>
        </div>
      `;
      attendanceStudentList.appendChild(row);
    });

    attendanceStudentList.querySelectorAll(".attendance-toggle").forEach((toggle) => {
      const buttons = toggle.querySelectorAll(".att-btn");
      buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
          buttons.forEach((b) => b.classList.remove("active-present", "active-absent"));
          btn.classList.add(btn.dataset.value === "present" ? "active-present" : "active-absent");
        });
      });
    });
  } catch (err) {
    console.error(err);
    attendanceStudentList.innerHTML = `<p class="card-copy">Couldn't load students.</p>`;
  }
}

if (saveAttendanceBtn) {
  saveAttendanceBtn.addEventListener("click", async () => {
    const dateStr = attendanceDate.value;
    if (!dateStr) {
      attendanceStatus.textContent = "Please choose a date.";
      return;
    }
    if (!currentTeacherClassId) {
      attendanceStatus.textContent = "No class assigned.";
      return;
    }

    const records = {};
    attendanceStudentList.querySelectorAll(".attendance-toggle").forEach((toggle) => {
      const studentId = toggle.dataset.studentId;
      const activeBtn = toggle.querySelector(".active-present, .active-absent");
      records[studentId] = activeBtn ? activeBtn.dataset.value : "present";
    });

    saveAttendanceBtn.disabled = true;
    attendanceStatus.textContent = "Saving…";

    try {
      const attendanceId = `${currentTeacherClassId}_${dateStr}`;
      await db.collection("attendance").doc(attendanceId).set({
        classId: currentTeacherClassId,
        className: currentTeacherClassName,
        date: dateStr,
        records,
        markedBy: currentUid,
        markedAt: Date.now(),
      });
      attendanceStatus.textContent = "Attendance saved.";
    } catch (err) {
      console.error(err);
      attendanceStatus.textContent = "Couldn't save attendance. Please try again.";
    }
    saveAttendanceBtn.disabled = false;
  });
}

// ---------- PARENT: view attendance ----------
async function loadParentAttendance(studentId, studentClassName, studentName) {
  const list = document.getElementById("parentAttendanceList");
  const title = document.getElementById("parentAttendanceTitle");
  if (!list) return;

  if (!studentId) {
    list.innerHTML = `<p class="card-copy">No linked student record found.</p>`;
    return;
  }
  if (title) title.textContent = studentName ? `${studentName}'s attendance` : "Attendance";
  list.innerHTML = `<p class="card-copy">Loading…</p>`;

  try {
    // We don't know the classId directly here in older records, so look
    // it up fresh from the student record to be safe.
    const studentSnap = await db.collection("students").doc(studentId).get();
    if (!studentSnap.exists) {
      list.innerHTML = `<p class="card-copy">Student record not found.</p>`;
      return;
    }
    const classId = studentSnap.data().classId;

    const snap = await db.collection("attendance").where("classId", "==", classId).get();
    const entries = [];
    snap.forEach((doc) => {
      const d = doc.data();
      if (d.records && d.records[studentId]) {
        entries.push({ date: d.date, status: d.records[studentId] });
      }
    });
    entries.sort((a, b) => (a.date < b.date ? 1 : -1)); // most recent first

    if (entries.length === 0) {
      list.innerHTML = `<p class="card-copy">No attendance records yet.</p>`;
      return;
    }

    list.innerHTML = "";
    entries.forEach((e) => {
      const row = document.createElement("div");
      row.className = "admin-doc-row";
      const statusClass = e.status === "present" ? "att-present-label" : "att-absent-label";
      row.innerHTML = `<span>${e.date}</span><span class="${statusClass}">${e.status === "present" ? "Present" : "Absent"}</span>`;
      list.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    list.innerHTML = `<p class="card-copy">Couldn't load attendance.</p>`;
  }
}
