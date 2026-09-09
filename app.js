const API_URL = "http://127.0.0.1:8000";

const form = document.querySelector("#questionForm");
const input = document.querySelector("#questionInput");
const askButton = document.querySelector("#askButton");
const messages = document.querySelector("#messages");
const quickSuggestions = document.querySelector("#quickSuggestions");
const errorPanel = document.querySelector("#errorPanel");
const apiStatus = document.querySelector("#apiStatus");
const connectionText = document.querySelector("#connectionText");
const themeToggle = document.querySelector("#themeToggle");
const clearChatButton = document.querySelector("#clearChat");

let isSending = false;

/* ---------- Connection status ---------- */
function setConnection(online) {
  apiStatus.classList.toggle("online", online);
  apiStatus.classList.toggle("offline", !online);
  connectionText.textContent = online ? "المساعد متصل" : "الخدمة غير متاحة";
}

async function checkHealth() {
  try {
    const response = await fetch(`${API_URL}/health`);
    setConnection(response.ok);
  } catch {
    setConnection(false);
  }
}

/* ---------- Helpers ---------- */
function showError(message) {
  errorPanel.textContent = message;
  errorPanel.hidden = false;
}

function clearError() {
  errorPanel.hidden = true;
  errorPanel.textContent = "";
}

function nowTime() {
  return new Date().toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
}

function scrollToBottom() {
  messages.scrollTop = messages.scrollHeight;
}

function createSourceToggle(count) {
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "source-toggle";
  toggle.textContent = `عرض المصادر (${count})`;

  const chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  chevron.setAttribute("viewBox", "0 0 24 24");
  chevron.setAttribute("width", "14");
  chevron.setAttribute("height", "14");
  chevron.setAttribute("fill", "none");
  chevron.setAttribute("stroke", "currentColor");
  chevron.setAttribute("stroke-width", "2");
  chevron.setAttribute("stroke-linecap", "round");
  chevron.setAttribute("stroke-linejoin", "round");
  const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyline.setAttribute("points", "6 9 12 15 18 9");
  chevron.appendChild(polyline);

  toggle.appendChild(chevron);

  const box = document.createElement("div");
  box.className = "sources-box";

  toggle.addEventListener("click", () => {
    const open = box.classList.toggle("open");
    toggle.classList.toggle("open", open);
    const label = toggle.childNodes[0];
    label.textContent = open ? "إخفاء المصادر" : `عرض المصادر (${count})`;
  });

  return { toggle, box };
}

function addBotSources(container, sources) {
  if (!sources || sources.length === 0) return;

  const { toggle, box } = createSourceToggle(sources.length);
  container.appendChild(toggle);

  sources.forEach((source, index) => {
    const item = document.createElement("div");
    item.className = "source-item";

    const head = document.createElement("div");
    head.className = "source-head";
    const score = Number(source.score || 0).toFixed(3);
    head.textContent = `مصدر ${index + 1} · الصلة ${score}`;

    const text = document.createElement("div");
    text.textContent = source.text || "";

    item.appendChild(head);
    item.appendChild(text);
    box.appendChild(item);
  });

  container.appendChild(box);
}

function addMessage(role, text, sources) {
  const row = document.createElement("div");
  row.className = `message-row ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = role === "bot" ? "NWC" : "أنت";

  const content = document.createElement("div");
  content.className = "message-content";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  bubble.appendChild(paragraph);

  if (role === "bot" && sources) {
    addBotSources(bubble, sources);
  }

  content.appendChild(bubble);

  const time = document.createElement("span");
  time.className = "message-time";
  time.textContent = nowTime();
  content.appendChild(time);

  row.appendChild(avatar);
  row.appendChild(content);
  messages.appendChild(row);
  scrollToBottom();
}

function addTypingIndicator() {
  const row = document.createElement("div");
  row.className = "typing-row";
  row.id = "typingIndicator";

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = "NWC";

  const dots = document.createElement("div");
  dots.className = "typing-dots";
  dots.setAttribute("role", "status");
  dots.setAttribute("aria-label", "المساعد يكتب الآن");

  for (let i = 0; i < 3; i += 1) {
    dots.appendChild(document.createElement("i"));
  }

  row.appendChild(avatar);
  row.appendChild(dots);
  messages.appendChild(row);
  scrollToBottom();
}

function removeTypingIndicator() {
  const indicator = document.querySelector("#typingIndicator");
  if (indicator) indicator.remove();
}

/* ---------- Auto-grow textarea ---------- */
function autoGrow() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 150)}px`;
}

/* ---------- Ask the API ---------- */
async function askQuestion(question) {
  clearError();
  addMessage("user", question);
  isSending = true;
  askButton.disabled = true;
  askButton.classList.add("busy");
  input.value = "";
  input.style.height = "auto";
  if (quickSuggestions) quickSuggestions.hidden = true;
  addTypingIndicator();

  try {
    const response = await fetch(`${API_URL}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("استجابة غير صالحة من الخادم");
    }

    if (!response.ok) {
      throw new Error(result.error || "تعذر الحصول على الإجابة");
    }

    addMessage("bot", result.answer || "لم يتم العثور على إجابة.", result.sources);
    setConnection(true);
  } catch (error) {
    setConnection(false);
    showError(
      `تعذر الاتصال بالمساعد. تأكد من تشغيل API على المنفذ 8000. التفاصيل: ${error.message}`
    );
  } finally {
    removeTypingIndicator();
    isSending = false;
    askButton.disabled = false;
    askButton.classList.remove("busy");
  }
}

/* ---------- Events ---------- */
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const question = input.value.trim();
  if (!question) {
    input.focus();
    showError("اكتب سؤالك أولاً.");
    return;
  }
  askQuestion(question);
});

input.addEventListener("input", autoGrow);
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !isSending) {
    event.preventDefault();
    form.requestSubmit();
  }
});

document.querySelectorAll("[data-question]").forEach((button) => {
  button.addEventListener("click", () => {
    input.value = button.dataset.question;
    input.focus();
    autoGrow();
  });
});

if (clearChatButton) {
  clearChatButton.addEventListener("click", () => {
    messages.replaceChildren();
    if (quickSuggestions) quickSuggestions.hidden = false;
    addMessage("bot", "تم مسح المحادثة. كيف يمكنني مساعدتك اليوم؟");
  });
}

/* ---------- Theme ---------- */
function applyTheme(dark) {
  document.body.classList.toggle("dark", dark);
}

themeToggle.addEventListener("click", () => {
  const dark = document.body.classList.toggle("dark");
  localStorage.setItem("nwc-theme", dark ? "dark" : "light");
});

if (localStorage.getItem("nwc-theme") === "dark") {
  applyTheme(true);
}

// Stamp the initial greeting with the current time.
const greetingTime = document.querySelector(".message-row.bot .message-time");
if (greetingTime && !greetingTime.textContent) {
  greetingTime.textContent = nowTime();
}

checkHealth();
