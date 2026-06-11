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

```powershell
cd c:\dev\git\awgp-mobile

# Upload zip to Supabase + refresh manifest.json
npm run upload:ocr -- <book-uuid>

# Or export + upload in one step
npm run export:ocr -- <book-uuid> --zip --upload
```

Requires `.env` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

### Upload existing package

```powershell
npm run upload:ocr -- <book-uuid>
npm run upload:ocr -- <book-uuid> --pages 37   # optional page count
```

### Export new package

```powershell
npm run export:ocr -- <book-uuid> --zip
```

Creates named zip in `scripts/.epub-work/{uuid}-ocr/`  
Format: `{code}-{title-slug}.zip` (e.g. `ENGP0810-determination-paves-the-way-to-success-xxyyyy.zip`).

### Sample book (pilot)

```powershell
npm run upload:ocr -- 01ba2961-be01-4d4c-ad88-330cdeadbed9 --pages 37
```

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

Public read on the bucket; uploads use service role from admin scripts.

---

## Related npm scripts

| Script | Purpose |
|--------|---------|
| `npm run export:ocr` | PDF → OCR package (named zip) |
| `npm run upload:ocr` | Upload zip + update `manifest.json` |
| `npm run assign:ocr` | Assign book to volunteer (`in_review`) |
| `npm run complete:ocr` | Mark corrected / published |
| `npm run publish:epub:ocr` | Corrected OCR → EPUB → Supabase |

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
git add manifest.json index.html README.md .nojekyll

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
