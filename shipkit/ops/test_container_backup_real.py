"""Opt-in isolated local Docker proof; no published ports or existing services."""
import json
import os
import subprocess
import sys
import time
import unittest
import uuid
from pathlib import Path
import test_platform_ops as baseline
from platform_ops import backup, restore


@unittest.skipUnless(os.environ.get("SHIPKIT_OPS_DOCKER_IMAGE"), "Set an existing local image for isolated Docker proof")
class RealContainerBackup(unittest.TestCase):
    setUp = baseline.OfflineOperations.setUp
    tearDown = baseline.OfflineOperations.tearDown

    def test_running_owner_refuses_and_stopped_owner_backs_up_restores(self):
        name = "shipkit-ops-proof-" + uuid.uuid4().hex[:12]
        command = ["docker", "create", "--pull=never", "--name", name, "--network", "none",
            "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--user", "0:0",
            "--mount", f"type=bind,src={self.data},dst=/var/lib/shipkit", "--entrypoint", "sh",
            os.environ["SHIPKIT_OPS_DOCKER_IMAGE"], "-c",
            "readlink /proc/self/ns/pid > /var/lib/shipkit/pid.namespace; exec sleep 300"]
        identity = subprocess.check_output(command, stderr=subprocess.DEVNULL, timeout=30).decode().strip()
        try:
            subprocess.run(["docker", "start", identity], check=True, stdout=subprocess.DEVNULL, timeout=30)
            namespace = self.data / "pid.namespace"
            for _ in range(100):
                if namespace.exists() and namespace.stat().st_size:
                    break
                time.sleep(0.05)
            record = {"supervisorPid": 1, "apiPid": 18, "webPid": 19,
                "pidNamespace": namespace.read_text().strip(), "containerId": identity[:12],
                "containerDataRoot": "/var/lib/shipkit"}
            (self.data / "runtime.json").write_text(json.dumps(record))
            with self.assertRaisesRegex(ValueError, "running"):
                backup(self.data, self.output, identity)
            subprocess.run(["docker", "stop", "--time", "5", identity], check=True, stdout=subprocess.DEVNULL, timeout=15)
            subprocess.run([sys.executable, str(Path(__file__).with_name("platform_ops.py")), "backup",
                "--source", str(self.data), "--output", str(self.output), "--stopped-container", identity],
                check=True, stdout=subprocess.DEVNULL, timeout=30)
            destination = self.root / "restored"
            restore(self.output, destination)
            self.assertEqual((destination / self.log.relative_to(self.data)).read_bytes(), self.log.read_bytes())
            self.assertFalse((self.data / ".ops.lock").exists())
        finally:
            subprocess.run(["docker", "rm", "--force", identity], check=True, stdout=subprocess.DEVNULL, timeout=15)


if __name__ == "__main__":
    unittest.main()
