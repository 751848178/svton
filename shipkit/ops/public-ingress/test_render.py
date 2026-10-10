import ast
import configparser
from pathlib import Path
import unittest
from render_candidate import render_units
from test_fixture import CONFIG


class RenderTests(unittest.TestCase):
    def test_parameterized_units_parse_with_guard_first_and_no_restart_cascade(self):
        units = render_units(CONFIG)
        self.assertEqual(len(units), 3)
        parsed = {}
        for name, text in units.items():
            parser = configparser.ConfigParser(interpolation=None)
            parser.read_string(text)
            parsed[name] = parser
            self.assertNotIn("PartOf", text)
            self.assertNotIn("ExecStop", text)
            self.assertNotIn("@", text)
        socket = parsed["shipkit-public-ingress.socket"]
        self.assertEqual(socket["Socket"]["ListenStream"], CONFIG.npm_gateway + ":28770")
        self.assertEqual(socket["Socket"]["BindToDevice"], "docker0")
        self.assertIn("shipkit-public-ingress-guard.service", socket["Unit"]["Requires"])
        relay = parsed["shipkit-public-ingress.service"]["Service"]
        self.assertEqual(relay["User"], "nobody")
        self.assertEqual(relay["NoNewPrivileges"], "yes")
        self.assertEqual(relay["CapabilityBoundingSet"], "")
        self.assertIn("+/usr/bin/python3 -E -s", relay["ExecStartPre"])
        self.assertEqual(relay["ExecStart"], "/usr/lib/systemd/systemd-socket-proxyd 127.0.0.1:28769")
        guard = parsed["shipkit-public-ingress-guard.service"]["Service"]
        self.assertIn("/usr/bin/python3 -E -s", guard["ExecStart"])
        self.assertEqual(guard["Environment"], "PATH=/usr/sbin:/usr/bin:/sbin:/bin")

    def test_runtime_sources_are_python36_and_bounded(self):
        directory = Path(__file__).parent
        for name in ("ingress_config.py", "commands.py", "container_boundary.py", "firewall.py", "guard.py", "render_candidate.py"):
            text = (directory / name).read_text()
            ast.parse(text, feature_version=(3, 6))
            self.assertLessEqual(len(text.splitlines()), 200, name)


if __name__ == "__main__":
    unittest.main()
