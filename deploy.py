import os
import sys
import subprocess
import paramiko

# Ensure UTF-8 output encoding
if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

HOST = os.getenv("VPS_HOST", "45.142.30.136")
USER = os.getenv("VPS_USER", "root")
PASS = os.getenv("VPS_PASS", "gYV2a5vtI1MLNEFH")
LOCAL_DIR = os.path.dirname(os.path.abspath(__file__))
REMOTE_DIR = "/var/www/fury-telemetry-gateway"

print("====================================================")
print("🚀 FURY-TELEMETRY-GATEWAY VPS DEPLOYMENT PIPELINE")
print("====================================================\n")

# STEP 1: Local Pre-Flight Diagnostic
print("[>] Running local Antigravity Pre-Flight Diagnostic...")
preflight_proc = subprocess.run(
    ['node', 'src/antigravity_preflight.js'],
    cwd=LOCAL_DIR,
    shell=True
)

if preflight_proc.returncode != 0:
    print("\n❌ [HALTED] Local Antigravity Pre-Flight Diagnostic Failed!")
    print("[-] ABORTING REMOTE VPS DEPLOYMENT. Fail-fast gatekeeper triggered.")
    sys.exit(1)

print("\n✅ Local Antigravity Pre-Flight Diagnostic Passed!")

# STEP 2: Connect via SSH
print(f"[+] Connecting to VPS SSH {USER}@{HOST}...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect(HOST, port=22, username=USER, password=PASS, timeout=30)
    print("[+] SSH Connection Successful!")
except Exception as e:
    print(f"[-] SSH Connection failed: {e}")
    sys.exit(1)

def run_cmd(cmd, ignore_error=False):
    print(f"[>] Remote Exec: {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='ignore')
    err = stderr.read().decode('utf-8', errors='ignore')
    if out:
        print(out.strip())
    if err and not ignore_error:
        print(f"[!] Stderr: {err.strip()}")
    return out

# STEP 3: Create Remote Directory
run_cmd(f"mkdir -p {REMOTE_DIR}/src {REMOTE_DIR}/data")

# STEP 4: Upload Application Files via SFTP
print("\n[+] Uploading microservice payload via SFTP...")
sftp = ssh.open_sftp()

files_to_upload = [
    "package.json",
    "package-lock.json",
    "README.md",
    ".env.example",
    "src/index.js",
    "src/database.js",
    "src/crypto.js",
    "src/seed.js",
    "src/aggregator.js",
    "src/scheduler.js",
    "src/telegramRouter.js",
    "src/antigravity_preflight.js"
]

for fname in files_to_upload:
    local_path = os.path.join(LOCAL_DIR, fname)
    remote_path = f"{REMOTE_DIR}/{fname}"
    if os.path.exists(local_path):
        sftp.put(local_path, remote_path)
        print(f"  [✓] Uploaded {fname}")

sftp.close()

# STEP 5: Remote Antigravity Pre-Flight & PM2 Reload
print("\n[+] Executing remote Antigravity Pre-Flight Diagnostic on VPS...")
remote_diagnostic = run_cmd(f"cd {REMOTE_DIR} && npm install --production && node src/antigravity_preflight.js", ignore_error=True)

if "SYSTEM_LIVE_COMMITTED" not in remote_diagnostic and "SYSTEM_LIVE_COMMITTED" not in remote_diagnostic:
    print("\n❌ [HALTED] Remote Antigravity Pre-Flight Failed on VPS.")
    print("[-] Aborting PM2 process commit.")
    ssh.close()
    sys.exit(1)

print("\n[+] Committing PM2 process reload on VPS...")
run_cmd(f"cd {REMOTE_DIR} && pm2 reload fury-telemetry-gateway 2>/dev/null || pm2 start src/index.js --name 'fury-telemetry-gateway'", ignore_error=True)
run_cmd("pm2 save")

print("\n====================================================")
print("✅ FURY-Telemetry-Gateway VPS Deployment Completed!")
print("====================================================")

ssh.close()
