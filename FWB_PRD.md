# Forensic Workbench Dashboard (FWB) — Product Requirements

## Vision
Provide a fast, browser-only tool that lets a reviewer triage every page of one or more PDFs, capture per-page notes, selectively apply an LLM to individual pages or to many pages at once using a curated library of prompts, group related pages into named aggregations for higher-level analysis, and export those aggregations as standalone PDF deliverables.

## Why a single HTML file
- Trivial to share — one HTML file plus a markdown user guide hosted on GitHub Pages.
- PDFs never leave the browser; only a chosen page image plus the user's prompt is sent over the network.
- LLM access is mediated by an external gateway, so provider API keys are never embedded in the client.

## Current scope (V0.8)

### Loading and rendering
- Drop or pick one or more PDFs.
- Render every page as a thumbnail in the **Page Summary** table.
- Editable `Notes` column per page.
- Click a thumbnail to open a single shared viewer popup that displays the page at higher resolution.

### Prompt library
- Library is a list of named prompts with four independent per-prompt flags:
  - **Manual** — prompt appears in the viewer's pill list for ad-hoc, single-page use.
  - **Summary table heading** — prompt gets a dedicated column in the Page Summary table, eligible for batch Apply on the page summary.
  - **Aggregation detail heading** — prompt gets a dedicated column in the Aggregation Detail table, eligible for batch Apply on the aggregation detail.
  - **Returns image** — Apply invokes the gateway's image-generation tool (OpenAI only) via an `image_generation: { enabled, force, action }` object; the normalized `images[]` response is read back and rendered as a clickable thumbnail with a full-size lightbox. The image is stored as a `data:` URL in the same result slot as text, so it round-trips through project Save / Open and propagates to the agg-detail table with no extra persistence path.
- Any combination of flags is valid. Badges (`M` / `T` / `A` / `I`) in the editor list show which flags are set.
- Library editor opens in a separate window; mutations sync live to the main window and viewer.
- Import / Export as JSON, including all per-prompt flags. Legacy files without flags default to `manual: true, summaryColumn: false, aggregationColumn: false, returnsImage: false`.

### Viewer (detail page)
- Pill list of saved library prompts (single-click copies into the prompt area; double-click runs immediately). Only `manual: true` prompts are shown.
- Free-text prompt area for ad-hoc queries.
- **Examine page using LLM** sends the rendered page plus the prompt to the gateway and writes the response into the row's *LLM Response* column.

### Page Summary table
- Base columns: *Select, File, Page, Thumbnail, Notes, LLM Response*. Plus one column per prompt flagged *Summary table heading*.
- Row checkboxes (with select-all in the header, including indeterminate state).
- Column checkboxes in each prompt column header.
- **Apply** runs each selected prompt against each selected page sequentially, populating the matching cells (pending → success/error). Pages are re-rendered at higher resolution (1024px wide) for the LLM call.

### Aggregations
- **Create / Add Aggregation** button takes the currently selected page-summary rows and either creates a new named aggregation or appends them to an existing one (deduped). Modal picker.
- **AGG Summary table** mirrors the page-table column layout: *Name, Pages, Thumbnail (first page), Notes, LLM Response, per-prompt columns, Delete*. Aggregation-level Notes are independent of page-level notes. Prompt columns reflect the *Summary table heading* set (read-only display).
- **AGG Detail table** appears when an aggregation is selected. Its columns are an independent set, driven by the *Aggregation detail heading* flag, so the detail table can show different prompt columns than either the page summary or the agg summary.
- Aggregations persist across rebuilds of the page summary table (refs are by `fileId/pageNum`) and carry their own `promptResults` map populated by the agg-detail Apply.

### Aggregation Detail table (V0.5 additions)
- Per-row drag handle (`☰`) on the leftmost column enables drag-to-reorder using native HTML5 drag-and-drop. Drop targets show top/bottom indicator lines. `agg.pageRefs` is rewritten in DOM order on `dragend`; the agg-summary thumbnail is refreshed so it tracks the new first page.
- Row checkboxes and prompt-column header checkboxes drive an **Apply** button in the table's own toolbar. Results are stored on the aggregation (`agg.promptResults[fileId:pageNum:promptId] = { status, text }`) and survive subsequent renders.
- For prompt columns that don't yet have an agg-level result, the cell falls back to displaying the matching cell from the source page-summary row so existing summary-table results are visible.
- **Save as PDF** button in the toolbar prompts for a filename, then assembles a single PDF from the aggregation's source pages in the user-defined order using `pdf-lib`. Source PDFs are cached by `fileId` so multi-page aggregations from one file only parse once.

### Project file (Save / Open)
- A *project file* captures a full analysis as a single JSON document under the hamburger panel's **Project** section.
- Two save modes selected at save time:
  - **Bundled** — embeds each loaded PDF as base64; the file is self-contained but larger (PDF size × ~1.33).
  - **Referenced** — stores only PDF metadata (filename, size, SHA-256); the file stays small but the user must re-attach the source PDFs on open. Match-on-open is by filename; the SHA-256 is recorded for future verification.
- Saved content: prompt library (all flags), file entries with stable `fileId`s, page-level notes / LLM response / per-prompt result cells, aggregations (name, notes, page order, page refs, `promptResults`), `selectedAggregationId`, and `nextId`.
- Open path is atomic-ish: PDF re-attach (referenced mode) happens before any state is wiped, so a cancelled open leaves the in-progress session untouched. After attach, FWB clears state, restores files (preserving original `fileId`s), restores the prompt library, optionally rebuilds the Page Summary table, repopulates per-cell text from the saved pages, then restores aggregations and re-renders.

### Hamburger menu (☰)
- **Load Demo Data** — fetches sample library and test PDF from GitHub.
- **Project** — Save Project / Open Project with a *bundled / referenced* radio for the save mode.
- **AI Gateway Settings** — configurable `/chat` endpoint with a hosted Cloud Run default.
- **Prompt Library** — Edit (separate window), Import (JSON), Export (JSON).
- **Debug** — log gateway requests to console.
- **User Guide** — renders `FWB_user_doc.md` from GitHub in a modal.

## Non-goals (for now)
- No server-side state, login, or per-user storage.
- No OCR for scanned PDFs (vision models handle this in practice).
- No automatic / in-browser autosave — the project file (and the library Export / aggregation Save-as-PDF paths) is the explicit persistence model. Session state is otherwise discarded on reload.
- No multi-page LLM operation against an aggregation as a single unit (Apply still runs per page, even on the agg detail table).

## Planned next
1. Verify SHA-256 hashes on re-attach for referenced project files (currently stored but not enforced); warn or fail on mismatch.
2. Autosave: mirror the current project to IndexedDB on every meaningful change, offer resume-on-reload, keep the JSON project file as the canonical portable format.
3. True multi-page LLM operation against an aggregation as a single unit — decide on semantics for "what does multi-page mean to the LLM" (concatenated images vs. per-page-then-summarize) and surface it as an agg-summary-row Apply.
4. Auto-refresh the Aggregation Detail's *Notes* and *LLM Response* fallback columns when the underlying page-summary data changes (currently only refreshed on rebuild).
5. Expose model selection in the main UI for Apply (currently hardcoded to match the viewer's default).
6. Re-orderable / hideable columns on the Page Summary table; CSV export of any table.
7. Drag-to-reorder on the Aggregation Summary table (re-order which aggregation appears first).
8. Per-row LLM history (multiple prompts and responses against the same page, beyond the single *LLM Response* cell).
9. OCR fallback for scanned PDFs (Tesseract.js or similar) when vision-model output is unsatisfactory.
10. PDF assembly options: insert a cover/separator page per aggregation, add page numbers, embed agg-detail notes / LLM responses as annotations.
11. Schema versioning for project files: a `version` field is already written, but no migration logic exists yet.

## Architecture notes
- Page rendering is local via PDF.js (CDN, version-pinned).
- PDF assembly for **Save as PDF** is local via `pdf-lib` (CDN, version-pinned). The original source PDFs are re-loaded by `pdf-lib` from the in-browser `File` objects; rendered thumbnails / images are not used so source-PDF quality is preserved.
- The page viewer is built from a `Blob` URL inside the main script — keeps the whole app in `fwb.html`.
- The prompt-library editor uses the same Blob-URL popup pattern; mutations are postMessaged back to the main window, which is the source of truth.
- The LLM gateway is `ai_proxy` (`POST /chat`), responsible for provider keys, CORS, and request-size limits.
- The Aggregation Detail table reads live cell text from the Page Summary DOM for its fallback cells; agg-level prompt results live on the aggregation object itself and are written by the agg-detail Apply.
- Drag-to-reorder uses native HTML5 D&D against the agg-detail `tbody`; the drag is only armed when the user grabs the row's drag-handle cell, so text selection in other cells doesn't trigger a row drag.
- Project save / open is local-only. Bundled mode reads each PDF's bytes via `File.arrayBuffer()` and encodes via a `FileReader`-based base64 helper to avoid call-stack limits on large files; open decodes via `atob` into a `Uint8Array` then a `File`. SHA-256 hashes use `crypto.subtle.digest`. Page-summary cell text is extracted from the DOM at save time (the DOM is the source of truth for those cells); aggregations are already in-memory state and are serialized directly.
- Project file schema (informal):
  ```
  { kind: "fwb-project", version: 1, appVersion, exportedAt, mode,
    nextId, promptLibrary, currentSummaryPrompts, currentAggregationPrompts,
    summaryTableBuilt, files: [{ id, name, size, sha256, data? }],
    pages: [{ fileId, pageNum, notes, llmResponse, promptResults }],
    aggregations: [{ id, name, notes, pageRefs, promptResults }],
    selectedAggregationId }
  ```
- Demo files and the user guide are hosted at `https://faw987.github.io/` (`fwb-prompt-library.json`, `forensic_test_00.pdf`, `FWB_user_doc.md`).

## File layout
- `fwb.html` — the application.
- `FWB_user_doc.md` — user guide, surfaced via the hamburger menu.
- `FWB_PRD.md` — this document.
- `deploy.sh` — copies `fwb.html` and `FWB_user_doc.md` to the GitHub Pages repo and pushes.
- Sample data lives on GitHub Pages alongside the docs.

## Version history
- **V0.2** — Initial public version: drop zone, page summary table, viewer popup, prompt library, gateway settings.
- **V0.3** — Per-prompt `manual` / `summaryColumn` flags; row + column selection in the page summary table; **Apply** button for batch LLM runs.
- **V0.4** — Aggregations: named groupings of pages with their own summary and detail tables; *Create / Add Aggregation* flow with modal picker.
- **V0.5** — Third prompt flag (`aggregationColumn`) and an independent prompt-column set for the Aggregation Detail table; row + column selection and **Apply** on the agg-detail table with results stored on the aggregation; drag-to-reorder agg-detail rows; **Save as PDF** that assembles the aggregation's source pages in the user-defined order using `pdf-lib`.
- **V0.6** — Project file Save / Open under the hamburger panel, with *bundled* (PDFs embedded as base64) and *referenced* (filename + SHA-256, re-attach on open) modes. Round-trips PDFs, prompt library, page-summary notes / LLM responses / per-prompt result cells, aggregations (including agg-detail Apply results), and the selected aggregation.
- **V0.7** — Per-prompt provider/model selection in the library editor; bundled project save / load; in-app Product Requirements access.
- **V0.8** — Fourth prompt flag (`returnsImage`): image-returning prompts. Apply drives the ai_proxy image-generation tool (`image_generation` request object, OpenAI only) and reads the normalized `images[]` response; the result cell shows a clickable thumbnail with a full-size lightbox. Images persist through project Save / Open and propagate to the agg-detail table via the shared result slot.
