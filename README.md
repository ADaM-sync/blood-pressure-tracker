# BP Tracker 🌿

A simple, privacy-first blood pressure tracker for everyday use.

Record your readings, review weekly averages, and keep your health history in one place without creating an account.

**Your readings. Your device. Your privacy.**

**[Open BP Tracker →](https://adam-sync.github.io/blood-pressure-tracker/)**

## 🚀 Features

### 🩺 Daily readings
Record systolic and diastolic blood pressure, pulse, and notes in a simple interface.

### 🕒 Flexible date and time
Choose when a reading was taken, with quick ±1 hour adjustments.

### 📊 Weekly averages and history
Review automatic weekly averages and browse your previous readings and notes.

### 🔒 Local storage
Your readings are stored on your device using IndexedDB. No account, cloud database, or automatic data uploads.

### 📂 Backup and transfer
Export all readings as a readable JSON file and import it on another device. Imports keep your existing readings, skip exact duplicates, and preserve dates, times, pulse, and notes.

### 📱 Installable and offline-ready
Use BP Tracker in your browser or add it to your home screen as a Progressive Web App (PWA). Open it online first so it can cache the app for offline use.

## 🛠 Installation

Use **[BP Tracker](https://adam-sync.github.io/blood-pressure-tracker/)** directly in your browser, or install it for quick access.

### iPhone

1. Open BP Tracker in Safari.
2. Tap the **Share** button.
3. Select **Add to Home Screen**.
4. Tap **Add**.

### Android

1. Open BP Tracker in Chrome.
2. Open the browser menu.
3. Select **Install app** or **Add to Home screen**.
4. Follow the installation instructions.

## 📓 Usage

1. Enter your blood pressure and pulse readings.
2. Set the date and time the reading was taken.
3. Add any notes you want to keep with the reading.
4. Save the reading and review your history and weekly averages.

## 📂 Transfer Between Devices

1. Open **Backup & transfer** below your recent readings.
2. Select **Export readings** and save the `.json` file.
3. Transfer that file to your other device using a method you trust.
4. Open BP Tracker on that device, select **Import readings**, and choose the file.
5. Confirm the import. The app reports how many readings were added or skipped.

Imports merge with existing readings; they never replace your database. Reimporting the same backup skips exact duplicates. Readings with different content are kept separately. This is manual transfer, not automatic sync; deleted readings can return if you import an older backup.

Only BP Tracker version 1 backup files are accepted (up to 10 MB / 50,000 readings). Invalid files are rejected before importing, and database write failures roll back the whole import. Backup files are plain text, not encrypted, and contain your readings and notes. Keep them private.

## 🧠 Philosophy

BP Tracker is built around privacy, simplicity, and ownership. A straightforward place to keep your readings without accounts or a cloud database.

Your data stays in the browser and on the device where you enter it. It does not automatically sync between devices. Keep backups of important readings: clearing browser storage may erase your history.

## 🧰 Built With

HTML · CSS · JavaScript · IndexedDB · Service Worker · PWA

## 🙌 Support Development

If BP Tracker helps you, consider supporting the project:

- ⭐ Star the repository if you find it useful.

<a href="https://buymeacoffee.com/adamsync" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me a Coffee" style="height: 60px; width: 217px;">
</a>

Your support helps improve the project and build more simple, privacy-focused tools.

## ✉️ Contact

[Contact ADaM](mailto:adam.16ma9@aleeas.com)

Made with ❤️ by [ADaM](https://github.com/ADaM-sync)

---

BP Tracker is a personal health journal, not a medical diagnostic tool.

