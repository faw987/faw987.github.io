# Forensic Workbench Dashboard (FWB) — User Guide

FWB is a single-page browser app for forensic review of PDF documents. PDFs are processed locally in your browser; only the page image you choose to examine — together with the prompt you supply — is sent through the configured LLM gateway.

## Quick start

The fastest path is the green **Load Demo Data** button at the top of the hamburger menu (☰, top-right). It fetches a sample prompt library and a test PDF from GitHub so you can try the full workflow without supplying anything.

## Concepts

FWB shows three related tables, all driven from the PDFs you load:

- **Page Summary** — one row per page across every loaded PDF. This is the primary review surface.
- **Aggregations** — named groups of pages you pick from the page summary. One row per aggregation.
- **Aggregation Detail** — the pages that make up the currently selected aggregation, with the live data from their page-summary rows.

## Workflow

1. **Drop in PDFs.** Drag one or more PDF files onto the drop zone, or click it to pick files. Multiple PDFs are supported.
2. **Create the Page Summary Table.** Click **Create Summary Table**. FWB renders a thumbnail for every page across every loaded PDF and lays them out in a table. The base columns are *Select, File, Page, Thumbnail, Notes, LLM Response*. If you've marked any prompts as *Summary table heading* in the library editor (see below), each one adds its own column to the right.
3. **Open a page.** Click any thumbnail to open that page in a separate viewer window. The same window is reused for subsequent clicks.
4. **Examine the page.** In the viewer:
   - Type a prompt in the textarea, or
   - **Single-click** a library prompt to copy it into the textarea, or
   - **Double-click** a library prompt to copy it and run it immediately.
   - Click **Examine page using LLM** to send the rendered page plus the prompt to your configured gateway.
   Only prompts marked *Manual* in the library editor appear in the viewer's pill list.
5. **Read the result.** The response appears in the *LLM Response* column of the row whose thumbnail you opened. The viewer also shows it inline.

The *Notes* column is plain editable text — type anything you want to remember about a page.

## Apply: run prompts across many rows

Once the page summary table is built, you can fill the per-prompt columns in bulk:

1. In the library editor, mark one or more prompts with the **Summary table heading** checkbox. Those prompts become columns in the page summary table the next time you click *Create Summary Table*.
2. In the table, check the boxes in the leftmost *Select* column for each row you want to process. The header checkbox toggles all rows.
3. In the table header, check the box next to each prompt column you want to run.
4. Click the green **Apply** button. FWB re-renders each selected page at high resolution and runs each selected prompt against it, filling the matching cell. Cells show *Querying LLM…* while a call is in flight; the final response replaces it. Errors are written in red.

Apply is disabled until at least one row and at least one prompt column are selected.

## Aggregations: grouping pages

Aggregations let you collect pages that belong together — e.g. all pages of a single exhibit — into a named group.

1. In the page summary table, check the rows you want to group.
2. Click **Create / Add Aggregation**. A dialog opens showing the selected page count.
3. Either:
   - Type a name in **New aggregation** and click *Save*, or
   - Pick an existing aggregation from the list to add the selected pages to it.

The **Aggregations** table appears below the page summary table with one row per aggregation. Columns mirror the page summary table: *Name, Pages, Thumbnail* (the first page), *Notes, LLM Response*, and any prompt columns you've defined, plus a delete (**✕**) icon. Aggregation-level *Notes* are independent of the per-page notes.

Click an aggregation's **Name** to open the **Aggregation Detail** table — one row per page in the aggregation, pulling live data from the page summary. Each detail row has a **✕** to remove that page from the aggregation. Removing pages does not affect the underlying page summary row.

Clicking the **✕** in the Aggregations table deletes the whole aggregation (with a confirmation prompt). The pages themselves are unaffected.

## Hamburger menu (☰)

### Load Demo Data
Pulls a sample prompt library (`fwb-prompt-library.json`) and a test PDF (`forensic_test_00.pdf`) from GitHub and loads them into the dashboard. Useful for first-time use or for sharing a working demo.

### AI Gateway Settings
- **Gateway Endpoint** — full URL of an `ai_proxy` `/chat` endpoint. The default points at a hosted Cloud Run instance. Override it if you run the gateway locally (typically `http://localhost:8080/chat`).
- The gateway holds provider keys; the browser never sees them.
- If you save the field empty, FWB falls back to the default endpoint.

### Prompt Library
A library is a list of named prompts you can apply to any page or run across the table via Apply.

- **Edit** — opens the library editor in a separate window. Add prompts (name + text), reorder them with the ↑/↓ buttons, edit the selected prompt, or delete entries. Each prompt has two checkboxes:
  - **Manual** — the prompt appears in the viewer's pill list when you open a detail page.
  - **Summary table heading** — the prompt becomes a column in the page summary table, eligible for Apply.
  A small **M** or **T** badge next to each list entry shows which flags are set.
  Changes sync live to the main window and to any open viewer.
- **Export** — saves the current library as `fwb-prompt-library.json`, including the per-prompt flags.
- **Import** — loads a JSON file. Either an array of `{ name, text, manual, summaryColumn }` objects, or `{ "prompts": [ ... ] }`. Files exported before V0.3 default to `manual: true, summaryColumn: false` on import.

### User Guide
Opens this document.

## What is and isn't persisted

For now, the gateway endpoint, the prompt library, your notes, the page summary table, and any aggregations are kept **in memory for the session**. Use **Export** to save your library; **Import** to restore it. The PDFs you've loaded and any LLM responses you've generated do not persist either — closing or reloading the page clears them.

Persistence is on the roadmap; this iteration deliberately keeps state explicit.

## Tips

- The viewer caches each PDF after the first thumbnail click, so subsequent clicks on the same file are fast.
- Hover a library pill in the viewer to see the full prompt text in a tooltip.
- Hover a column header in the page summary table to see the full prompt text for that column.
- High-resolution pages can produce sizable base64 images — if a request fails with a payload error, try a less detailed prompt or a smaller PDF.
- Aggregations survive a rebuild of the page summary table — the page references stay valid as long as you don't *Clear*.

## Limitations

- Image input requires the gateway to use the OpenAI provider.
- No OCR for scanned PDFs (pages are sent as rendered images, which most modern vision models handle well).
- Apply runs sequentially across the selected matrix; very large selections may take a while.
- Apply does not yet operate on aggregation rows — only the page summary table.
- The Aggregation Detail table is rebuilt only when you click an aggregation name or add/remove pages. Edits to a page's Notes or LLM cells made after that won't propagate until you click the aggregation again.
