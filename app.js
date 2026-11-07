
/* ==============================
   BP TRACKER - APP FUNCTIONALITY
   Local database: IndexedDB
   ============================== */

const DB_NAME = "BPTrackerDB";
const DB_VERSION = 1;
const STORE_NAME = "readings";

let db;

// ---------- DATE HELPERS ----------

function localDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function localTime(date = new Date()) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function formatDate(dateString) {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(
    undefined,
    { day: "numeric", month: "short", year: "numeric" }
  );
}

// ---------- DATABASE ----------

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(
          STORE_NAME,
          { keyPath: "id", autoIncrement: true }
        );

        store.createIndex("date", "date", { unique: false });
      }
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onerror = () => reject(request.error);
  });
}

function getAllReadings() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function saveToDatabase(reading) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");

    transaction.objectStore(STORE_NAME).add(reading);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function deleteFromDatabase(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");

    transaction.objectStore(STORE_NAME).delete(id);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// ---------- TIME CONTROLS ----------

const timeInput = document.getElementById("readingTime");

function adjustTime(hours) {
  if (!timeInput.value) {
    timeInput.value = localTime();
  }

  const [hour, minute] = timeInput.value.split(":").map(Number);

  const date = new Date();
  date.setHours(hour + hours, minute, 0, 0);

  timeInput.value = localTime(date);
}

document.getElementById("minusHour").addEventListener(
  "click", () => adjustTime(-1)
);

document.getElementById("plusHour").addEventListener(
  "click", () => adjustTime(1)
);

// ---------- SAVE READING ----------

document.getElementById("saveButton").addEventListener(
  "click", async () => {

    const systolic = Number(
      document.getElementById("systolic").value
    );

    const diastolic = Number(
      document.getElementById("diastolic").value
    );

    const pulse = Number(
      document.getElementById("pulse").value
    );

    const date = document.getElementById("customDate").value;
    const time = timeInput.value;

    const notes = document.getElementById("notes").value.trim();

    if (
      !Number.isInteger(systolic) || systolic < 50 || systolic > 300 ||
      !Number.isInteger(diastolic) || diastolic < 30 || diastolic > 200
    ) {
      alert("Please enter valid blood pressure readings.");
      return;
    }

    if (
      !Number.isInteger(pulse) || pulse < 20 || pulse > 250
    ) {
      alert("Please enter a valid pulse reading.");
      return;
    }

    if (!date || !time) {
      alert("Please select a date and time.");
      return;
    }

    const reading = {
      date,
      time,
      systolic,
      diastolic,
      pulse,
      notes,
      createdAt: new Date().toISOString()
    };

    const button = document.getElementById("saveButton");
    button.disabled = true;
    button.textContent = "Saving...";

    try {
      await saveToDatabase(reading);

      document.getElementById("systolic").value = "";
      document.getElementById("diastolic").value = "";
      document.getElementById("pulse").value = "";
      document.getElementById("notes").value = "";

      await refreshApp();

      alert("Reading saved successfully!");

    } catch (error) {
      console.error(error);
      alert("Could not save your reading. Please try again.");
    } finally {
      button.disabled = false;
      button.textContent = "Save reading";
    }
  }
);

// ---------- DELETE READING ----------

async function deleteReading(id) {
  if (!confirm("Delete this reading permanently?")) return;

  try {
    await deleteFromDatabase(id);
    await refreshApp();
  } catch (error) {
    console.error(error);
    alert("Could not delete reading.");
  }
}

// ---------- SAFE HTML ----------

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

// ---------- HISTORY ----------

async function displayHistory(readings) {
  const history = document.getElementById("history");

  const sorted = [...readings].sort((a, b) => {
    const first = `${a.date}T${a.time}`;
    const second = `${b.date}T${b.time}`;
    return second.localeCompare(first);
  });

  const recent = sorted.slice(0, 20);

  document.getElementById("readingCount").textContent =
    `${readings.length} reading${readings.length === 1 ? "" : "s"}`;

  if (recent.length === 0) {
    history.innerHTML =
      '<p class="empty">Your readings will appear here.</p>';
    return;
  }

  history.innerHTML = recent.map(reading => `
    <div style="
      padding: 13px 0;
      border-bottom: 1px solid #E0EAE1;
    ">
      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:8px;
      ">
        <strong style="color:#245C3C;font-size:17px">
          ${reading.systolic} / ${reading.diastolic}
        </strong>
        <button
          type="button"
          data-delete="${reading.id}"
          style="
            border:0;
            background:#F4F8F4;
            color:#829589;
            border-radius:8px;
            padding:7px 10px;
            cursor:pointer;
          "
        >Delete</button>
      </div>
      <div style="color:#829589;font-size:12px;margin-top:5px">
        ${escapeHTML(formatDate(reading.date))}
        · ${escapeHTML(reading.time)}
        · Pulse ${reading.pulse} BPM
      </div>
      ${reading.notes ? `
        <div style="font-size:12px;margin-top:6px;color:#52745D">
          ${escapeHTML(reading.notes)}
        </div>
      ` : ""}
    </div>
  `).join("");

  history.querySelectorAll("[data-delete]").forEach(button => {
    button.addEventListener("click", () => {
      deleteReading(Number(button.dataset.delete));
    });
  });
}

// ---------- WEEKLY AVERAGE ----------

function displayWeeklyAverage(readings) {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 6);

  const startDate = localDate(start);
  const endDate = localDate(today);

  const weekly = readings.filter(reading =>
    reading.date >= startDate && reading.date <= endDate
  );

  const averageElement = document.getElementById("weeklyAverage");

  if (weekly.length === 0) {
    averageElement.textContent = "-- / --";
    return;
  }

  const sys = weekly.reduce(
    (sum, r) => sum + r.systolic, 0
  ) / weekly.length;

  const dia = weekly.reduce(
    (sum, r) => sum + r.diastolic, 0
  ) / weekly.length;

  averageElement.textContent =
    `${Math.round(sys)} / ${Math.round(dia)}`;
}

// ---------- REFRESH ----------

async function refreshApp() {
  const readings = await getAllReadings();

  await displayHistory(readings);
  displayWeeklyAverage(readings);
}

// ---------- INITIALIZE ----------

async function initializeApp() {
  document.getElementById("todayDate").textContent =
    new Date().toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });

  document.getElementById("customDate").value = localDate();
  timeInput.value = localTime();

  try {
    await openDatabase();
    await refreshApp();
    console.log("BP Tracker database ready.");
  } catch (error) {
    console.error(error);
    alert("Database unavailable. Please use a supported browser.");
  }
}

initializeApp();
