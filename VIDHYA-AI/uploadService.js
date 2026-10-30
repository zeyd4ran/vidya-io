// ---------------------------------------------------------------------------
// Upload Service — Phase 3
// ---------------------------------------------------------------------------
// File upload handling with type/size validation.
// Stores locally under data/uploads/ for now — abstracted for S3 migration.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { db, saveDB } = require('./db');

const UPLOAD_DIR = path.join(__dirname, 'data', 'uploads');
const MAX_FILE_SIZE = parseInt(process.env.UPLOAD_MAX_BYTES || '10485760', 10); // 10 MB

// Allowed MIME types and their extensions
const ALLOWED_TYPES = {
  'application/pdf':   '.pdf',
  'image/png':         '.png',
  'image/jpeg':        '.jpg',
  'image/webp':        '.webp',
  'text/plain':        '.txt',
  'text/markdown':     '.md',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
};

/**
 * Ensure upload directory exists.
 */
function _ensureDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

/**
 * Validate and save an uploaded file.
 * @param {Buffer} buffer     — raw file content
 * @param {string} originalName — original filename
 * @param {string} mimeType    — detected MIME type
 * @param {number} userId      — uploader's user ID
 * @returns {{ file: object }} or throws on validation failure
 */
function saveUpload(buffer, originalName, mimeType, userId) {
  // Validate type
  if (!ALLOWED_TYPES[mimeType]) {
    const allowed = Object.keys(ALLOWED_TYPES).join(', ');
    throw Object.assign(
      new Error(`File type "${mimeType}" not allowed. Allowed: ${allowed}`),
      { status: 400, expose: true }
    );
  }

  // Validate size
  if (buffer.length > MAX_FILE_SIZE) {
    throw Object.assign(
      new Error(`File too large (${(buffer.length / 1048576).toFixed(1)} MB). Max: ${(MAX_FILE_SIZE / 1048576).toFixed(0)} MB`),
      { status: 413, expose: true }
    );
  }

  // Generate safe filename
  _ensureDir();
  const ext = ALLOWED_TYPES[mimeType];
  const safeId = randomUUID();
  const storedName = `${safeId}${ext}`;
  const storedPath = path.join(UPLOAD_DIR, storedName);

  // Write to local storage
  fs.writeFileSync(storedPath, buffer);

  // Record in DB
  const fileRecord = {
    id: (db.uploaded_files.length ? Math.max(...db.uploaded_files.map(f => f.id || 0)) + 1 : 1),
    user_id: userId,
    original_name: originalName,
    stored_name: storedName,
    mime_type: mimeType,
    size_bytes: buffer.length,
    storage_backend: 'local',       // 'local' | 's3' — for migration
    storage_path: storedPath,       // local path or S3 key
    created_at: new Date().toISOString()
  };

  db.uploaded_files.push(fileRecord);
  saveDB();

  return fileRecord;
}

/**
 * Get a file record by ID. Does NOT return the file content.
 */
function getFileRecord(fileId) {
  return db.uploaded_files.find(f => f.id === fileId) || null;
}

/**
 * Get the readable stream for a file. Throws if not found.
 */
function getFileStream(fileId) {
  const record = getFileRecord(fileId);
  if (!record) throw Object.assign(new Error('File not found'), { status: 404, expose: true });

  if (record.storage_backend === 'local') {
    if (!fs.existsSync(record.storage_path)) {
      throw Object.assign(new Error('File data missing from storage'), { status: 404, expose: true });
    }
    return {
      stream: fs.createReadStream(record.storage_path),
      record
    };
  }

  // Placeholder for S3 — when migrated, read from S3 here
  throw Object.assign(new Error('Storage backend not supported'), { status: 500, expose: true });
}

/**
 * Delete a file (owner or admin only).
 */
function deleteFile(fileId, userId) {
  const idx = db.uploaded_files.findIndex(f => f.id === fileId);
  if (idx === -1) return null;

  const record = db.uploaded_files[idx];
  if (record.user_id !== userId) {
    throw Object.assign(new Error('Forbidden'), { status: 403, expose: true });
  }

  // Delete from storage
  if (record.storage_backend === 'local' && fs.existsSync(record.storage_path)) {
    fs.unlinkSync(record.storage_path);
  }

  db.uploaded_files.splice(idx, 1);
  saveDB();
  return record;
}

/**
 * List files for a user.
 */
function listFiles(userId) {
  return db.uploaded_files.filter(f => f.user_id === userId);
}

module.exports = {
  saveUpload,
  getFileRecord,
  getFileStream,
  deleteFile,
  listFiles,
  ALLOWED_TYPES,
  MAX_FILE_SIZE
};
