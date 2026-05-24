# Forensic Workbench Dashboard (FWB) — User Guide

FWB is a single-page browser app for forensic review of PDF documents. PDFs are processed locally in your browser; only the page image you choose to examine — together with the prompt you supply — is sent through the configured LLM gateway.

## Quick start

The fastest path is the **Demo Data** section at the top of the hamburger menu (☰, top-right). Pick a demo set (**demo-1** or **demo-2**) and click the green **Load Demo Data** button. It downloads a ready-made demo project from GitHub and opens it, so you can explore the full workflow — prompt library, summary table, and aggregations — without supplying anything.

## Concepts

FWB shows three related tables, all driven from the PDFs you load:

- **Page Summary** — one row per page across every loaded PDF. This is the primary review surface.
- **Aggregations** — named groups of pages you pick from the page summary. One row per aggregation.
- **Aggregation Detail** — the pages that make up the currently selected aggregation, in an order you control. Its prompt columns are driven by an independent flag in the prompt library, so the detail table can show a different set of prompt columns than either the page summary or the aggregations table.

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

## Apply: run prompts across many rows (Page Summary)

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

### Aggregations of aggregations (recursive)

An aggregation can contain other aggregations as well as (or instead of) pages. For example, with *A1* = page 1 and *A2* = page 2, you can build *All-A* made up of *A1* and *A2*; expanding *All-A* yields pages 1 and 2.

- The **Create / Add Aggregation** dialog has an **Include aggregations as members** checklist. Tick any existing aggregations to fold them into the new (or selected) aggregation. You can build a member-only aggregation with no pages of its own — the **Create / Add Aggregation** button is available even with no page rows checked, as long as at least one aggregation already exists.
- You can also start from the **Aggregations** table itself: each row has a **Select** checkbox (with a select-all box in the header). Check one or more aggregation rows and click the **Create / Add Aggregation** button above that table. The same dialog opens with those aggregations pre-checked as members — name a new aggregation to combine them, or pick an existing one to add them to. This is the natural way to build bundled / "meta" aggregations from groups you have already defined.
- Membership is resolved **recursively**: opening an aggregation expands every member aggregation (and their members, and so on) down to a flat, de-duplicated page list. When an aggregation has both its own pages and member aggregations, the members are expanded first (in listed order), then its own direct pages follow.
- Cycles are prevented: the checklist disables any aggregation that is the target itself, already a member, or whose inclusion would form a loop. Deleting an aggregation also removes it from every aggregation that listed it as a member.

The **Aggregations** table appears below the page summary table with one row per aggregation. Columns mirror the page summary table: *Select, Name, Parent, Pages, Thumbnail* (the first page in the expanded list), *Notes, LLM Response*, and any *Summary table heading* prompt columns, plus a delete (**✕**) icon. The leftmost *Select* checkbox feeds the **Create / Add Aggregation** button directly above the table (see above). The **Parent** column shows the path of any aggregation that contains this one (e.g. `Root / Mid`; multiple parents are separated by `; `) and is blank for a top-level aggregation. The **Pages** count is the fully expanded total, marked *(expanded)* for composite aggregations. Aggregation-level *Notes* are independent of the per-page notes.

Click an aggregation's **Name** to open the **Aggregation Detail** table. Clicking the **✕** in the Aggregations table deletes the whole aggregation (with a confirmation prompt). The pages themselves are unaffected.

## Aggregation Detail table

The detail table has one row per page in the aggregation (after recursive expansion of any member aggregations), in an order you control for a leaf aggregation. Its columns are *Drag, Select, ✕, File, Page, Thumbnail, Notes, LLM Response*, followed by one column for every prompt marked **Aggregation detail heading** in the library editor.

For a **composite** aggregation (one that has member aggregations), the detail rows are the read-only expanded list — the drag handle and per-row **✕** are omitted, because those pages belong to the member aggregations. Reorder or remove them on the source aggregation instead; the composite reflects the change when re-opened. **Apply** operates on the full expanded list; **Save as PDF** opens the PDF builder seeded with the expanded list (or your checked subset), where order and removals are scoped to that one export.

A toolbar above the table holds two buttons:

- **Apply** — runs the selected prompt columns against the selected rows of the aggregation detail (same model as the page-summary Apply). Results are stored on the aggregation, so they survive page-summary rebuilds and re-selecting the aggregation.
- **Save as PDF** — opens the **PDF builder** (see below) where you choose pages, order, and which columns to append before saving.

### Selecting rows and columns

- The leftmost *Select* column has a header checkbox that toggles all rows.
- Each prompt column header has its own checkbox.
- **Apply** is enabled once at least one row and one prompt column are checked.

### Reordering rows

Each row has a **☰** drag handle at the very left. Grab the handle and drag the row up or down — drop targets are highlighted with a colored bar above or below the row. Drop the row to commit the new order. The aggregation's stored page order is updated immediately, and the aggregation-summary thumbnail (which shows the first page) refreshes to track the new first row.

You can only initiate a drag from the handle, so selecting text in other cells won't accidentally start a row drag.

### Apply results vs. page-summary fallback

When an aggregation-detail cell hasn't been filled in by an agg-detail Apply, FWB falls back to showing the matching cell from the page-summary row (if that prompt is also marked *Summary table heading* and you've run Apply there). Once you run Apply on the agg detail, the agg-level result replaces the fallback and is stored on the aggregation. To re-fetch, simply select the row + column again and click Apply — the new result overwrites the stored value.

### Save as PDF — the PDF builder (experimental)

Click **Save as PDF** to open the **PDF builder** dialog. It is pre-loaded with the **resolved page set**: if you have checked one or more rows in the aggregation detail it uses just those, otherwise it uses every page in the aggregation (nested member aggregations are already expanded into individual pages by the detail table).

In the builder, each page is a card showing a thumbnail and `<file> — Page N`. You can:

- **Reorder** — drag a card by its **☰** handle to change the page order in the output. This affects only this PDF; it does not change the aggregation's stored order.
- **Remove** — click **✕** on a card to drop that page from the PDF. This does not affect the aggregation.
- **Pick columns per page** — each card lists a checkbox for every column that actually has content for that page (*Notes*, *LLM Response*, and any aggregation-detail prompt columns). All are checked by default. Image results are labelled `(image)`.

Click **Save PDF**, accept or edit the suggested filename (default: `<aggregation name>.pdf`), and FWB builds the document:

1. For each card, in the builder's order, the original source page is copied directly from your loaded PDF (no re-rendering — source quality is preserved).
2. If any columns are ticked for that page, a generated **annotation page** is inserted immediately after it, listing each selected column's label and value. Image-result columns embed the image; long text wraps and spills onto additional annotation pages as needed.
3. The assembled PDF is saved and downloaded. A status line shows progress.

A page with no column content (or with every column unticked) contributes just its source page, with no annotation page — so unchecking everything reproduces the old image-only export.

This feature is experimental and the layout may change.

### Removing pages from an aggregation

Each detail row has a **✕** button to remove that page from the aggregation. Removing pages does not affect the underlying page summary row.

## Hamburger menu (☰)

The hamburger icon in the top-right opens the configuration panel. When the panel is open, the icon morphs into a blue **✕** and briefly pulses to draw the eye — click it again to close. Hovering the icon while open shows "Close menu" as its tooltip. The panel also closes automatically after you save the gateway endpoint, load demo data, or open the user guide.

### Demo Data
Select a demo set (**demo-1** or **demo-2**) and click **Load Demo Data**. FWB downloads the matching demo project bundle (a `.zip`) from GitHub, unzips it, and opens the project — restoring its prompt library, summary table, and aggregations. Useful for first-time use or for sharing a working demo. If a demo project was saved in *referenced* mode, FWB will ask you to re-attach its source PDF(s), just like opening any referenced project. (demo-2 is reserved and not published yet.)

### Project (Save / Open)

A *project file* captures a complete analysis as a single JSON file: the loaded PDFs (optionally embedded), the prompt library, every page's notes and LLM response, every Apply result on the page summary, and every aggregation with its name, page order, member-aggregation links, notes, and stored agg-detail Apply results.

- **Save Project** — pick a save mode, then click *Save Project*. You'll be prompted for a filename (default `fwb-project-<timestamp>.json`). The panel closes and a status line confirms the save and reports the file size.
- **Open Project** — click *Open Project* and pick a previously-saved `.json` file. FWB clears its current state, restores the project, rebuilds the page summary table (if it was built in the saved project), and re-renders any aggregations. If anything fails before state is wiped (e.g. you cancel a re-attach) your in-progress work is left alone.

#### Save modes

Choose one before clicking *Save Project*:

- **Bundled** — PDFs are embedded in the JSON file as base64. The resulting file is self-contained: anyone with it can open the project without needing the original PDFs. Trade-off is size — base64 inflates PDF bytes by about a third, so projects with many or large PDFs become big.
- **Referenced** — only the PDF filenames, sizes, and SHA-256 hashes are stored. The resulting file is small (typically a few KB plus per-page text), but on **Open Project** FWB asks you to re-attach the source PDFs from disk. Files are matched by filename; the hash is recorded for future verification but not enforced yet.

Use bundled when you want a portable, self-contained deliverable; use referenced when you're working a case across multiple sessions on the same machine and want the project file to stay light.

#### What round-trips
- All loaded PDFs (bundled or re-attached) with their original `fileId`s preserved so aggregations remain valid.
- The full prompt library, including all four per-prompt flags.
- The Page Summary table: notes, LLM Response, and each *Summary table heading* prompt-result cell.
- All aggregations: name, notes, page order (including any drag-to-reorder you did), and the agg-detail `promptResults` from Apply.
- The currently selected aggregation, so the Aggregation Detail table reopens on the same group.

#### What does **not** persist
- Settings (gateway endpoint, debug toggle, save-mode radio) are still session-scoped.
- LLM responses that were *in flight* when you saved aren't restored as pending — only completed text is captured.

### AI Gateway Settings
- **Gateway Endpoint** — full URL of an `ai_proxy` `/chat` endpoint. The default points at a hosted Cloud Run instance. Override it if you run the gateway locally (typically `http://localhost:8080/chat`).
- The gateway holds provider keys; the browser never sees them.
- If you save the field empty, FWB falls back to the default endpoint.

### Prompt Library
A library is a list of named prompts you can apply to any page or run across the table via Apply.

- **Edit** — opens the library editor in a separate window. Add prompts (name + text), reorder them with the ↑/↓ buttons, edit the selected prompt, or delete entries. Each prompt has four independent checkboxes:
  - **Manual** — the prompt appears in the viewer's pill list when you open a detail page.
  - **Summary table heading** — the prompt becomes a column in the page summary table, eligible for Apply on the page summary.
  - **Aggregation detail heading** — the prompt becomes a column in the aggregation detail table, eligible for Apply on the aggregation detail.
  - **Returns image** — the prompt asks the gateway for an *image* back rather than text (for example: "highlight every date on this page and return the highlighted page"). When the result arrives, the cell shows a thumbnail of the returned image instead of text. Click the thumbnail to view the image full-size; click anywhere outside it (or press Esc) to close. Image results round-trip through Save / Open project files and propagate to the aggregation detail table the same way text results do.
  Any combination is valid. A small **M**, **T**, **A**, or **I** badge next to each list entry shows which flags are set. Changes sync live to the main window and to any open viewer.

  Each prompt also has a **Provider** and **Model**:
  - **Provider** — *OpenAI*, *Anthropic*, or *Google (Gemini)*. This is the LLM provider used when the prompt is run via Apply (page summary or aggregation detail).
  - **Model** — the model used for that provider. For OpenAI you can choose *gpt-5.4-nano* or *gpt-5.4-mini*. Anthropic and Google show *Not available* for now — a prompt set to one of those providers will report an error when applied until a model is available.

  Prompts with no provider/model set (including libraries from earlier versions) default to OpenAI + gpt-5.4-nano.
- **Export** — saves the current library as `fwb-prompt-library.json`, including all per-prompt flags and the provider/model.
- **Import** — loads a JSON file. Either an array of `{ name, text, manual, summaryColumn, aggregationColumn, returnsImage, provider, model }` objects, or `{ "prompts": [ ... ] }`. Missing flags default to `manual: true, summaryColumn: false, aggregationColumn: false, returnsImage: false` and missing provider/model default to OpenAI + gpt-5.4-nano on import, so libraries exported before any given field was added load without changes.

### User Guide
Opens this document.

## What is and isn't persisted

State is kept **in memory for the session**, with three explicit persistence paths:

- **Save Project** (hamburger panel → Project) — a single JSON file capturing PDFs, prompt library, notes, LLM responses, Apply results, and aggregations. Bundled mode embeds the PDFs; referenced mode keeps the file small and re-attaches PDFs on open.
- **Prompt Library → Export** — a JSON of just the prompt library, useful when you want to share prompts without an analysis attached.
- **Aggregation Detail → Save as PDF** — the PDF builder: a standalone PDF deliverable of chosen pages, in a chosen order, with selected column data appended as annotation pages.

Closing or reloading the page clears everything that hasn't been saved. The gateway endpoint, debug toggle, and project save-mode radio are session-scoped too. Automatic in-browser autosave is on the roadmap.

## Tips

- The viewer caches each PDF after the first thumbnail click, so subsequent clicks on the same file are fast.
- Hover a library pill in the viewer to see the full prompt text in a tooltip.
- Hover a column header to see the full prompt text for that column.
- High-resolution pages can produce sizable base64 images — if a request fails with a payload error, try a less detailed prompt or a smaller PDF.
- Aggregations and their stored Apply results survive a rebuild of the page summary table — the page references stay valid as long as you don't *Clear*.
- The Save-as-PDF output draws from the original source PDFs, so text remains selectable and the file size stays close to the originals.

## Limitations

- Image input requires the gateway to use the OpenAI provider.
- A *Returns image* prompt uses the gateway's image-generation tool, which is **OpenAI only** — set such a prompt's provider to OpenAI. If no image comes back, FWB shows the gateway's error text in the cell instead of a thumbnail.
- No OCR for scanned PDFs (pages are sent as rendered images, which most modern vision models handle well).
- Apply (both page-summary and aggregation-detail) runs sequentially across the selected matrix; very large selections may take a while.
- Apply does not yet operate on the **Aggregations** table itself as a multi-page-as-one-document operation. The agg-detail Apply still calls the LLM one page at a time.
- The Aggregation Detail table's *Notes* and (fallback) *LLM Response* values are refreshed only when you click an aggregation name or add / remove pages. Page-summary edits made after that won't propagate until you click the aggregation again. Agg-level Apply results, however, are stored on the aggregation and always shown.
