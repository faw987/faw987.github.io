"use strict";
// app2.ts
let SQL = null;
let db = null;
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
// CRUD actions
function getEditorValues() {
    const idStr = $("item-id").value.trim();
    const desc = $("item-description").value.trim();
    const costStr = $("item-cost").value.trim();
    const id = idStr ? Number(idStr) : null;
    const cost = costStr ? Number(costStr) : null;
    return {
        id: id !== null && !Number.isNaN(id) ? id : null,
        description: desc,
        cost: cost !== null && !Number.isNaN(cost) ? cost : null,
    };
}
function handleCreate() {
    try {
        const database = getDb();
        const { description, cost } = getEditorValues();
        if (!description) {
            alert("Description is required.");
            return;
        }
        // Allow cost to be null
        if (cost === null) {
            database.run("INSERT INTO item (description) VALUES (?);", [description]);
        }
        else {
            database.run("INSERT INTO item (description, cost) VALUES (?, ?);", [description, cost]);
        }
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
    var _a;
    try {
        const database = getDb();
        const { id } = getEditorValues();
        if (id === null) {
            alert("Provide an ID to retrieve.");
            return;
        }
        // exec() in sql.js does NOT take parameter arrays; build the SQL string directly
        const sql = `SELECT id, description, cost FROM item WHERE id = ${id};`;
        const results = database.exec(sql);
        if (results.length === 0 || results[0].values.length === 0) {
            setOutput("No record found.");
            log(`Retrieve: no record for id=${id}`);
            return;
        }
        const row = results[0].values[0];
        $("item-id").value = String(row[0]);
        $("item-description").value = (_a = row[1]) !== null && _a !== void 0 ? _a : "";
        $("item-cost").value = row[2] != null ? String(row[2]) : "";
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
        const { id, description, cost } = getEditorValues();
        if (id === null) {
            alert("Provide an ID to update.");
            return;
        }
        if (!description) {
            alert("Description is required.");
            return;
        }
        if (cost === null) {
            database.run("UPDATE item SET description = ?, cost = NULL WHERE id = ?;", [description, id]);
        }
        else {
            database.run("UPDATE item SET description = ?, cost = ? WHERE id = ?;", [description, cost, id]);
        }
        log(`Updated record id=${id}`);
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
        cost REAL
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
function handleExportCsv() {
    try {
        const database = getDb();
        const results = database.exec("SELECT id, description, cost FROM item ORDER BY id;");
        if (results.length === 0) {
            alert("No data to export (table empty or does not exist).");
            return;
        }
        const result = results[0];
        const lines = [];
        lines.push(result.columns.join(","));
        for (const row of result.values) {
            // Simple CSV (no embedded commas/quotes handling)
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
        log("Exported table 'item' to CSV.");
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
    const idxCost = header.indexOf("cost");
    const records = [];
    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",");
        const get = (idx) => idx >= 0 && idx < parts.length ? parts[idx] : "";
        const idStr = get(idxId);
        const desc = get(idxDescription);
        const costStr = get(idxCost);
        const id = idStr ? Number(idStr) : null;
        const cost = costStr ? Number(costStr) : null;
        records.push({
            id: id !== null && !Number.isNaN(id) ? id : null,
            description: desc,
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
                    if (!r.description && r.cost === null && r.id === null)
                        continue;
                    if (r.id !== null) {
                        if (r.cost === null) {
                            database.run("INSERT OR REPLACE INTO item (id, description, cost) VALUES (?, ?, NULL);", [r.id, r.description]);
                        }
                        else {
                            database.run("INSERT OR REPLACE INTO item (id, description, cost) VALUES (?, ?, ?);", [r.id, r.description, r.cost]);
                        }
                    }
                    else {
                        if (r.cost === null) {
                            database.run("INSERT INTO item (description, cost) VALUES (?, NULL);", [r.description]);
                        }
                        else {
                            database.run("INSERT INTO item (description, cost) VALUES (?, ?);", [r.description, r.cost]);
                        }
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
        setOutput("Error: " + message);
        log("Error starting CSV import: " + message);
    }
}
// Wire up all handlers once DOM is ready
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
    // DB / table / CSV
    $("btn-create-db").onclick = handleCreateDb;
    $("btn-create-table").onclick = handleCreateTable;
    $("btn-delete-table").onclick = handleDeleteTable;
    $("btn-delete-db").onclick = handleDeleteDb;
    $("btn-export-csv").onclick = handleExportCsv;
    $("btn-import-csv").onclick = handleImportCsv;
    log("UI initialized. You can now create the DB and table.");
});
