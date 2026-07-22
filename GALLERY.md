# Static S3 photo gallery

The Astro gallery page loads photos from `/gallery-data.js`, a static manifest in `public/gallery-data.js` that can be regenerated from an S3 bucket and deployed with the rest of the site.

## Generate the gallery index

```bash
node scripts/generate-gallery-index.mjs \
  --bucket my-photo-bucket \
  --prefix media/2026-07-boulder-lake \
  --base-url https://cdn.example.com \
  --out public/gallery-data.js
```

Options:

- `--bucket`: S3 bucket to scan.
- `--prefix`: optional key prefix for photos.
- `--base-url`: public bucket URL or CloudFront distribution. If omitted, the script uses an S3 public URL.
- `--region`: AWS region used when building the default S3 URL.
- `--out`: output path, defaults to `public/gallery-data.js`.

The generator includes `.avif`, `.gif`, `.jpeg`, `.jpg`, `.png`, and `.webp` objects, sorted newest first.

## S3 notes

Keep the site static by making the image objects publicly readable through either:

1. CloudFront in front of the bucket, recommended; pass the CloudFront URL as `--base-url`.
2. S3 static/public object URLs, fine for a small personal site.

Regenerate `public/gallery-data.js` whenever photos change, then rebuild and redeploy the Astro `dist/` output.

For this site, the photos are expected to live under `media/` in S3, for example:

```text
media/2026-07-boulder-lake/PXL_20260717_134735473.jpg
```

If your working copy has photos under `images/`, upload them to the `media/` prefix:

```bash
aws s3 sync images/ s3://my-photo-bucket/media/ \
  --exclude "Boulder Lake Photo Dump-1-001.zip"
```

The checked-in `public/gallery-data.js` uses `media/...` URLs so it matches the S3 layout.
