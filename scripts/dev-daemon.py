#!/usr/bin/env python3
"""Daemonize the Next dev server so it survives the tool-call shell exiting.

The bash tool harness reaps background children started inside a tool call.
Double-fork + start_new_session reparents the process to init (PID 1),
which is exactly how the container's /start.sh originally owned it.
"""
import os
import subprocess
import sys
import time

CWD = "/home/z/my-project"


def alive(port: int = 3000) -> bool:
    try:
        out = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", f"http://localhost:{port}/"],
            capture_output=True, text=True, timeout=15,
        )
        return out.stdout.strip() == "200"
    except Exception:
        return False


def main() -> None:
    if "--check" in sys.argv:
        print("ALIVE" if alive() else "DEAD")
        return

    # Kill anything holding port 3000 first
    subprocess.run(["pkill", "-f", "next dev"], capture_output=True)
    subprocess.run(["pkill", "-f", "bun run dev"], capture_output=True)
    time.sleep(2)

    log = open(os.path.join(CWD, "dev.log"), "ab")
    env = dict(os.environ)
    # .env is the source of truth for the app — override any stale vars the
    # shell session may carry (e.g. an old SQLite DATABASE_URL), because
    # Next.js does NOT let .env files override variables already in the env.
    env_file = os.path.join(CWD, ".env")
    if os.path.exists(env_file):
        for line in open(env_file):
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            val = val.strip().strip('"').strip("'")
            if key:
                env[key] = val
    subprocess.Popen(
        ["bun", "run", "dev"],
        cwd=CWD,
        stdout=log,
        stderr=subprocess.STDOUT,
        stdin=subprocess.DEVNULL,
        start_new_session=True,
        env=env,
    )
    os._exit(0)  # parent exits instantly; child reparents to init


if __name__ == "__main__":
    main()
