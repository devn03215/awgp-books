# AWGP Books — OCR review landing page

Static page for volunteers to download OCR review packages (`{book-code}-{title}.zip`).

Host this folder on GitHub Pages as **`awgp-books`** (same pattern as [awgp-share](https://github.com/devn03215/awgp-share)).

## Files

| File | Purpose |
|------|---------|
| `index.html` | Volunteer dashboard (reads manifest) |
| `manifest.json` | Book list + Supabase download URLs |

Zip files live in **Supabase Storage** bucket `books-ocr-review` — not in this repo.

## Admin workflow

```powershell
# 1. Export OCR package (named zip)
npm run export:ocr -- <book-uuid> --zip

# 2. Upload zip + update manifest.json
npm run upload:ocr -- <book-uuid>

# 3. Push books-landing/ to awgp-books repo (see below)
```

## Deploy to GitHub Pages

1. Create repo `awgp-books` (or use existing)
2. Copy contents of `books-landing/` to repo root
3. Settings → Pages → Deploy from branch `main` / root
4. URL will be `https://devn03215.github.io/awgp-books/`

After each upload, commit and push updated `manifest.json`.

## Volunteer workflow

1. Open the landing page
2. Download zip for a book
3. Edit `ocr-draft.txt` using `pages/*.png`
4. Save as `ocr-corrected.txt` and send back (email / form — TBD)

## Storage layout

```
books-ocr-review/
  english/ENGP0810-determination-paves-the-way-to-success.zip
  hindi/...
```

Public read; uploads use service role from admin scripts.
