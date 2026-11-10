
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

// ---------- BACKUP & TRANSFER ----------

const BACKUP_VERSION = 1;
const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const MAX_BACKUP_READINGS = 50000;

function normalizeBackupReading(reading, index) {
  const invalid = () => {
    throw new Error(`Reading ${index + 1} is invalid. No readings were imported.`);
  };
  if (!reading || typeof reading !== "object" || Array.isArray(reading)) invalid();
  const { date, time, systolic, diastolic, pulse, notes, createdAt } = reading;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) invalid();
  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) invalid();
  if (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) invalid();
  if (!Number.isInteger(systolic) || systolic < 50 || systolic > 300 ||
      !Number.isInteger(diastolic) || diastolic < 30 || diastolic > 200 ||
      !Number.isInteger(pulse) || pulse < 20 || pulse > 250) invalid();
  if (typeof notes !== "string" || typeof createdAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(createdAt) ||
      !Number.isFinite(Date.parse(createdAt)) || new Date(createdAt).toISOString() !== createdAt) invalid();
  // Device-local IDs must never be copied: another device can use the same ID.
  return { date, time, systolic, diastolic, pulse, notes, createdAt };
}

function parseBackup(text) {
  let backup;
  try {
    backup = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("This file is not valid JSON. Choose a BP Tracker export file.");
  }
  if (!backup || backup.app !== "BPTracker" || backup.version !== BACKUP_VERSION ||
      !Array.isArray(backup.readings)) {
    throw new Error("Unsupported backup. Choose a version 1 BP Tracker export file.");
  }
  if (backup.readings.length > MAX_BACKUP_READINGS) {
    throw new Error("This backup has too many readings (maximum 50,000).");
  }
  return backup.readings.map(normalizeBackupReading);
}

function readingFingerprint(reading) {
  return JSON.stringify([
    reading.date, reading.time, reading.systolic, reading.diastolic,
    reading.pulse, reading.notes, reading.createdAt
  ]);
}

function mergeBackupReadings(readings) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    let added = 0;
    let skipped = 0;
    request.onsuccess = () => {
      const seen = new Set(request.result.map(readingFingerprint));
      for (const reading of readings) {
        const fingerprint = readingFingerprint(reading);
        if (seen.has(fingerprint)) {
          skipped++;
        } else {
          store.add(reading);
          seen.add(fingerprint);
          added++;
        }
      }
    };
    // One transaction: failed writes roll back the entire import.
    transaction.oncomplete = () => resolve({ added, skipped });
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error("Import aborted."));
  });
}

function setBackupStatus(message, isError = false) {
  const status = document.getElementById("backupStatus");
  status.textContent = message;
  status.dataset.error = String(isError);
}

function setBackupBusy(busy) {
  document.getElementById("exportButton").disabled = busy;
  document.getElementById("importButton").disabled = busy;
}

document.getElementById("exportButton").addEventListener("click", async () => {
  setBackupBusy(true);
  try {
    const readings = (await getAllReadings()).map(normalizeBackupReading);
    const text = JSON.stringify({
      app: "BPTracker", version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(), readings
    }, null, 2);
    const blob = new Blob([text], { type: "application/json" });
    if (blob.size > MAX_BACKUP_BYTES || readings.length > MAX_BACKUP_READINGS) {
      throw new Error("This database exceeds the 10 MB / 50,000 reading backup limit.");
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bp-tracker-backup-${localDate()}-${localTime().replace(":", "")}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Allow mobile browsers time to start the download before releasing it.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    setBackupStatus(`Backup ready: ${readings.length} reading(s). Save the file, then import it on your other device.`);
  } catch (error) {
    console.error(error);
    setBackupStatus(error.message || "Could not export readings. Please try again.", true);
  } finally {
    setBackupBusy(false);
  }
});

const importFile = document.getElementById("importFile");
document.getElementById("importButton").addEventListener("click", () => importFile.click());

importFile.addEventListener("change", async () => {
  const file = importFile.files[0];
  if (!file) return;
  setBackupBusy(true);
  let committed = false;
  try {
    if (file.size > MAX_BACKUP_BYTES) {
      throw new Error("This file is too large. Choose a backup smaller than 10 MB.");
    }
    const readings = parseBackup(await file.text());
    if (!readings.length) {
      setBackupStatus("This backup is empty. Your existing readings are unchanged.");
      return;
    }
    if (!confirm(`Import ${readings.length} reading(s)? Existing readings will be kept and exact duplicates skipped.`)) {
      setBackupStatus("Import cancelled. Your existing readings are unchanged.");
      return;
    }
    let result;
    try {
      result = await mergeBackupReadings(readings);
    } catch (error) {
      console.error(error);
      throw new Error("Could not import the backup. No readings were added. Check available device storage and try again.");
    }
    committed = true;
    await refreshApp();
    setBackupStatus(`Import complete: ${result.added} added, ${result.skipped} duplicate(s) skipped.`);
  } catch (error) {
    console.error(error);
    setBackupStatus(committed
      ? "Your readings were imported, but the display could not refresh. Reopen the app to see them."
      : (error.message || "Could not read this backup. Your existing readings are unchanged."), true);
  } finally {
    importFile.value = "";
    setBackupBusy(false);
  }
});

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
      border-bottom: 1px solid var(--border);
    ">
      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:8px;
      ">
        <strong style="color:var(--dark-green);font-size:17px">
          ${reading.systolic} / ${reading.diastolic}
        </strong>
        <button
          type="button"
          data-delete="${reading.id}"
          style="
            border:0;
            background:var(--soft-green);
            color:var(--muted);
            border-radius:8px;
            padding:7px 10px;
            cursor:pointer;
          "
        >Delete</button>
      </div>
      <div style="color:var(--muted);font-size:12px;margin-top:5px">
        ${escapeHTML(formatDate(reading.date))}
        · ${escapeHTML(reading.time)}
        · Pulse ${reading.pulse} BPM
      </div>
      ${reading.notes ? `
        <div style="font-size:12px;margin-top:6px;color:var(--notes)">
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
    setBackupBusy(false);
    console.log("BP Tracker database ready.");
  } catch (error) {
    console.error(error);
    alert("Database unavailable. Please use a supported browser.");
  }
}

initializeApp();




// Register offline support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then(() => console.log("Offline support enabled"))
      .catch(error => console.error("Service worker error:", error));
  });
}


