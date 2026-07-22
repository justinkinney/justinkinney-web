#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));

if (args.help || !args.bucket) {
  printHelp();
  process.exit(args.help ? 0 : 1);
}

const bucket = args.bucket;
const prefix = normalizePrefix(args.prefix || "");
const out = args.out || "public/gallery-data.js";
const region = args.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
const baseUrl = trimTrailingSlash(
  args.baseUrl ||
  process.env.GALLERY_BASE_URL ||
  (region
    ? `https://${bucket}.s3.${region}.amazonaws.com`
    : `https://${bucket}.s3.amazonaws.com`)
);

const extensions = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"]);
const response = JSON.parse(execFileSync("aws", [
  "s3api",
  "list-objects-v2",
  "--bucket", bucket,
  "--prefix", prefix,
  "--output", "json",
], { encoding: "utf8" }));

const photos = (response.Contents || [])
  .filter((object) => extensions.has(path.extname(object.Key).toLowerCase()))
  .sort((a, b) => String(b.LastModified || "").localeCompare(String(a.LastModified || "")))
  .map((object) => ({
    src: `${baseUrl}/${encodeS3Key(object.Key)}`,
    title: titleFromKey(object.Key),
    alt: titleFromKey(object.Key),
    key: object.Key,
    lastModified: object.LastModified || null,
    size: object.Size ?? null,
  }));

const payload = {
  generatedAt: new Date().toISOString(),
  source: `s3://${bucket}/${prefix}`,
  photos,
};

writeFileSync(out, `window.PHOTO_GALLERY = ${JSON.stringify(payload, null, 2)};\n`);
console.log(`Wrote ${photos.length} photos to ${out}`);

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    parsed[key] = inlineValue ?? argv[++i];
  }
  return parsed;
}

function normalizePrefix(value) {
  return value.replace(/^\/+/, "").replace(/\/+$/, value ? "/" : "");
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function encodeS3Key(key) {
  return key.split("/").map(encodeURIComponent).join("/");
}

function titleFromKey(key) {
  const filename = key.split("/").pop() || "Photo";
  return decodeURIComponent(filename)
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function printHelp() {
  console.log(`Generate the static gallery manifest from an S3 bucket.\n\nUsage:\n  node scripts/generate-gallery-index.mjs --bucket my-photo-bucket --prefix public/photos --base-url https://cdn.example.com --out gallery-data.js\n\nOptions:\n  --bucket     Required S3 bucket name\n  --prefix     Optional key prefix to scan\n  --base-url   Public bucket or CloudFront URL. Defaults to S3 public URL.\n  --region     AWS region for the default S3 URL\n  --out        Output file. Defaults to public/gallery-data.js\n`);
}
