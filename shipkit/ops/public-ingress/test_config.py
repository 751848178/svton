import json
import os
from pathlib import Path
import tempfile
import unittest
from ingress_config import config_dict, config_hash, parse_config, private_json
from test_fixture import CONFIG


class ConfigTests(unittest.TestCase):
    def test_config_strict_scope(self):
        raw = config_dict(CONFIG)
        self.assertEqual(parse_config(raw), CONFIG)
        self.assertEqual(len(config_hash(CONFIG)), 64)
        for patch in ({"version": True}, {"extra": "ignored"}, {"npmContainerId": "a" * 12}, {"npmNetworkId": "G" * 64},
                      {"npmAddress": "127.0.0.1"}, {"npmGateway": "0.0.0.0"}, {"npmGateway": "2001:db8::1"},
                      {"npmAddress": CONFIG.npm_gateway}, {"npmAddress": 1}):
            with self.assertRaises(ValueError):
                parse_config(dict(raw, **patch))

    def test_private_file_permission_symlink_duplicate_and_budget(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary).resolve()
            directory.chmod(0o700)
            file = directory / "config.json"
            file.write_text(json.dumps(config_dict(CONFIG)))
            file.chmod(0o600)
            self.assertEqual(parse_config(private_json(str(file), os.getuid())), CONFIG)
            file.chmod(0o644)
            with self.assertRaises(ValueError):
                private_json(str(file), os.getuid())
            file.chmod(0o600)
            directory.chmod(0o755)
            with self.assertRaises(ValueError):
                private_json(str(file), os.getuid())
            directory.chmod(0o700)
            link = directory / "link.json"
            link.symlink_to(file)
            with self.assertRaises(OSError):
                private_json(str(link), os.getuid())
            for content in ('{"version":1,"version":1}', " " * 4097):
                file.write_text(content)
                with self.assertRaises(ValueError):
                    private_json(str(file), os.getuid())


if __name__ == "__main__":
    unittest.main()
