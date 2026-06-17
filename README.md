# AWGP Books — OCR review

Local workflow for OCR packages: export, upload zips to Supabase, review/correct text, publish EPUB.

**GitHub Pages deploy is optional** — not required for now. Use local files and Supabase download URLs.

| What | Where |
|------|--------|
| Source (this folder) | `awgp-mobile/books-landing/` |
| Local OCR work | `awgp-mobile/scripts/.epub-work/{book-uuid}-ocr/` |
| Zip storage | Supabase bucket `books-ocr-review` |
| Book list | `manifest.json` (updated by `upload:ocr`) |

---

## Files in this folder

| File | Purpose |
|------|---------|
| `index.html` | Optional local dashboard (reads `manifest.json`) |
| `manifest.json` | Book list + Supabase download URLs |
| `README.md` | This guide |

---

## Admin workflow (local)

All commands from `c:\dev\git\awgp-mobile`:

### New book (standard — use this going forward)

```powershell
cd c:\dev\git\awgp-mobile

# OCR + paragraph reflow + named zip + Supabase upload + manifest
npm run export:ocr -- <book-uuid> --zip --upload
```

OCR output joins wrapped lines into paragraphs automatically (`ocr-draft.txt`). Raw per-page text stays in `ocr/page_XXX.json`.

Then sync public page (optional):

```powershell
Copy-Item books-landing\manifest.json C:\dev\git\awgp-books\ -Force
# commit + push awgp-books (see GitHub section below)
```

### Re-export / refresh an existing package

If OCR already exists locally and you only need reflow + new zip + upload:

```powershell
npm run reflow:ocr -- <book-uuid> --upload
```

Requires `scripts/.epub-work/{uuid}-ocr/` from a prior export.

Requires `.env` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

---

## Volunteer assignment (manifest coordination)

List stays **public** for now — status and assignee are visible so volunteers can avoid duplicate work. Re-uploading a zip resets the book to `needs_review` (clears assignment).

### Assign when someone starts (optional — volunteers can self-claim on the page)

```powershell
npm run assign:ocr -- <book-uuid> --by "volunteer@email.com"
```

Sets manifest `in_review` and upserts `book_ocr_picks`. Or let volunteers use **Picked up by → Save** on the landing page.

### Mark complete when ocr-corrected.txt is received

```powershell
npm run complete:ocr -- <book-uuid>
```

Sets `status: corrected`, `completed_at`.

### After EPUB is published to the app

```powershell
npm run complete:ocr -- <book-uuid> --published
```

### Release if volunteer drops out (back to available)

```powershell
npm run assign:ocr -- <book-uuid> --release
```

### Manifest fields

| Field | When set |
|-------|----------|
| `status` | `needs_review` → `in_review` → `corrected` → `published` |
| `assigned_to` | On assign |
| `claimed_at` | On assign |
| `completed_at` | On complete |

---

## View book list locally (optional)

`index.html` needs a small local server (browsers block `fetch` on `file://`).

```powershell
cd c:\dev\git\awgp-mobile
npm run sync:books-config   # once — writes books-landing/config.json from .env
cd books-landing
npx --yes serve -p 3456
```

Open http://localhost:3456 — book list, **Picked up by** (name + Save), and download links.

Volunteers save their name to Supabase `book_ocr_picks` (first save wins; everyone sees who claimed a book).

Or skip the page entirely: copy `download_url` from `manifest.json` and share that link directly.

---

## Verify

1. Open `books-landing/manifest.json` — check `download_url` for the book
2. Open that URL in a browser — should download the zip (~20 MB for sample)
3. Unzip locally and confirm `ocr-draft.txt`, `pages/`, `book-id.txt` are present

---

## Correction workflow (local)

1. Download zip (from Supabase URL or local `scripts/.epub-work/{uuid}-ocr/`)
2. Open `ocr-draft.txt` alongside `pages/page_XXX.png`
3. Fix OCR mistakes; keep page markers: `===== PAGE N =====`
4. Save as `ocr-corrected.txt` in the same folder:

   `scripts/.epub-work/{book-uuid}-ocr/ocr-corrected.txt`

---

## Publish EPUB after corrections

```powershell
cd c:\dev\git\awgp-mobile
npm run publish:epub:ocr -- <book-uuid>
```

Until `epub_storage_path` is set in Supabase, the app keeps using PDF.

---

## Storage layout (Supabase)

```
books-ocr-review/
  english/ENGP0810-determination-paves-the-way-to-success-xxyyyy.zip
  hindi/...
```

Public read on the bucket; zip uploads use service role from admin scripts.

Volunteer **ocr-corrected.txt** uploads (one-time setup):

```
books-ocr-review/
  gujarati/{book-uuid}/ocr-corrected.txt   ← volunteer upload
  gujarati/GUJR0964-pavitra-jivan-re2010.zip
```

1. Apply migration: `npx supabase db push` (creates `book_ocr_submissions` table)
2. Deploy Edge Function: `npm run deploy:submit-ocr`
3. Refresh landing config: `npm run sync:books-config`
4. Copy `books-landing/` to [awgp-books](https://github.com/devn03215/awgp-books) and push (include `index.html`, `config.json`, `manifest.json`)

Admin — pull corrected file into local pipeline:

```powershell
npm run fetch:ocr:corrected -- 003ba5eb-87d2-4433-a28c-8d9133b5f14a
npm run sync:ocr:manifest
npm run publish:epub:ocr -- 003ba5eb-87d2-4433-a28c-8d9133b5f14a
```

---

## Related npm scripts

| Script | Purpose |
|--------|---------|
| `npm run export:ocr` | **New book:** PDF → OCR + reflow + zip (`--zip --upload`) |
| `npm run reflow:ocr` | **Existing package:** reflow + rezip + upload (`--upload`) |
| `npm run upload:ocr` | Upload zip only (no OCR/reflow) |
| `npm run assign:ocr` | Assign book to volunteer (`in_review`) |
| `npm run complete:ocr` | Mark corrected / published (manual) |
| `npm run fetch:ocr:corrected` | Download volunteer `ocr-corrected.txt` to `.epub-work/` |
| `npm run sync:ocr:manifest` | Update manifest from `book_ocr_submissions` |
| `npm run publish:epub:ocr` | Corrected OCR → EPUB → Supabase |
| `npm run sync:books-config` | Write `books-landing/config.json` from `.env` |
| `npm run deploy:submit-ocr` | Deploy volunteer upload Edge Function |

---

## Optional later — GitHub Pages (`awgp-books`)

Only when you want a public volunteer page. Not needed for local use.

<details>
<summary>Deploy to GitHub (click to expand)</summary>

Repo: https://github.com/devn03215/awgp-books  
Live URL would be: https://devn03215.github.io/awgp-books/

### Sync after upload

```powershell
cd c:\dev\git\awgp-books
Copy-Item c:\dev\git\awgp-mobile\books-landing\* . -Force
git add manifest.json index.html config.json README.md .nojekyll

$env:GIT_AUTHOR_NAME="devn03215"
$env:GIT_AUTHOR_EMAIL="devn03215@gmail.com"
$env:GIT_COMMITTER_NAME="devn03215"
$env:GIT_COMMITTER_EMAIL="devn03215@gmail.com"
git commit -m "Update OCR review manifest"
git push
```

### Enable Pages (one-time)

GitHub → repo **Settings → Pages** → branch `main`, folder `/ (root)`.

</details>
