import json, base64, zipfile, io, subprocess

# Get project files
result = subprocess.run([
    'curl', '-s', '-b', '/tmp/admin-cookies.txt',
    'http://localhost:3000/api/projects/cmue3wimh0005qta8lbsmzcll/files'
], capture_output=True, text=True)

data = json.loads(result.stdout)
files = data.get('files', [])
print(f"Found {len(files)} files")

# Create ZIP
zip_buffer = io.BytesIO()
with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
    for f in files:
        zf.writestr(f['path'], f['content'])
        print(f"  Added: {f['path']} ({len(f['content'])} chars)")

zip_data = zip_buffer.getvalue()
b64 = base64.b64encode(zip_data).decode('utf-8')
print(f"ZIP size: {len(zip_data)} bytes")

# Save the base64 data URL
with open('/tmp/kotlin_zip.b64', 'w') as out:
    out.write(f'data:application/zip;base64,{b64}')
print("Saved to /tmp/kotlin_zip.b64")
