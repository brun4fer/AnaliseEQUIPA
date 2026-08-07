# Feirense Team Analysis

Web application for Feirense team analysis. It identifies video moments and submoments, records pitch and goal locations, compares identified match periods, and exports local clips without uploading source videos.

## Local setup

1. Copy `.env.example` to `.env.local` and configure an independent PostgreSQL database.
2. Set a strong `AUTH_SECRET` and the initial administrator credentials.
3. Run `npm install`.
4. Run `npm run prisma:migrate` and `npm run prisma:seed` for a new database.
5. Run `npm run dev` and open `http://localhost:3000`.

The first administrator is provisioned on the first successful login and must change the temporary password immediately.

## Data and videos

Source videos remain on the user's computer. Neon stores only match metadata, timestamps, classifications, notes, and coordinates. Large videos may need to be selected again after closing the browser, but saved analysis data is not affected.

## Production checklist

- Configure `DATABASE_URL`, `AUTH_SECRET`, `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL`, and `INITIAL_ADMIN_PASSWORD` in Vercel.
- Apply Prisma migrations to Neon before releasing a build.
- Use a public HTTPS production domain so Chrome can offer direct folder export.
- Assign a production domain and keep Vercel Standard Protection for generated deployment URLs if desired; the public production domain is protected by the application's own login.
- Download a metadata backup from Maintenance before structural database changes.

## Quality checks

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. The same checks run automatically in GitHub Actions.
