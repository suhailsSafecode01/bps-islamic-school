const loadingCard = document.getElementById("loadingCard");
const notSignedInCard = document.getElementById("notSignedInCard");
const pendingCard = document.getElementById("pendingCard");
const adminCard = document.getElementById("adminCard");
const teacherCard = document.getElementById("teacherCard");
const parentCard = document.getElementById("parentCard");
const roleLabel = document.getElementById("roleLabel");
const signOutBtn = document.getElementById("signOutBtn");

function showOnly(el) {
  [notSignedInCard, pendingCard, adminCard, teacherCard, parentCard].forEach((c) => {
    c.classList.toggle("hidden", c !== el);
  });
  loadingCard.classList.add("hidden");
}

signOutBtn.addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "index.html";
});

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    showOnly(notSignedInCard);
    roleLabel.textContent = "Signed out";
    return;
  }

  try {
    const snap = await db.collection("users").doc(user.uid).get();
    if (!snap.exists) {
      // Shouldn't normally happen — treat as not fully set up yet
      showOnly(notSignedInCard);
      return;
    }
    const data = snap.data();

    if (data.role === "admin") {
      roleLabel.textContent = "Admin — " + user.email;
      showOnly(adminCard);
    } else if (data.role === "teacher") {
      if (data.approved) {
        roleLabel.textContent = "Teacher — " + user.email;
        showOnly(teacherCard);
      } else {
        roleLabel.textContent = "Teacher (pending) — " + user.email;
        showOnly(pendingCard);
      }
    } else {
      roleLabel.textContent = "Parent — " + user.email;
      showOnly(parentCard);
    }
  } catch (err) {
    console.error(err);
    showOnly(notSignedInCard);
  }
});
