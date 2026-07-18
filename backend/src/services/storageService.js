const fs = require('fs');
const path = require('path');
const config = require('../config');

const BUCKET = 'uploads';

const isStorageConfigured = () => !!(config.supabase.url && config.supabase.serviceRoleKey);

let bucketReady = false;

const ensureBucket = async () => {
  if (bucketReady) return;
  const res = await fetch(`${config.supabase.url}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.supabase.serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });
  // 400 "already exists" is fine
  if (!res.ok) {
    const body = await res.text();
    if (!/already exists|Duplicate/i.test(body)) {
      console.error('[Storage] Bucket create failed:', body);
    }
  }
  bucketReady = true;
};

const contentTypeFor = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  const map = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
  };
  return map[ext] || 'application/octet-stream';
};

/**
 * Uploads a multer disk file to Supabase Storage and returns a permanent
 * public URL. Falls back to the local /uploads path when Supabase is not
 * configured or the upload fails (e.g. during local development offline).
 */
const storeUploadedFile = async (file, subDir) => {
  const localUrl = `/uploads/${subDir}/${file.filename}`;
  if (!isStorageConfigured()) return localUrl;

  try {
    await ensureBucket();
    const objectPath = `${subDir}/${file.filename}`;
    const buffer = fs.readFileSync(file.path);

    const res = await fetch(
      `${config.supabase.url}/storage/v1/object/${BUCKET}/${objectPath}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.supabase.serviceRoleKey}`,
          'Content-Type': contentTypeFor(file.filename),
          'x-upsert': 'true',
        },
        body: buffer,
      }
    );

    if (!res.ok) {
      console.error('[Storage] Upload failed:', await res.text());
      return localUrl;
    }

    return `${config.supabase.url}/storage/v1/object/public/${BUCKET}/${objectPath}`;
  } catch (error) {
    console.error('[Storage] Upload error:', error.message);
    return localUrl;
  }
};

module.exports = { storeUploadedFile, isStorageConfigured };
