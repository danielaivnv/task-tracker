# Focus Tasks

A mobile-friendly task tracker optimized for Safari on iPhone, with deadlines, color labels, and multiple pages.

## Run locally

```bash
python3 -m http.server 8000
```

Open: `http://localhost:8000`

## Deploy to GitHub Pages

1. Create a new GitHub repository (public), for example: `focus-tasks`.
2. In this project folder run:

```bash
git add .
git commit -m "Initial task tracker app"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

3. In GitHub: `Settings -> Pages`.
4. In `Build and deployment` choose:
- `Source`: `Deploy from a branch`
- `Branch`: `main`
- `Folder`: `/ (root)`

5. Save and wait 1-2 minutes.
6. Your site URL will appear on that page.

## Notes

- Data is stored in browser `localStorage`.
- Tasks from old version (date-only) are migrated to deadline format automatically.
- Optional true Web Push backend setup: see `BACKEND_SETUP.md`.
