const loadingCard = document.getElementById("loadingCard");
const notSignedInCard = document.getElementById("notSignedInCard");
const adminCard = document.getElementById("adminCard");
const pendingRequestsCard = document.getElementById("pendingRequestsCard");
const addMemberCard = document.getElementById("addMemberCard");
const manageClassesCard = document.getElementById("manageClassesCard");
const manageStudentsCard = document.getElementById("manageStudentsCard");
const sendNoticeCard = document.getElementById("sendNoticeCard");
const allResultsCard = document.getElementById("allResultsCard");
const setTimetableCard = document.getElementById("setTimetableCard");
const setFeesCard = document.getElementById("setFeesCard");
const teacherCard = document.getElementById("teacherCard");
const attendanceCard = document.getElementById("attendanceCard");
const teacherPostsCard = document.getElementById("teacherPostsCard");
const teacherResultsCard = document.getElementById("teacherResultsCard");
const teacherTimetableCard = document.getElementById("teacherTimetableCard");
const parentCard = document.getElementById("parentCard");
const documentsCard = document.getElementById("documentsCard");
const parentAttendanceCard = document.getElementById("parentAttendanceCard");
const parentNoticesCard = document.getElementById("parentNoticesCard");
const parentPostsCard = document.getElementById("parentPostsCard");
const parentResultsCard = document.getElementById("parentResultsCard");
const parentTimetableCard = document.getElementById("parentTimetableCard");
const parentFeesCard = document.getElementById("parentFeesCard");
const roleLabel = document.getElementById("roleLabel");
const signOutBtn = document.getElementById("signOutBtn");

const ALL_CARDS = [
  notSignedInCard, adminCard, pendingRequestsCard, addMemberCard, manageClassesCard, manageStudentsCard,
  sendNoticeCard, allResultsCard, setTimetableCard, setFeesCard,
  teacherCard, attendanceCard, teacherPostsCard, teacherResultsCard, teacherTimetableCard,
  parentCard, documentsCard, parentAttendanceCard, parentNoticesCard, parentPostsCard, parentResultsCard, parentTimetableCard, parentFeesCard,
];

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
      showOnly([adminCard, pendingRequestsCard, addMemberCard, manageClassesCard, manageStudentsCard, sendNoticeCard, allResultsCard, setTimetableCard, setFeesCard]);
      loadPendingRequests();
      await loadClasses(); // must finish first — dependent dropdowns need this cache
      loadMemberList();
      await loadStudents();
      populateFeesStudentDropdown();
      populateNoticeTargetDropdown();
      populateTimetableClassDropdown();
      loadAdminNotices();
      loadAllResults();
      loadAllFees();
    } else if (data.role === "teacher") {
      roleLabel.textContent = "Teacher — " + data.name;
      showOnly([teacherCard, attendanceCard, teacherPostsCard, teacherResultsCard, teacherTimetableCard]);
      currentTeacherClassId = data.classId || null;
      currentTeacherClassName = data.className || "";
      const label = document.getElementById("teacherClassLabel");
      if (label) label.textContent = currentTeacherClassId ? `Your class: ${currentTeacherClassName}` : "No class assigned yet — contact the school office.";
      loadAttendanceForToday();
      loadTeacherClassStudents();
      loadTeacherPosts();
      loadTeacherResults();
      loadTeacherTimetable();
      checkForNewContent(currentTeacherClassId);
    } else {
      roleLabel.textContent = "Parent — " + data.name;
      showOnly([parentCard, documentsCard, parentAttendanceCard, parentNoticesCard, parentPostsCard, parentResultsCard, parentTimetableCard, parentFeesCard]);
      currentUserId = user.uid;
      renderDocuments(data.documents || {});
      loadParentAttendance(data.studentId, data.studentClassName, data.studentName);
      const parentClassId = await resolveStudentClassId(data.studentId);
      loadParentNotices(parentClassId);
      loadParentPosts(parentClassId);
      loadParentResults(data.studentId);
      loadParentTimetable(parentClassId);
      loadParentFees(data.studentId);
      checkForNewContent(parentClassId);
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
      const canRemove = d.role !== "admin";
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

const MAX_FILE_SIZE = 8 * 1024 * 1024;
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
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
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
  if (error) { documentsStatus.textContent = error; return; }

  btn.disabled = true;
  documentsStatus.textContent = "Uploading…";

  try {
    const url = await uploadFileToCloudinary(file);
    const snap = await db.collection("users").doc(currentUserId).get();
    const existing = snap.data().documents || {};
    existing[docKey] = { url, fileName: file.name, uploadedAt: Date.now() };
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
    if (!label) { documentsStatus.textContent = "Please give this document a name."; return; }
    const error = validateFile(file);
    if (error) { documentsStatus.textContent = error; return; }

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
  if (!name) { classStatus.textContent = "Please enter a class name."; return; }
  const classId = slugify(name);
  if (!classId) { classStatus.textContent = "Please enter a valid class name."; return; }

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
  if (!panel.classList.contains("hidden")) { panel.classList.add("hidden"); return; }
  panel.classList.remove("hidden");
  panel.innerHTML = `<p class="card-copy">Loading…</p>`;
  try {
    let parentSnap = await db.collection("users").where("studentId", "==", studentId).get();
    let parentDoc = null;
    parentSnap.forEach((doc) => { parentDoc = doc.data(); });
    if (!parentDoc) {
      const fallback = await db.collection("users").where("admissionNumber", "==", admissionNumber).get();
      fallback.forEach((doc) => { parentDoc = doc.data(); });
    }
    if (!parentDoc) { panel.innerHTML = `<p class="card-copy">No parent has registered for this student yet.</p>`; return; }
    if (parentDoc.status === "pending") { panel.innerHTML = `<p class="card-copy">A parent has registered but is still pending approval.</p>`; return; }
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
    if (!q) { renderStudents(cachedStudents); return; }
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
    if (!dateStr) { attendanceStatus.textContent = "Please choose a date."; return; }
    if (!currentTeacherClassId) { attendanceStatus.textContent = "No class assigned."; return; }

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

async function loadParentAttendance(studentId, studentClassName, studentName) {
  const list = document.getElementById("parentAttendanceList");
  const title = document.getElementById("parentAttendanceTitle");
  if (!list) return;
  if (!studentId) { list.innerHTML = `<p class="card-copy">No linked student record found.</p>`; return; }
  if (title) title.textContent = studentName ? `${studentName}'s attendance` : "Attendance";
  list.innerHTML = `<p class="card-copy">Loading…</p>`;
  try {
    const studentSnap = await db.collection("students").doc(studentId).get();
    if (!studentSnap.exists) { list.innerHTML = `<p class="card-copy">Student record not found.</p>`; return; }
    const classId = studentSnap.data().classId;
    const snap = await db.collection("attendance").where("classId", "==", classId).get();
    const entries = [];
    snap.forEach((doc) => {
      const d = doc.data();
      if (d.records && d.records[studentId]) entries.push({ date: d.date, status: d.records[studentId] });
    });
    entries.sort((a, b) => (a.date < b.date ? 1 : -1));
    if (entries.length === 0) { list.innerHTML = `<p class="card-copy">No attendance records yet.</p>`; return; }
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

// ---------- SHARED HELPER ----------
async function resolveStudentClassId(studentId) {
  if (!studentId) return null;
  try {
    const snap = await db.collection("students").doc(studentId).get();
    return snap.exists ? snap.data().classId : null;
  } catch (err) {
    return null;
  }
}

// ---------- ADMIN: SEND NOTICES ----------
const noticeTitle = document.getElementById("noticeTitle");
const noticeBody = document.getElementById("noticeBody");
const noticeTarget = document.getElementById("noticeTarget");
const postNoticeBtn = document.getElementById("postNoticeBtn");
const noticeStatus = document.getElementById("noticeStatus");
const noticeListAdmin = document.getElementById("noticeListAdmin");

function populateNoticeTargetDropdown() {
  if (!noticeTarget) return;
  const options = ['<option value="">Everyone (whole school)</option>']
    .concat(cachedClasses.map((c) => `<option value="${c.id}">${c.name} only</option>`));
  noticeTarget.innerHTML = options.join("");
}

if (postNoticeBtn) {
  postNoticeBtn.addEventListener("click", async () => {
    const title = noticeTitle.value.trim();
    const body = noticeBody.value.trim();
    const classId = noticeTarget.value || null;
    if (!title || !body) { noticeStatus.textContent = "Please fill in both title and message."; return; }

    postNoticeBtn.disabled = true;
    noticeStatus.textContent = "Sending…";
    try {
      const className = classId ? (cachedClasses.find((c) => c.id === classId) || {}).name || "" : "";
      await db.collection("posts").add({
        category: "notice", title, body, classId, className,
        postedByRole: "admin", postedByName: "Principal",
        createdAt: Date.now(),
      });
      noticeTitle.value = "";
      noticeBody.value = "";
      noticeStatus.textContent = "Notice sent.";
      loadAdminNotices();
    } catch (err) {
      console.error(err);
      noticeStatus.textContent = "Couldn't send notice. Please try again.";
    }
    postNoticeBtn.disabled = false;
  });
}

async function loadAdminNotices() {
  if (!noticeListAdmin) return;
  noticeListAdmin.innerHTML = `<p class="card-copy">Loading…</p>`;
  try {
    const snap = await db.collection("posts").where("category", "==", "notice").get();
    const notices = [];
    snap.forEach((doc) => notices.push({ id: doc.id, ...doc.data() }));
    notices.sort((a, b) => b.createdAt - a.createdAt);
    if (notices.length === 0) { noticeListAdmin.innerHTML = `<p class="card-copy">No notices sent yet.</p>`; return; }
    noticeListAdmin.innerHTML = notices.map((n) => `
      <div class="doc-row">
        <div class="doc-label">${n.title} ${n.classId ? `<span class="member-role">${n.className}</span>` : `<span class="member-role">Everyone</span>`}</div>
        <p class="card-copy" style="margin-top:0.3rem;">${n.body}</p>
        <button class="btn-remove delete-item-btn" data-coll="posts" data-id="${n.id}" data-reload="loadAdminNotices">Delete</button>
      </div>
    `).join("");
    wireDeleteButtons(noticeListAdmin);
  } catch (err) {
    noticeListAdmin.innerHTML = `<p class="card-copy">Couldn't load notices.</p>`;
  }
}

function wireDeleteButtons(container) {
  container.querySelectorAll(".delete-item-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this? This cannot be undone.")) return;
      btn.disabled = true;
      try {
        await db.collection(btn.dataset.coll).doc(btn.dataset.id).delete();
        window[btn.dataset.reload]();
      } catch (err) {
        console.error(err);
        alert("Couldn't delete. Please try again.");
        btn.disabled = false;
      }
    });
  });
}

// ---------- ADMIN: ALL RESULTS ----------
const allResultsList = document.getElementById("allResultsList");

async function loadAllResults() {
  if (!allResultsList) return;
  allResultsList.innerHTML = `<p class="card-copy">Loading…</p>`;
  try {
    const snap = await db.collection("results").get();
    const results = [];
    snap.forEach((doc) => results.push({ id: doc.id, ...doc.data() }));
    results.sort((a, b) => b.createdAt - a.createdAt);
    if (results.length === 0) { allResultsList.innerHTML = `<p class="card-copy">No results uploaded yet.</p>`; return; }
    allResultsList.innerHTML = results.map((r) => `
      <div class="admin-doc-row">
        <span>${r.studentName} — ${r.subject} (${r.term}): ${r.marks}/${r.maxMarks}</span>
        <button class="btn-remove delete-item-btn" data-coll="results" data-id="${r.id}" data-reload="loadAllResults">Delete</button>
      </div>
    `).join("");
    wireDeleteButtons(allResultsList);
  } catch (err) {
    allResultsList.innerHTML = `<p class="card-copy">Couldn't load results.</p>`;
  }
}

// ---------- ADMIN: TIMETABLE ----------
const timetableClassSelect = document.getElementById("timetableClassSelect");
const timetableText = document.getElementById("timetableText");
const saveTimetableBtn = document.getElementById("saveTimetableBtn");
const timetableStatus = document.getElementById("timetableStatus");

function populateTimetableClassDropdown() {
  if (!timetableClassSelect) return;
  timetableClassSelect.innerHTML = cachedClasses.length
    ? cachedClasses.map((c) => `<option value="${c.id}">${c.name}</option>`).join("")
    : `<option value="">No classes yet</option>`;
  if (cachedClasses.length > 0) loadTimetableIntoEditor(cachedClasses[0].id);
}
if (timetableClassSelect) {
  timetableClassSelect.addEventListener("change", () => loadTimetableIntoEditor(timetableClassSelect.value));
}

async function loadTimetableIntoEditor(classId) {
  if (!classId) { timetableText.value = ""; return; }
  try {
    const snap = await db.collection("timetables").doc(classId).get();
    timetableText.value = snap.exists ? snap.data().scheduleText : "";
  } catch (err) {
    timetableText.value = "";
  }
}

if (saveTimetableBtn) {
  saveTimetableBtn.addEventListener("click", async () => {
    const classId = timetableClassSelect.value;
    if (!classId) { timetableStatus.textContent = "Please add a class first."; return; }
    const className = (cachedClasses.find((c) => c.id === classId) || {}).name || "";

    saveTimetableBtn.disabled = true;
    timetableStatus.textContent = "Saving…";
    try {
      await db.collection("timetables").doc(classId).set({
        classId, className,
        scheduleText: timetableText.value,
        updatedAt: Date.now(),
      });
      timetableStatus.textContent = "Timetable saved.";
    } catch (err) {
      console.error(err);
      timetableStatus.textContent = "Couldn't save. Please try again.";
    }
    saveTimetableBtn.disabled = false;
  });
}

// ---------- TEACHER: CLASS POSTS ----------
const postCategory = document.getElementById("postCategory");
const postTitle = document.getElementById("postTitle");
const postBody = document.getElementById("postBody");
const submitPostBtn = document.getElementById("submitPostBtn");
const postStatus = document.getElementById("postStatus");
const teacherPostsList = document.getElementById("teacherPostsList");

if (submitPostBtn) {
  submitPostBtn.addEventListener("click", async () => {
    const title = postTitle.value.trim();
    const body = postBody.value.trim();
    const category = postCategory.value;
    if (!title || !body) { postStatus.textContent = "Please fill in both title and details."; return; }
    if (!currentTeacherClassId) { postStatus.textContent = "No class assigned."; return; }

    submitPostBtn.disabled = true;
    postStatus.textContent = "Posting…";
    try {
      await db.collection("posts").add({
        category, title, body,
        classId: currentTeacherClassId,
        className: currentTeacherClassName,
        postedByRole: "teacher",
        postedByName: roleLabel.textContent.replace("Teacher — ", ""),
        createdAt: Date.now(),
      });
      postTitle.value = "";
      postBody.value = "";
      postStatus.textContent = "Posted.";
      loadTeacherPosts();
    } catch (err) {
      console.error(err);
      postStatus.textContent = "Couldn't post. Please try again.";
    }
    submitPostBtn.disabled = false;
  });
}

async function loadTeacherPosts() {
  if (!teacherPostsList || !currentTeacherClassId) return;
  teacherPostsList.innerHTML = `<p class="card-copy">Loading…</p>`;
  try {
    const snap = await db.collection("posts").where("classId", "==", currentTeacherClassId).get();
    const posts = [];
    snap.forEach((doc) => { if (doc.data().category !== "notice") posts.push({ id: doc.id, ...doc.data() }); });
    posts.sort((a, b) => b.createdAt - a.createdAt);
    if (posts.length === 0) { teacherPostsList.innerHTML = `<p class="card-copy">No posts yet.</p>`; return; }
    const catLabels = { homework: "Homework", notes: "Notes", announcement: "Announcement" };
    teacherPostsList.innerHTML = posts.map((p) => `
      <div class="doc-row">
        <div class="doc-label">${p.title} <span class="member-role">${catLabels[p.category] || p.category}</span></div>
        <p class="card-copy" style="margin-top:0.3rem;">${p.body}</p>
        <button class="btn-remove delete-item-btn" data-coll="posts" data-id="${p.id}" data-reload="loadTeacherPosts">Delete</button>
      </div>
    `).join("");
    wireDeleteButtons(teacherPostsList);
  } catch (err) {
    teacherPostsList.innerHTML = `<p class="card-copy">Couldn't load posts.</p>`;
  }
}

// ---------- TEACHER: RESULTS ----------
const resultStudent = document.getElementById("resultStudent");
const resultSubject = document.getElementById("resultSubject");
const resultTerm = document.getElementById("resultTerm");
const resultMarks = document.getElementById("resultMarks");
const resultMaxMarks = document.getElementById("resultMaxMarks");
const submitResultBtn = document.getElementById("submitResultBtn");
const resultStatus = document.getElementById("resultStatus");
const teacherResultsList = document.getElementById("teacherResultsList");

async function loadTeacherClassStudents() {
  if (!resultStudent || !currentTeacherClassId) return;
  try {
    const snap = await db.collection("students").where("classId", "==", currentTeacherClassId).get();
    const students = [];
    snap.forEach((doc) => students.push({ id: doc.id, ...doc.data() }));
    students.sort((a, b) => a.name.localeCompare(b.name));
    resultStudent.innerHTML = students.length
      ? students.map((s) => `<option value="${s.id}" data-name="${s.name}">${s.name}</option>`).join("")
      : `<option value="">No students in your class</option>`;
  } catch (err) {
    resultStudent.innerHTML = `<option value="">Couldn't load students</option>`;
  }
}

if (submitResultBtn) {
  submitResultBtn.addEventListener("click", async () => {
    const studentId = resultStudent.value;
    const studentName = resultStudent.selectedOptions[0] ? resultStudent.selectedOptions[0].dataset.name : "";
    const subject = resultSubject.value.trim();
    const term = resultTerm.value.trim();
    const marks = resultMarks.value.trim();
    const maxMarks = resultMaxMarks.value.trim();
    if (!studentId) { resultStatus.textContent = "Please choose a student."; return; }
    if (!subject || !term || !marks || !maxMarks) { resultStatus.textContent = "Please fill in all fields."; return; }

    submitResultBtn.disabled = true;
    resultStatus.textContent = "Saving…";
    try {
      await db.collection("results").add({
        studentId, studentName, subject, term,
        marks: Number(marks), maxMarks: Number(maxMarks),
        classId: currentTeacherClassId,
        createdAt: Date.now(),
      });
      resultSubject.value = "";
      resultTerm.value = "";
      resultMarks.value = "";
      resultMaxMarks.value = "";
      resultStatus.textContent = "Result saved.";
      loadTeacherResults();
    } catch (err) {
      console.error(err);
      resultStatus.textContent = "Couldn't save. Please try again.";
    }
    submitResultBtn.disabled = false;
  });
}

async function loadTeacherResults() {
  if (!teacherResultsList || !currentTeacherClassId) return;
  teacherResultsList.innerHTML = `<p class="card-copy">Loading…</p>`;
  try {
    const snap = await db.collection("results").where("classId", "==", currentTeacherClassId).get();
    const results = [];
    snap.forEach((doc) => results.push({ id: doc.id, ...doc.data() }));
    results.sort((a, b) => b.createdAt - a.createdAt);
    if (results.length === 0) { teacherResultsList.innerHTML = `<p class="card-copy">No results uploaded yet.</p>`; return; }
    teacherResultsList.innerHTML = results.map((r) => `
      <div class="admin-doc-row">
        <span>${r.studentName} — ${r.subject} (${r.term}): ${r.marks}/${r.maxMarks}</span>
        <button class="btn-remove delete-item-btn" data-coll="results" data-id="${r.id}" data-reload="loadTeacherResults">Delete</button>
      </div>
    `).join("");
    wireDeleteButtons(teacherResultsList);
  } catch (err) {
    teacherResultsList.innerHTML = `<p class="card-copy">Couldn't load results.</p>`;
  }
}

// ---------- TEACHER: TIMETABLE VIEW ----------
async function loadTeacherTimetable() {
  const view = document.getElementById("teacherTimetableView");
  if (!view || !currentTeacherClassId) return;
  view.innerHTML = `<p class="card-copy">Loading…</p>`;
  try {
    const snap = await db.collection("timetables").doc(currentTeacherClassId).get();
    view.innerHTML = snap.exists && snap.data().scheduleText
      ? `<p class="card-copy" style="white-space:pre-wrap;">${snap.data().scheduleText}</p>`
      : `<p class="card-copy">No timetable set yet.</p>`;
  } catch (err) {
    view.innerHTML = `<p class="card-copy">Couldn't load timetable.</p>`;
  }
}

// ---------- PARENT: NOTICES ----------
async function loadParentNotices(classId) {
  const list = document.getElementById("parentNoticesList");
  if (!list) return;
  list.innerHTML = `<p class="card-copy">Loading…</p>`;
  try {
    const snap = await db.collection("posts").where("category", "==", "notice").get();
    const notices = [];
    snap.forEach((doc) => {
      const d = doc.data();
      if (!d.classId || d.classId === classId) notices.push(d);
    });
    notices.sort((a, b) => b.createdAt - a.createdAt);
    list.innerHTML = notices.length
      ? notices.map((n) => `<div class="doc-row"><div class="doc-label">${n.title}</div><p class="card-copy" style="margin-top:0.3rem;">${n.body}</p></div>`).join("")
      : `<p class="card-copy">No notices yet.</p>`;
  } catch (err) {
    list.innerHTML = `<p class="card-copy">Couldn't load notices.</p>`;
  }
}

// ---------- PARENT: CLASS POSTS ----------
async function loadParentPosts(classId) {
  const list = document.getElementById("parentPostsList");
  if (!list) return;
  if (!classId) { list.innerHTML = `<p class="card-copy">No class linked yet.</p>`; return; }
  list.innerHTML = `<p class="card-copy">Loading…</p>`;
  try {
    const snap = await db.collection("posts").where("classId", "==", classId).get();
    const posts = [];
    snap.forEach((doc) => { if (doc.data().category !== "notice") posts.push(doc.data()); });
    posts.sort((a, b) => b.createdAt - a.createdAt);
    const catLabels = { homework: "Homework", notes: "Notes", announcement: "Announcement" };
    list.innerHTML = posts.length
      ? posts.map((p) => `<div class="doc-row"><div class="doc-label">${p.title} <span class="member-role">${catLabels[p.category] || p.category}</span></div><p class="card-copy" style="margin-top:0.3rem;">${p.body}</p></div>`).join("")
      : `<p class="card-copy">Nothing posted yet.</p>`;
  } catch (err) {
    list.innerHTML = `<p class="card-copy">Couldn't load updates.</p>`;
  }
}

// ---------- PARENT: RESULTS ----------
async function loadParentResults(studentId) {
  const list = document.getElementById("parentResultsList");
  if (!list) return;
  if (!studentId) { list.innerHTML = `<p class="card-copy">No linked student record found.</p>`; return; }
  list.innerHTML = `<p class="card-copy">Loading…</p>`;
  try {
    const snap = await db.collection("results").where("studentId", "==", studentId).get();
    const results = [];
    snap.forEach((doc) => results.push(doc.data()));
    results.sort((a, b) => b.createdAt - a.createdAt);
    list.innerHTML = results.length
      ? results.map((r) => `<div class="admin-doc-row"><span>${r.subject} (${r.term})</span><span>${r.marks}/${r.maxMarks}</span></div>`).join("")
      : `<p class="card-copy">No results yet.</p>`;
  } catch (err) {
    list.innerHTML = `<p class="card-copy">Couldn't load results.</p>`;
  }
}

// ---------- PARENT: TIMETABLE ----------
async function loadParentTimetable(classId) {
  const view = document.getElementById("parentTimetableView");
  if (!view) return;
  if (!classId) { view.innerHTML = `<p class="card-copy">No class linked yet.</p>`; return; }
  view.innerHTML = `<p class="card-copy">Loading…</p>`;
  try {
    const snap = await db.collection("timetables").doc(classId).get();
    view.innerHTML = snap.exists && snap.data().scheduleText
      ? `<p class="card-copy" style="white-space:pre-wrap;">${snap.data().scheduleText}</p>`
      : `<p class="card-copy">No timetable set yet.</p>`;
  } catch (err) {
    view.innerHTML = `<p class="card-copy">Couldn't load timetable.</p>`;
  }
}

// ---------- ADMIN: CLEAR TIMETABLE ----------
const clearTimetableBtn = document.getElementById("clearTimetableBtn");
if (clearTimetableBtn) {
  clearTimetableBtn.addEventListener("click", async () => {
    const classId = timetableClassSelect.value;
    if (!classId) return;
    if (!confirm("Clear this class's timetable?")) return;
    try {
      await db.collection("timetables").doc(classId).delete();
      timetableText.value = "";
      timetableStatus.textContent = "Timetable cleared.";
    } catch (err) {
      timetableStatus.textContent = "Couldn't clear. Please try again.";
    }
  });
}

// ---------- ADMIN: FEES ----------
const feesStudentSelect = document.getElementById("feesStudentSelect");
const feesAmount = document.getElementById("feesAmount");
const feesNote = document.getElementById("feesNote");
const feesTypePicker = document.getElementById("feesTypePicker");
const submitFeesBtn = document.getElementById("submitFeesBtn");
const feesStatus = document.getElementById("feesStatus");
const allFeesList = document.getElementById("allFeesList");

let selectedFeesType = "charge";
if (feesTypePicker) {
  feesTypePicker.querySelectorAll(".role-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      feesTypePicker.querySelectorAll(".role-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedFeesType = btn.dataset.type;
    });
  });
}

function populateFeesStudentDropdown() {
  if (!feesStudentSelect) return;
  feesStudentSelect.innerHTML = cachedStudents.length
    ? cachedStudents.map((s) => `<option value="${s.id}" data-name="${s.name}">${s.name} (${s.className || "no class"})</option>`).join("")
    : `<option value="">No students yet</option>`;
}

if (submitFeesBtn) {
  submitFeesBtn.addEventListener("click", async () => {
    const studentId = feesStudentSelect.value;
    const studentName = feesStudentSelect.selectedOptions[0] ? feesStudentSelect.selectedOptions[0].dataset.name : "";
    const amount = Number(feesAmount.value);
    const note = feesNote.value.trim();

    if (!studentId) { feesStatus.textContent = "Please choose a student."; return; }
    if (!amount || amount <= 0) { feesStatus.textContent = "Please enter a valid amount."; return; }

    submitFeesBtn.disabled = true;
    feesStatus.textContent = "Saving…";
    try {
      const snap = await db.collection("fees").doc(studentId).get();
      const existing = snap.exists ? snap.data() : { studentId, studentName, amountDue: 0, history: [] };
      const delta = selectedFeesType === "charge" ? amount : -amount;
      existing.amountDue = (existing.amountDue || 0) + delta;
      existing.studentName = studentName;
      existing.history = existing.history || [];
      existing.history.push({ type: selectedFeesType, amount, note, date: Date.now() });
      await db.collection("fees").doc(studentId).set(existing);

      feesAmount.value = "";
      feesNote.value = "";
      feesStatus.textContent = "Saved.";
      loadAllFees();
    } catch (err) {
      console.error(err);
      feesStatus.textContent = "Couldn't save. Please try again.";
    }
    submitFeesBtn.disabled = false;
  });
}

async function loadAllFees() {
  if (!allFeesList) return;
  allFeesList.innerHTML = `<p class="card-copy">Loading…</p>`;
  try {
    const snap = await db.collection("fees").get();
    const fees = [];
    snap.forEach((doc) => fees.push({ id: doc.id, ...doc.data() }));
    fees.sort((a, b) => (b.amountDue || 0) - (a.amountDue || 0));
    if (fees.length === 0) { allFeesList.innerHTML = `<p class="card-copy">No fee records yet.</p>`; return; }
    allFeesList.innerHTML = fees.map((f) => `
      <div class="admin-doc-row">
        <span>${f.studentName}</span>
        <span class="${f.amountDue > 0 ? "att-absent-label" : "att-present-label"}">₹${f.amountDue || 0} ${f.amountDue > 0 ? "due" : "clear"}</span>
        <button class="btn-remove delete-item-btn" data-coll="fees" data-id="${f.id}" data-reload="loadAllFees">Delete</button>
      </div>
    `).join("");
    wireDeleteButtons(allFeesList);
  } catch (err) {
    allFeesList.innerHTML = `<p class="card-copy">Couldn't load fees.</p>`;
  }
}

// ---------- PARENT: FEES VIEW ----------
async function loadParentFees(studentId) {
  const view = document.getElementById("parentFeesView");
  if (!view) return;
  if (!studentId) { view.innerHTML = `<p class="card-copy">No linked student record found.</p>`; return; }
  view.innerHTML = `<p class="card-copy">Loading…</p>`;
  try {
    const snap = await db.collection("fees").doc(studentId).get();
    if (!snap.exists || !snap.data().amountDue) {
      view.innerHTML = `<p class="card-copy att-present-label">No pending fees. ✓</p>`;
      return;
    }
    const data = snap.data();
    view.innerHTML = `
      <div class="admin-doc-row">
        <span>Amount due</span>
        <span class="att-absent-label">₹${data.amountDue}</span>
      </div>
      <p class="card-copy" style="margin-top:0.6rem;">Please contact the school office to pay.</p>
    `;
  } catch (err) {
    view.innerHTML = `<p class="card-copy">Couldn't load fees.</p>`;
  }
}

// ---------- IN-APP NOTIFICATION BANNER ----------
const notifBanner = document.getElementById("notifBanner");
const notifBannerText = document.getElementById("notifBannerText");
const notifBannerDismiss = document.getElementById("notifBannerDismiss");

if (notifBannerDismiss) {
  notifBannerDismiss.addEventListener("click", () => {
    notifBanner.classList.add("hidden");
    localStorage.setItem("bps_lastSeenNotif", String(Date.now()));
  });
}

async function checkForNewContent(classIdFilter) {
  if (!notifBanner) return;
  try {
    const lastSeen = Number(localStorage.getItem("bps_lastSeenNotif") || 0);
    const snap = await db.collection("posts").get();
    let found = false;
    snap.forEach((doc) => {
      const d = doc.data();
      const relevant = !d.classId || d.classId === classIdFilter;
      if (relevant && d.createdAt > lastSeen) found = true;
    });
    if (found) {
      notifBannerText.textContent = "📢 New notices or updates are available below";
      notifBanner.classList.remove("hidden");
    }
  } catch (err) {
    // fail silently — banner is a nice-to-have, not critical
  }
}
