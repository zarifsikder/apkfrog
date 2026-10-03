<?php
/**
 * ApkForge Persistent Storage API
 * =============================================================================
 *
 * Upload this file to your cPanel hosting (e.g. https://yourdomain.com/storage.php)
 * and create a writable directory next to it (e.g. `storage-data/`).
 *
 * This script exposes a simple HTTP API that the ApkForge Vercel app calls to
 * store and retrieve build source zips, APK artifacts, app release APKs, and
 * push notification images. Everything is persisted on your cPanel hosting —
 * Vercel's ephemeral /tmp is bypassed entirely.
 *
 * Authentication: every request must send the X-Storage-Key header with the
 * value of STORAGE_KEY below (or the env var CPANEL_STORAGE_KEY). Requests
 * without the correct key get 401.
 *
 * Endpoints
 * ---------
 * POST /storage.php?action=upload&path=<rel-path>
 *      Body: raw bytes (Content-Type: application/octet-stream)
 *      → 200 { ok:true, path, size }
 *      Stores a file at storage-data/<rel-path>. Creates parent dirs.
 *
 * GET  /storage.php?action=download&path=<rel-path>
 *      → 200 + raw bytes (Content-Type from extension)
 *      → 404 if not found
 *
 * HEAD /storage.php?action=download&path=<rel-path>
 *      → 200 (no body) if exists, 404 if not — for existence checks
 *
 * GET  /storage.php?action=exists&path=<rel-path>
 *      → 200 { ok:true, exists:true|false, size }
 *
 * DELETE /storage.php?action=delete&path=<rel-path>
 *      → 200 { ok:true, deleted:true }
 *      → 200 { ok:true, deleted:false } if not found (idempotent)
 *
 * POST /storage.php?action=delete-bulk
 *      Body: { paths: ["rel/path1","rel/path2",...] }
 *      → 200 { ok:true, deleted:N }
 *
 * GET  /storage.php?action=list&prefix=<optional>
 *      → 200 { ok:true, files:[{path,size,modified}], total }
 *
 * GET  /storage.php?action=health
 *      → 200 { ok:true, storage:"cpanel", version, bytesUsed, fileCount }
 *      No auth required — used by Vercel to verify connectivity.
 *
 * Safety
 * ------
 * • Paths are sanitised: only [A-Za-z0-9._-/] allowed. No `..`, no leading `/`.
 * • The script NEVER serves files outside storage-data/.
 * • 100 MB upload limit by default (adjustable via MAX_BYTES).
 * • All responses are JSON except the download endpoint which streams bytes.
 */

// ============================================================================
// Configuration — override via env vars or edit directly
// ============================================================================

// Secret key — set this to a long random string and put the SAME value in
// Vercel env var CPANEL_STORAGE_KEY
const STORAGE_KEY = 'REPLACE_WITH_A_LONG_RANDOM_SECRET_KEY';

// Directory where files will be stored. MUST be writable by the web server.
// On cPanel this is typically inside public_html/ or a sibling directory.
// To be safe, create a directory OUTSIDE public_html so it is not web-accessible
// directly — only this script can serve files from it.
const STORAGE_DIR = __DIR__ . '/storage-data';

// Max upload size (100 MB) — adjust if your cPanel PHP limits are lower
const MAX_BYTES = 100 * 1024 * 1024;

// App version — bump when changing the API contract
const VERSION = '1.0.0';

// ============================================================================
// Bootstrap
// ============================================================================
error_reporting(E_ERROR | E_PARSE);
ini_set('display_errors', '0');
ini_set('log_errors', '1');
header('X-Powered-By: ApkForge-Storage/1.0');

$action = isset($_GET['action']) ? $_GET['action'] : '';
$path = isset($_GET['path']) ? $_GET['path'] : '';

// Health check is unauthenticated so Vercel can probe connectivity
if ($action === 'health') {
    $bytesUsed = dir_size(STORAGE_DIR);
    $fileCount = dir_count(STORAGE_DIR);
    json_response(200, [
        'ok' => true,
        'storage' => 'cpanel',
        'version' => VERSION,
        'bytesUsed' => $bytesUsed,
        'fileCount' => $fileCount,
        'maxBytes' => MAX_BYTES,
    ]);
}

// All other actions require authentication
$providedKey = '';
if (isset($_SERVER['HTTP_X_STORAGE_KEY'])) {
    $providedKey = $_SERVER['HTTP_X_STORAGE_KEY'];
} elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) {
    // Bearer token form
    $auth = $_SERVER['HTTP_AUTHORIZATION'];
    if (preg_match('/^Bearer\s+(.+)$/i', $auth, $m)) {
        $providedKey = $m[1];
    }
}

$expectedKey = STORAGE_KEY;
if (getenv('CPANEL_STORAGE_KEY')) {
    $expectedKey = getenv('CPANEL_STORAGE_KEY');
}

if ($expectedKey === 'REPLACE_WITH_A_LONG_RANDOM_SECRET_KEY') {
    json_response(500, ['ok' => false, 'error' => 'Storage key not configured. Edit storage.php and set STORAGE_KEY, or set CPANEL_STORAGE_KEY env var.']);
}

if (!hash_equals($expectedKey, $providedKey)) {
    json_response(401, ['ok' => false, 'error' => 'Unauthorized — invalid or missing X-Storage-Key header.']);
}

// Make sure storage dir exists
if (!is_dir(STORAGE_DIR)) {
    @mkdir(STORAGE_DIR, 0750, true);
}

// ============================================================================
// Route
// ============================================================================
switch ($action) {
    case 'upload':
        handle_upload($path);
        break;
    case 'download':
        handle_download($path);
        break;
    case 'exists':
        handle_exists($path);
        break;
    case 'delete':
        handle_delete($path);
        break;
    case 'delete-bulk':
        handle_delete_bulk();
        break;
    case 'list':
        handle_list($path);
        break;
    default:
        json_response(400, ['ok' => false, 'error' => "Unknown action: {$action}"]);
}

// ============================================================================
// Handlers
// ============================================================================

function handle_upload(string $relPath): void {
    if (!$relPath) {
        json_response(400, ['ok' => false, 'error' => 'Missing path parameter']);
    }
    $safe = sanitize_path($relPath);
    if ($safe === null) {
        json_response(400, ['ok' => false, 'error' => 'Invalid path']);
    }

    // Read raw body
    $data = file_get_contents('php://input');
    if ($data === false || $data === '') {
        json_response(400, ['ok' => false, 'error' => 'Empty body']);
    }
    $size = strlen($data);
    if ($size > MAX_BYTES) {
        json_response(413, ['ok' => false, 'error' => "File too large: {$size} bytes (max " . MAX_BYTES . ")"]);
    }

    $fullPath = STORAGE_DIR . '/' . $safe;
    $dir = dirname($fullPath);
    if (!is_dir($dir)) {
        @mkdir($dir, 0750, true);
    }

    // Atomic write: write to temp file then rename
    $tmp = $fullPath . '.tmp.' . bin2hex(random_bytes(4));
    $written = file_put_contents($tmp, $data);
    if ($written === false || $written !== $size) {
        @unlink($tmp);
        json_response(500, ['ok' => false, 'error' => 'Failed to write file']);
    }
    if (!rename($tmp, $fullPath)) {
        @unlink($tmp);
        json_response(500, ['ok' => false, 'error' => 'Failed to move file into place']);
    }

    json_response(200, [
        'ok' => true,
        'path' => $safe,
        'size' => $size,
    ]);
}

function handle_download(string $relPath): void {
    if (!$relPath) {
        json_response(400, ['ok' => false, 'error' => 'Missing path parameter']);
    }
    $safe = sanitize_path($relPath);
    if ($safe === null) {
        json_response(400, ['ok' => false, 'error' => 'Invalid path']);
    }

    $fullPath = STORAGE_DIR . '/' . $safe;
    if (!is_file($fullPath)) {
        // HEAD requests just need the status code
        if ($_SERVER['REQUEST_METHOD'] === 'HEAD') {
            http_response_code(404);
            exit;
        }
        json_response(404, ['ok' => false, 'error' => 'File not found']);
    }

    $mime = guess_mime($safe);
    $size = filesize($fullPath);

    // HEAD request — just confirm existence
    if ($_SERVER['REQUEST_METHOD'] === 'HEAD') {
        http_response_code(200);
        header('Content-Type: ' . $mime);
        header('Content-Length: ' . $size);
        exit;
    }

    // Stream the file
    http_response_code(200);
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . $size);
    header('Content-Disposition: attachment; filename="' . basename($safe) . '"');
    header('Cache-Control: no-store');
    // Clear any output buffers so the file streams cleanly
    while (ob_get_level() > 0) ob_end_clean();
    readfile($fullPath);
    exit;
}

function handle_exists(string $relPath): void {
    if (!$relPath) {
        json_response(400, ['ok' => false, 'error' => 'Missing path parameter']);
    }
    $safe = sanitize_path($relPath);
    if ($safe === null) {
        json_response(200, ['ok' => true, 'exists' => false, 'size' => 0]);
    }
    $fullPath = STORAGE_DIR . '/' . $safe;
    $exists = is_file($fullPath);
    json_response(200, [
        'ok' => true,
        'exists' => $exists,
        'size' => $exists ? filesize($fullPath) : 0,
    ]);
}

function handle_delete(string $relPath): void {
    if (!$relPath) {
        json_response(400, ['ok' => false, 'error' => 'Missing path parameter']);
    }
    $safe = sanitize_path($relPath);
    if ($safe === null) {
        json_response(200, ['ok' => true, 'deleted' => false]);
    }
    $fullPath = STORAGE_DIR . '/' . $safe;
    if (!is_file($fullPath)) {
        json_response(200, ['ok' => true, 'deleted' => false]);
    }
    if (@unlink($fullPath)) {
        // Try to clean up empty parent dirs (best-effort)
        cleanup_empty_dirs(dirname($fullPath));
        json_response(200, ['ok' => true, 'deleted' => true]);
    } else {
        json_response(500, ['ok' => false, 'error' => 'Failed to delete file']);
    }
}

function handle_delete_bulk(): void {
    $body = file_get_contents('php://input');
    $data = json_decode($body, true);
    if (!is_array($data) || !isset($data['paths']) || !is_array($data['paths'])) {
        json_response(400, ['ok' => false, 'error' => 'Body must be { paths: [...] }']);
    }
    $deleted = 0;
    foreach ($data['paths'] as $p) {
        $safe = sanitize_path($p);
        if ($safe === null) continue;
        $fullPath = STORAGE_DIR . '/' . $safe;
        if (is_file($fullPath) && @unlink($fullPath)) {
            $deleted++;
            cleanup_empty_dirs(dirname($fullPath));
        }
    }
    json_response(200, ['ok' => true, 'deleted' => $deleted]);
}

function handle_list(string $prefix): void {
    $safePrefix = '';
    if ($prefix) {
        $safePrefix = sanitize_path($prefix);
        if ($safePrefix === null) $safePrefix = '';
    }
    $base = STORAGE_DIR . '/';
    $scanFrom = $base . $safePrefix;
    if (!is_dir($scanFrom)) {
        json_response(200, ['ok' => true, 'files' => [], 'total' => 0]);
    }
    $files = [];
    $iter = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($scanFrom, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );
    foreach ($iter as $f) {
        if (!$f->isFile()) continue;
        $rel = ltrim(substr($f->getPathname(), strlen($base)), '/');
        $files[] = [
            'path' => $rel,
            'size' => $f->getSize(),
            'modified' => $f->getMTime(),
        ];
    }
    json_response(200, ['ok' => true, 'files' => $files, 'total' => count($files)]);
}

// ============================================================================
// Helpers
// ============================================================================

function sanitize_path(string $p): ?string {
    // Trim + normalize slashes
    $p = trim($p);
    $p = str_replace('\\', '/', $p);
    // Strip leading slashes
    $p = ltrim($p, '/');
    // Block path traversal
    if (strpos($p, '..') !== false || strpos($p, "\0") !== false) {
        return null;
    }
    // Allow only [A-Za-z0-9._-/]
    if (!preg_match('#^[A-Za-z0-9._\-/]+$#', $p)) {
        return null;
    }
    // Block hidden files (starting with .)
    $segments = explode('/', $p);
    foreach ($segments as $s) {
        if ($s === '' || $s === '.' || $s[0] === '.') {
            return null;
        }
    }
    return $p;
}

function guess_mime(string $path): string {
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $map = [
        'zip' => 'application/zip',
        'apk' => 'application/vnd.android.package-archive',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'webp' => 'image/webp',
        'gif' => 'image/gif',
        'svg' => 'image/svg+xml',
        'json' => 'application/json',
        'txt' => 'text/plain',
        'html' => 'text/html',
        'css' => 'text/css',
        'js' => 'application/javascript',
    ];
    return $map[$ext] ?? 'application/octet-stream';
}

function json_response(int $status, array $body): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function dir_size(string $dir): int {
    if (!is_dir($dir)) return 0;
    $size = 0;
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS)) as $f) {
        if ($f->isFile()) $size += $f->getSize();
    }
    return $size;
}

function dir_count(string $dir): int {
    if (!is_dir($dir)) return 0;
    $count = 0;
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS)) as $f) {
        if ($f->isFile()) $count++;
    }
    return $count;
}

function cleanup_empty_dirs(string $dir): void {
    $base = realpath(STORAGE_DIR);
    if ($base === false) return;
    while (true) {
        $real = realpath($dir);
        if ($real === false || $real === $base || strpos($real, $base) !== 0) break;
        if (!is_dir($dir)) break;
        $entries = array_diff(scandir($dir), ['.', '..']);
        if (!empty($entries)) break;
        @rmdir($dir);
        $dir = dirname($dir);
    }
}
