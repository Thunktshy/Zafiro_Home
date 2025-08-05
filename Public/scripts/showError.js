// showError.js
// showError.js
export function showError(message) {
  const box = document.getElementById("error-message-box");
  if (!box) return;

  box.textContent = message;
  box.style.display = "block";

  // Wait 3 seconds, then hide and clear
  setTimeout(() => {
    box.textContent = "";
    box.style.display = "none";
  }, 3000);
}



