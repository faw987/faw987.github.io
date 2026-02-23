// main.ts
var DB_NAME = "itemdb";
var TABLE_NAME = "item";
function log(message) {
    var statusEl = document.getElementById("status");
    if (!statusEl)
        return;
    var timestamp = new Date().toLocaleTimeString();
    statusEl.textContent = "[" + timestamp + "] " + message + "\n" + statusEl.textContent;
}
/**
 * Ensure our database exists and is selected.
 * Uses AlaSQL's internal databases registry to avoid "already exists" errors.
 */
function ensureDatabaseSelected() {
    if (typeof window.alasql === "undefined") {
        log('ERROR: alasql is not defined. Make sure alasql.min.js loads before main.js.');
        throw new Error("alasql is not available");
    }
    var anyAla = alasql;
    var dbs = anyAla.databases || {};
    if (!dbs[DB_NAME]) {
        try {
            alasql("CREATE DATABASE " + DB_NAME);
            log('Created database "' + DB_NAME + '".');
        }
        catch (e) {
            log('Note: tried to create database "' +
                DB_NAME +
                '" but it may already exist. Continuing.');
        }
    }
    alasql("USE " + DB_NAME);
}
/**
 * Create or select the database (button handler).
 */
function handleCreateDb() {
    ensureDatabaseSelected();
    log('Database "' + DB_NAME + '" created/selected.');
}
/**
 * Create the "item" table.
 */
function handleCreateTable() {
    ensureDatabaseSelected();
    alasql("CREATE TABLE IF NOT EXISTS " +
        TABLE_NAME +
        " (" +
        "id INT PRIMARY KEY," +
        "description STRING," +
        "cost FLOAT" +
        ")");
    log('Table "' + TABLE_NAME + '" created (if it did not exist).');
}
/**
 * Drop the "item" table.
 */
function handleDropTable() {
    ensureDatabaseSelected();
    alasql("DROP TABLE IF EXISTS " + TABLE_NAME);
    log('Table "' + TABLE_NAME + '" dropped (if it existed).');
}
/**
 * Drop the entire database.
 */
function handleDropDb() {
    var anyAla = alasql;
    var dbs = anyAla.databases || {};
    if (!dbs[DB_NAME]) {
        // Create then drop, to keep behavior predictable.
        alasql("CREATE DATABASE " + DB_NAME);
    }
    alasql("DROP DATABASE IF EXISTS " + DB_NAME);
    log('Database "' + DB_NAME + '" dropped (if it existed).');
}
/**
 * Simple CSV escaping: wrap the value in double quotes
 * and escape internal double quotes.
 */
function escapeCsvValue(value) {
    var escaped = value.replace(/"/g, '""');
    return '"' + escaped + '"';
}
/**
 * Export the "item" table to CSV and trigger a download.
 * If the table has no rows, you still get a header-only CSV.
 */
function handleExportCsv() {
    ensureDatabaseSelected();
    // Make sure table exists; if it doesn't, just log and create empty CSV.
    try {
        alasql("SELECT TOP 1 * FROM " + TABLE_NAME);
    }
    catch (err) {
        log('Table "' + TABLE_NAME + '" does not exist. Creating it empty for export.');
        handleCreateTable();
    }
    var rows = alasql("SELECT * FROM " + TABLE_NAME);
    var header = "id,description,cost";
    var dataLines = rows.map(function (row) {
        var anyRow = row;
        var idPart = String(anyRow.id != null ? anyRow.id : "");
        var descPart = escapeCsvValue(String(anyRow.description != null ? anyRow.description : ""));
        var costPart = String(anyRow.cost != null ? anyRow.cost : "");
        return idPart + "," + descPart + "," + costPart;
    });
    var csv = [header].concat(dataLines).join("\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = TABLE_NAME + ".csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    log("Exported " + rows.length + ' row(s) from "' + TABLE_NAME + '" to CSV.');
}
/**
 * Very simple CSV line parser:
 * - splits on commas
 * - trims whitespace
 * - strips surrounding double quotes if present
 * This is NOT a full CSV implementation, but fine for basic cases.
 */
function parseCsvLine(line) {
    var rawParts = line.split(",");
    return rawParts.map(function (part) {
        var trimmed = part.replace(/^\s+|\s+$/g, "");
        if (trimmed.length >= 2 &&
            trimmed.charAt(0) === '"' &&
            trimmed.charAt(trimmed.length - 1) === '"') {
            trimmed = trimmed.slice(1, trimmed.length - 1).replace(/""/g, '"');
        }
        return trimmed;
    });
}
/**
 * Import rows from CSV into the "item" table.
 * Expected columns: id, description, cost
 */
function importCsvText(csvText) {
    var lines = csvText
        .split(/\r?\n/)
        .map(function (l) {
            return l.replace(/^\s+|\s+$/g, "");
        })
        .filter(function (l) {
            return l.length > 0;
        });
    if (lines.length === 0) {
        log("Import failed: CSV file is empty.");
        return;
    }
    var header = lines[0].toLowerCase();
    var expectedHeader = "id,description,cost";
    var hasIdAtStart = header.indexOf("id") === 0;
    var hasDescription = header.indexOf("description") !== -1;
    var hasCost = header.indexOf("cost") !== -1;
    if (!hasIdAtStart || !hasDescription || !hasCost) {
        log('Warning: CSV header looks unusual. Expected something like "' +
            expectedHeader +
            '", but got "' +
            lines[0] +
            '".');
    }
    var dataLines = lines.slice(1);
    if (dataLines.length === 0) {
        log("CSV has a header but no data rows.");
        return;
    }
    ensureDatabaseSelected();
    // Make sure table exists
    handleCreateTable();
    var insertedCount = 0;
    var skippedCount = 0;
    for (var i = 0; i < dataLines.length; i++) {
        var line = dataLines[i];
        var parts = parseCsvLine(line);
        if (parts.length < 3) {
            skippedCount++;
            continue;
        }
        var idStr = parts[0];
        var description = parts[1];
        var costStr = parts[2];
        var id = Number(idStr);
        var cost = Number(costStr);
        if (isNaN(id) || isNaN(cost)) {
            skippedCount++;
            continue;
        }
        try {
            alasql("INSERT INTO " + TABLE_NAME + " VALUES (?, ?, ?)", [id, description, cost]);
            insertedCount++;
        }
        catch (err) {
            // Could be duplicate primary key, etc.
            skippedCount++;
        }
    }
    log("Import complete: inserted " +
        insertedCount +
        ' row(s), skipped ' +
        skippedCount +
        ' row(s) into "' +
        TABLE_NAME +
        '".');
}
/**
 * Handle file input change event -> read file -> import CSV.
 */
function handleImportCsvFromFileInput(inputEl) {
    var fileList = inputEl.files;
    if (!fileList || fileList.length === 0) {
        log("No file selected for import.");
        return;
    }
    var file = fileList[0];
    var reader = new FileReader();
    reader.onload = function () {
        var text = String(reader.result != null ? reader.result : "");
        importCsvText(text);
    };
    reader.onerror = function () {
        log("Error reading CSV file.");
    };
    reader.readAsText(file);
}
/* ------------------------------------------------------------------
 * CRUD UI helpers
 * ------------------------------------------------------------------ */
function getIdFromInput() {
    var idInput = document.getElementById("input-id");
    if (!idInput) {
        log("ERROR: ID input field not found.");
        return null;
    }
    var value = idInput.value.replace(/^\s+|\s+$/g, "");
    if (!value) {
        log("Please enter an ID.");
        return null;
    }
    var id = Number(value);
    if (isNaN(id)) {
        log('Invalid ID "' + value + '". Please enter a number.');
        return null;
    }
    return id;
}
function getDescriptionFromInput() {
    var descInput = document.getElementById("input-description");
    if (!descInput) {
        log("ERROR: Description input not found.");
        return "";
    }
    return descInput.value;
}
function getCostFromInput() {
    var costInput = document.getElementById("input-cost");
    if (!costInput) {
        log("ERROR: Cost input not found.");
        return null;
    }
    var value = costInput.value.replace(/^\s+|\s+$/g, "");
    if (!value) {
        log("Please enter a cost.");
        return null;
    }
    var cost = Number(value);
    if (isNaN(cost)) {
        log('Invalid cost "' + value + '". Please enter a number.');
        return null;
    }
    return cost;
}
function setFormFromRow(row) {
    var idInput = document.getElementById("input-id");
    var descInput = document.getElementById("input-description");
    var costInput = document.getElementById("input-cost");
    if (idInput)
        idInput.value = String(row.id != null ? row.id : "");
    if (descInput)
        descInput.value = String(row.description != null ? row.description : "");
    if (costInput)
        costInput.value = String(row.cost != null ? row.cost : "");
}
/**
 * CRUD: Retrieve
 */
function handleCrudRetrieve() {
    var id = getIdFromInput();
    if (id === null)
        return;
    ensureDatabaseSelected();
    handleCreateTable(); // ensure table
    var rows = alasql("SELECT * FROM " + TABLE_NAME + " WHERE id = ?", [id]);
    if (!rows || rows.length === 0) {
        log('Retrieve: no record found for ID ' + id + ".");
        return;
    }
    var row = rows[0];
    setFormFromRow(row);
    log('Retrieve: loaded record with ID ' + id + ".");
}
/**
 * CRUD: Create
 */
function handleCrudCreate() {
    var id = getIdFromInput();
    if (id === null)
        return;
    var description = getDescriptionFromInput();
    var cost = getCostFromInput();
    if (cost === null)
        return;
    ensureDatabaseSelected();
    handleCreateTable();
    var existing = alasql("SELECT * FROM " + TABLE_NAME + " WHERE id = ?", [id]);
    if (existing && existing.length > 0) {
        log("Create: record with ID " +
            id +
            " already exists. Use Update instead if you want to modify it.");
        return;
    }
    try {
        alasql("INSERT INTO " + TABLE_NAME + " VALUES (?, ?, ?)", [id, description, cost]);
        log("Create: inserted record with ID " + id + ".");
    }
    catch (e) {
        log("Create: error inserting record with ID " + id + ".");
    }
}
/**
 * CRUD: Update
 */
function handleCrudUpdate() {
    var id = getIdFromInput();
    if (id === null)
        return;
    var description = getDescriptionFromInput();
    var cost = getCostFromInput();
    if (cost === null)
        return;
    ensureDatabaseSelected();
    handleCreateTable();
    var existing = alasql("SELECT * FROM " + TABLE_NAME + " WHERE id = ?", [id]);
    if (!existing || existing.length === 0) {
        log("Update: no existing record with ID " + id + " to update.");
        return;
    }
    var count = alasql("UPDATE " + TABLE_NAME + " SET description = ?, cost = ? WHERE id = ?", [description, cost, id]);
    log("Update: updated " + count + " record(s) with ID " + id + ".");
}
/**
 * CRUD: Delete
 */
function handleCrudDelete() {
    var id = getIdFromInput();
    if (id === null)
        return;
    ensureDatabaseSelected();
    handleCreateTable();
    var count = alasql("DELETE FROM " + TABLE_NAME + " WHERE id = ?", [id]);
    if (count === 0) {
        log("Delete: no record with ID " + id + " to delete.");
    }
    else {
        log("Delete: removed " + count + " record(s) with ID " + id + ".");
    }
}
/* ------------------------------------------------------------------
 * Admin SQL console
 * ------------------------------------------------------------------ */
function handleSqlExecute() {
    var inputEl = document.getElementById("sql-input");
    var outputEl = document.getElementById("sql-output");
    if (!inputEl || !outputEl) {
        log("ERROR: SQL console elements not found.");
        return;
    }
    var sql = inputEl.value.replace(/^\s+|\s+$/g, "");
    if (!sql) {
        log("SQL console: no command to execute.");
        return;
    }
    try {
        ensureDatabaseSelected();
        var result = alasql(sql);
        var text = void 0;
        if (typeof result === "undefined") {
            text = "[no result]";
        }
        else if (Array.isArray(result)) {
            text = JSON.stringify(result, null, 2);
        }
        else {
            text = String(result);
        }
        outputEl.value = text;
        log("SQL console: executed command.");
    }
    catch (e) {
        var msg = (e && e.message) ? e.message : String(e);
        outputEl.value = "ERROR: " + msg;
        log("SQL console error: " + msg);
    }
}
function handleSqlClear() {
    var inputEl = document.getElementById("sql-input");
    var outputEl = document.getElementById("sql-output");
    if (inputEl)
        inputEl.value = "";
    if (outputEl)
        outputEl.value = "";
    log("SQL console: cleared input and output.");
}
/* ------------------------------------------------------------------
 * Tabs UI
 * ------------------------------------------------------------------ */
function setActiveTab(tabName) {
    var tabButtons = document.querySelectorAll(".tab-button");
    for (var i = 0; i < tabButtons.length; i++) {
        var btn = tabButtons[i];
        var dataTab = btn.getAttribute("data-tab");
        if (dataTab === tabName) {
            btn.classList.add("active");
        }
        else {
            btn.classList.remove("active");
        }
    }
    var tabPanels = document.querySelectorAll(".tab-panel");
    for (var j = 0; j < tabPanels.length; j++) {
        var panel = tabPanels[j];
        var dataPanel = panel.getAttribute("data-tab-panel");
        if (dataPanel === tabName) {
            panel.classList.add("active");
        }
        else {
            panel.classList.remove("active");
        }
    }
}
/**
 * Wire up DOM events once the document is ready.
 */
function setupEventHandlers() {
    // DB / table / CSV buttons
    var btnCreateDb = document.getElementById("btn-create-db");
    var btnCreateTable = document.getElementById("btn-create-table");
    var btnDropTable = document.getElementById("btn-drop-table");
    var btnDropDb = document.getElementById("btn-drop-db");
    var btnExport = document.getElementById("btn-export");
    var btnImport = document.getElementById("btn-import");
    var fileInput = document.getElementById("file-input");
    if (btnCreateDb)
        btnCreateDb.addEventListener("click", handleCreateDb);
    if (btnCreateTable)
        btnCreateTable.addEventListener("click", handleCreateTable);
    if (btnDropTable)
        btnDropTable.addEventListener("click", handleDropTable);
    if (btnDropDb)
        btnDropDb.addEventListener("click", handleDropDb);
    if (btnExport)
        btnExport.addEventListener("click", handleExportCsv);
    if (btnImport && fileInput) {
        btnImport.addEventListener("click", function () {
            handleImportCsvFromFileInput(fileInput);
        });
    }
    // CRUD buttons
    var btnCrudRetrieve = document.getElementById("btn-crud-retrieve");
    var btnCrudCreate = document.getElementById("btn-crud-create");
    var btnCrudUpdate = document.getElementById("btn-crud-update");
    var btnCrudDelete = document.getElementById("btn-crud-delete");
    if (btnCrudRetrieve)
        btnCrudRetrieve.addEventListener("click", handleCrudRetrieve);
    if (btnCrudCreate)
        btnCrudCreate.addEventListener("click", handleCrudCreate);
    if (btnCrudUpdate)
        btnCrudUpdate.addEventListener("click", handleCrudUpdate);
    if (btnCrudDelete)
        btnCrudDelete.addEventListener("click", handleCrudDelete);
    // Tab buttons
    var tabButtons = document.querySelectorAll(".tab-button");
    var _loop_1 = function (i) {
        var btn = tabButtons[i];
        btn.addEventListener("click", function () {
            var tabName = btn.getAttribute("data-tab");
            if (tabName) {
                setActiveTab(tabName);
            }
        });
    };
    for (var i = 0; i < tabButtons.length; i++) {
        _loop_1(i);
    }
    // SQL console buttons
    var btnSqlExec = document.getElementById("btn-sql-exec");
    var btnSqlClear = document.getElementById("btn-sql-clear");
    if (btnSqlExec)
        btnSqlExec.addEventListener("click", handleSqlExecute);
    if (btnSqlClear)
        btnSqlClear.addEventListener("click", handleSqlClear);
    log("UI initialized. You can now create the DB and table.");
}
window.addEventListener("DOMContentLoaded", setupEventHandlers);
