"use strict";
// app2.ts
let SQL = null;
let db = null;
// We'll keep the current picture as a data URL in memory
let currentPictureDataUrl = null;
function getDb() {
    if (!db) {
        throw new Error("Database has not been created yet. Click 'Create / Select DB' first.");
    }
    return db;
}
// DOM helpers
function $(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`Element with id '${id}' not found`);
    return el;
}
function log(message) {
    const logEl = $("status-log");
    const time = new Date().toLocaleTimeString();
    logEl.textContent += `\n[${time}] ${message}`;
}
function setOutput(text) {
    $("output").textContent = text;
}
// Format sql.js results into text
function formatResults(results) {
    if (results.length === 0) {
        return "Done.";
    }
    const lines = [];
    for (const result of results) {
        const { columns, values } = result;
        const header = columns.join(" | ");
        lines.push(header);
        lines.push("-".repeat(header.length));
        for (const row of values) {
            lines.push(row.map(String).join(" | "));
        }
        lines.push(""); // blank line between result sets
    }
    return lines.join("\n");
}
// Initialize SQL.js and basic DB
async function init() {
    log("Loading SQLite (sql.js)...");
    SQL = await initSqlJs({
        locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${file}`,
    });
    log("SQLite engine loaded. Click 'Create / Select DB' to start.");
}
// Gather values from UI
function getEditorValues() {
    const idStr = $("item-id").value.trim();
    const idNum = idStr ? Number(idStr) : null;
    const description = $("item-description").value.trim();
    const shortDescription = $("item-short-description").value.trim();
    const dateInput = $("item-date-input").value || "";
    const purchasedFrom = $("item-purchased-from").value.trim();
    const datePurchased = $("item-date-purchased").value || "";
    const costStr = $("item-cost").value.trim();
    const costNum = costStr ? Number(costStr) : null;
    const notesHtml = $("item-notes").innerHTML;
    return {
        id: idNum !== null && !Number.isNaN(idNum) ? idNum : null,
        description,
        shortDescription,
        dateInput,
        purchasedFrom,
        datePurchased,
        cost: costNum !== null && !Number.isNaN(costNum) ? costNum : null,
        notesHtml,
        pictureDataUrl: currentPictureDataUrl,
    };
}
// CRUD actions
function handleCreate() {
    try {
        const database = getDb();
        const v = getEditorValues();
        if (!v.description) {
            alert("Description is required.");
            return;
        }
        database.run(`INSERT INTO item
        (description, short_description, date_input,
         purchased_from, date_purchased, cost, notes, picture)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`, [
            v.description || null,
            v.shortDescription || null,
            v.dateInput || null,
            v.purchasedFrom || null,
            v.datePurchased || null,
            v.cost !== null ? v.cost : null,
            v.notesHtml || null,
            v.pictureDataUrl || null,
        ]);
        log("Inserted new item.");
        setOutput("Insert successful.");
    }
    catch (err) {
        const message = err.message;
        setOutput("Error: " + message);
        log("Error on create: " + message);
    }
}
function handleRetrieve() {
    try {
        const database = getDb();
        const { id } = getEditorValues();
        if (id === null) {
            alert("Provide an ID to retrieve.");
            return;
        }
        const sql = `
      SELECT id, description, short_description, date_input,
             purchased_from, date_purchased, cost, notes, picture
      FROM item
      WHERE id = ${id};
    `;
        const results = database.exec(sql);
        if (results.length === 0 || results[0].values.length === 0) {
            setOutput("No record found.");
            log(`Retrieve: no record for id=${id}`);
            return;
        }
        const row = results[0].values[0];
        const [idVal, description, shortDescription, dateInput, purchasedFrom, datePurchased, cost, notes, picture,] = row;
        $("item-id").value = String(idVal !== null && idVal !== void 0 ? idVal : "");
        $("item-description").value = (description !== null && description !== void 0 ? description : "");
        $("item-short-description").value = (shortDescription !== null && shortDescription !== void 0 ? shortDescription : "");
        $("item-date-input").value = (dateInput !== null && dateInput !== void 0 ? dateInput : "");
        $("item-purchased-from").value = (purchasedFrom !== null && purchasedFrom !== void 0 ? purchasedFrom : "");
        $("item-date-purchased").value = (datePurchased !== null && datePurchased !== void 0 ? datePurchased : "");
        $("item-cost").value =
            cost !== null && cost !== undefined ? String(cost) : "";
        const notesDiv = $("item-notes");
        notesDiv.innerHTML = (notes !== null && notes !== void 0 ? notes : "");
        const preview = $("picture-preview");
        if (picture) {
            const picStr = picture;
            preview.src = picStr;
            currentPictureDataUrl = picStr;
        }
        else {
            preview.src = "";
            currentPictureDataUrl = null;
        }
        setOutput(formatResults(results));
        log(`Retrieved record id=${id}`);
    }
    catch (err) {
        const message = err.message;
        setOutput("Error: " + message);
        log("Error on retrieve: " + message);
    }
}
function handleUpdate() {
    try {
        const database = getDb();
        const v = getEditorValues();
        if (v.id === null) {
            alert("Provide an ID to update.");
            return;
        }
        if (!v.description) {
            alert("Description is required.");
            return;
        }
        database.run(`UPDATE item
       SET description = ?,
           short_description = ?,
           date_input = ?,
           purchased_from = ?,
           date_purchased = ?,
           cost = ?,
           notes = ?,
           picture = ?
       WHERE id = ?;`, [
            v.description || null,
            v.shortDescription || null,
            v.dateInput || null,
            v.purchasedFrom || null,
            v.datePurchased || null,
            v.cost !== null ? v.cost : null,
            v.notesHtml || null,
            v.pictureDataUrl || null,
            v.id,
        ]);
        log(`Updated record id=${v.id}`);
        setOutput("Update successful.");
    }
    catch (err) {
        const message = err.message;
        setOutput("Error: " + message);
        log("Error on update: " + message);
    }
}
function handleDelete() {
    try {
        const database = getDb();
        const { id } = getEditorValues();
        if (id === null) {
            alert("Provide an ID to delete.");
            return;
        }
        database.run("DELETE FROM item WHERE id = ?;", [id]);
        log(`Deleted record id=${id}`);
        setOutput("Delete successful.");
    }
    catch (err) {
        const message = err.message;
        setOutput("Error: " + message);
        log("Error on delete: " + message);
    }
}
// Admin SQL
function handleSqlDo() {
    try {
        const database = getDb();
        const sql = $("sql-command").value;
        const results = database.exec(sql);
        setOutput(formatResults(results));
        log("Executed SQL from console.");
    }
    catch (err) {
        const message = err.message;
        setOutput("Error: " + message);
        log("Error executing SQL: " + message);
    }
}
// DB / table / CSV
function handleCreateDb() {
    if (!SQL) {
        alert("SQLite engine not loaded yet.");
        return;
    }
    if (db) {
        db.close();
    }
    db = new SQL.Database();
    log("Created/select in-memory DB 'itemdb'.");
    setOutput("Database created. You may now 'Create table'.");
}
function handleCreateTable() {
    try {
        const database = getDb();
        database.run(`
      CREATE TABLE IF NOT EXISTS item (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT,
        short_description TEXT,
        date_input TEXT,
        purchased_from TEXT,
        date_purchased TEXT,
        cost REAL,
        notes TEXT,
        picture TEXT
      );
    `);
        log("Table 'item' created (if it did not already exist).");
        setOutput("Table created.");
    }
    catch (err) {
        const message = err.message;
        setOutput("Error: " + message);
        log("Error creating table: " + message);
    }
}
function handleDeleteTable() {
    try {
        const database = getDb();
        database.run("DROP TABLE IF EXISTS item;");
        log("Table 'item' dropped.");
        setOutput("Table deleted.");
    }
    catch (err) {
        const message = err.message;
        setOutput("Error: " + message);
        log("Error deleting table: " + message);
    }
}
function handleDeleteDb() {
    if (db) {
        db.close();
        db = null;
        log("Database 'itemdb' deleted (in-memory instance closed).");
        setOutput("Database deleted.");
    }
    else {
        log("Delete DB pressed, but DB was not created.");
    }
}
// CSV export/import: we export a text-only view (no notes/picture)
function handleExportCsv() {
    try {
        const database = getDb();
        const results = database.exec(`
      SELECT id, description, short_description, date_input,
             purchased_from, date_purchased, cost
      FROM item
      ORDER BY id;
    `);
        if (results.length === 0) {
            alert("No data to export (table empty or does not exist).");
            return;
        }
        const result = results[0];
        const lines = [];
        lines.push(result.columns.join(","));
        for (const row of result.values) {
            const escaped = row.map((v) => (v == null ? "" : String(v)));
            lines.push(escaped.join(","));
        }
        const csv = lines.join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "item.csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        log("Exported table 'item' to CSV (without notes/picture).");
        setOutput("Exported to CSV (downloaded as item.csv).");
    }
    catch (err) {
        const message = err.message;
        setOutput("Error: " + message);
        log("Error exporting CSV: " + message);
    }
}
function parseSimpleCsv(text) {
    const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
    if (lines.length === 0)
        return [];
    const header = lines[0].split(",");
    const idxId = header.indexOf("id");
    const idxDescription = header.indexOf("description");
    const idxShort = header.indexOf("short_description");
    const idxDateInput = header.indexOf("date_input");
    const idxPurchasedFrom = header.indexOf("purchased_from");
    const idxDatePurchased = header.indexOf("date_purchased");
    const idxCost = header.indexOf("cost");
    const records = [];
    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",");
        const get = (idx) => idx >= 0 && idx < parts.length ? parts[idx] : "";
        const idStr = get(idxId);
        const desc = get(idxDescription);
        const shortDesc = get(idxShort);
        const dateIn = get(idxDateInput);
        const from = get(idxPurchasedFrom);
        const datePur = get(idxDatePurchased);
        const costStr = get(idxCost);
        const id = idStr ? Number(idStr) : null;
        const cost = costStr ? Number(costStr) : null;
        records.push({
            id: id !== null && !Number.isNaN(id) ? id : null,
            description: desc,
            shortDescription: shortDesc,
            dateInput: dateIn,
            purchasedFrom: from,
            datePurchased: datePur,
            cost: cost !== null && !Number.isNaN(cost) ? cost : null,
        });
    }
    return records;
}
function handleImportCsv() {
    try {
        const database = getDb();
        const fileInput = $("file-import");
        const file = fileInput.files && fileInput.files[0];
        if (!file) {
            alert("Choose a CSV file first.");
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const text = String(reader.result || "");
                const records = parseSimpleCsv(text);
                if (records.length === 0) {
                    alert("No records found in CSV.");
                    return;
                }
                database.run("BEGIN TRANSACTION;");
                for (const r of records) {
                    if (!r.description &&
                        !r.shortDescription &&
                        !r.dateInput &&
                        !r.purchasedFrom &&
                        !r.datePurchased &&
                        r.cost === null &&
                        r.id === null) {
                        continue;
                    }
                    if (r.id !== null) {
                        database.run(`INSERT OR REPLACE INTO item
                 (id, description, short_description, date_input,
                  purchased_from, date_purchased, cost)
               VALUES (?, ?, ?, ?, ?, ?, ?);`, [
                            r.id,
                            r.description || null,
                            r.shortDescription || null,
                            r.dateInput || null,
                            r.purchasedFrom || null,
                            r.datePurchased || null,
                            r.cost !== null ? r.cost : null,
                        ]);
                    }
                    else {
                        database.run(`INSERT INTO item
                 (description, short_description, date_input,
                  purchased_from, date_purchased, cost)
               VALUES (?, ?, ?, ?, ?, ?);`, [
                            r.description || null,
                            r.shortDescription || null,
                            r.dateInput || null,
                            r.purchasedFrom || null,
                            r.datePurchased || null,
                            r.cost !== null ? r.cost : null,
                        ]);
                    }
                }
                database.run("COMMIT;");
                log(`Imported ${records.length} records from CSV into table 'item'.`);
                setOutput(`Imported ${records.length} records from CSV.`);
            }
            catch (err) {
                database.run("ROLLBACK;");
                const message = err.message;
                setOutput("Error during import: " + message);
                log("Error importing CSV: " + message);
            }
        };
        reader.onerror = () => {
            setOutput("Error reading CSV file.");
            log("FileReader error when importing CSV.");
        };
        reader.readAsText(file);
    }
    catch (err) {
        const message = err.message;
        setOutput("Error starting CSV import: " + message);
        log("Error starting CSV import: " + message);
    }
}
// Export the entire SQLite database as a .sqlite file
function handleExportDb() {
    try {
        const database = getDb();
        // sql.js: export() returns a Uint8Array with the SQLite file
        // TypeScript doesn't know about it, so we go through any.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const binary = database.export();
        const blob = new Blob([binary], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "itemdb.sqlite";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        log("Exported full database to itemdb.sqlite.");
        setOutput("Database exported as itemdb.sqlite.");
    }
    catch (err) {
        const message = err.message;
        setOutput("Error exporting DB: " + message);
        log("Error exporting DB: " + message);
    }
}
// Import an entire SQLite database file and replace the current in-memory DB
function handleImportDb() {
    try {
        if (!SQL) {
            alert("SQLite engine not loaded yet.");
            return;
        }
        const fileInput = $("file-import-db");
        const file = fileInput.files && fileInput.files[0];
        if (!file) {
            alert("Choose a SQLite DB file first.");
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const arrayBuffer = reader.result;
                const u8 = new Uint8Array(arrayBuffer);
                if (db) {
                    db.close();
                }
                db = new SQL.Database(u8);
                log("Imported full database from file.");
                setOutput("Database imported from file. You can now use CRUD / SQL console.");
            }
            catch (err) {
                const message = err.message;
                setOutput("Error importing DB: " + message);
                log("Error importing DB: " + message);
            }
        };
        reader.onerror = () => {
            setOutput("Error reading DB file.");
            log("FileReader error when importing DB.");
        };
        reader.readAsArrayBuffer(file);
    }
    catch (err) {
        const message = err.message;
        setOutput("Error starting DB import: " + message);
        log("Error starting DB import: " + message);
    }
}
/* ----------- UI helpers: tabs, dates, notes, picture ---------- */
function activateTab(tabName) {
    const buttons = document.querySelectorAll(".tab-button");
    const panels = document.querySelectorAll(".tab-panel");
    buttons.forEach((btn) => {
        const t = btn.getAttribute("data-tab");
        btn.classList.toggle("active", t === tabName);
    });
    panels.forEach((panel) => {
        panel.classList.toggle("active", panel.id === `tab-${tabName}`);
    });
}
function hookTabButtons() {
    $("tab-btn-basics").onclick = () => activateTab("basics");
    $("tab-btn-acquire").onclick = () => activateTab("acquire");
    $("tab-btn-misc").onclick = () => activateTab("misc");
}
function focusDateInput(inputId) {
    const input = $(inputId);
    const anyInput = input;
    if (typeof anyInput.showPicker === "function") {
        anyInput.showPicker();
    }
    else {
        input.focus();
        input.click();
    }
}
function hookDateButtons() {
    $("btn-date-input-picker").onclick = () => focusDateInput("item-date-input");
    $("btn-date-purchased-picker").onclick = () => focusDateInput("item-date-purchased");
}
function hookNotesToolbar() {
    const toolbar = document.querySelector(".notes-toolbar");
    if (!toolbar)
        return;
    toolbar.addEventListener("click", (ev) => {
        const target = ev.target;
        const button = target.closest("button");
        if (!button)
            return;
        const format = button.getAttribute("data-format");
        if (!format)
            return;
        document.execCommand(format, false);
    });
}
function hookPictureControls() {
    const fileInput = $("item-picture-input");
    const captureBtn = $("btn-capture-picture");
    const clearBtn = $("btn-clear-picture");
    const preview = $("picture-preview");
    captureBtn.onclick = () => fileInput.click();
    clearBtn.onclick = () => {
        fileInput.value = "";
        preview.src = "";
        currentPictureDataUrl = null;
    };
    fileInput.addEventListener("change", () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = String(reader.result || "");
            preview.src = dataUrl;
            currentPictureDataUrl = dataUrl;
        };
        reader.readAsDataURL(file);
    });
}
/* ------------------- Wire everything up ----------------------- */
document.addEventListener("DOMContentLoaded", () => {
    // Kick off SQLite loading
    init().catch((err) => {
        log("Failed to load SQLite: " + err.message);
    });
    // CRUD buttons
    $("btn-create").onclick = handleCreate;
    $("btn-retrieve").onclick = handleRetrieve;
    $("btn-update").onclick = handleUpdate;
    $("btn-delete").onclick = handleDelete;
    // SQL console
    $("btn-sql-do").onclick = handleSqlDo;
    $("btn-sql-clear").onclick = () => {
        $("sql-command").value = "";
        setOutput("");
    };
    // DB / table / CSV / DB file
    $("btn-create-db").onclick = handleCreateDb;
    $("btn-create-table").onclick = handleCreateTable;
    $("btn-delete-table").onclick = handleDeleteTable;
    $("btn-delete-db").onclick = handleDeleteDb;
    $("btn-export-csv").onclick = handleExportCsv;
    $("btn-import-csv").onclick = handleImportCsv;
    $("btn-export-db").onclick = handleExportDb;
    $("btn-import-db").onclick = handleImportDb;
    // Tabs, date pickers, notes, pictures
    hookTabButtons();
    hookDateButtons();
    hookNotesToolbar();
    hookPictureControls();
    log("UI initialized. You can now create the DB and table.");
});
