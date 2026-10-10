import copy
import unittest
from container_boundary import verify_containers
from test_fixture import CONFIG, FakeCommands


class BoundaryTests(unittest.TestCase):
    def test_projection_only_success_is_readonly(self):
        commands = FakeCommands()
        self.assertEqual(verify_containers(CONFIG, commands), {"npmId": CONFIG.npm_id, "serverId": "c" * 64})
        self.assertEqual(commands.mutations(), [])
        for command in commands.calls:
            self.assertTrue("inspect" in command)
            self.assertFalse(any("Env" in arg or "Cmd" in arg or "Mount" in arg for arg in command))

    def test_npm_immutable_identity_address_and_network_drift_reject(self):
        for patch in ({"id": "d" * 64}, {"running": False}, {"paused": True}, {"restarting": True},
                      {"networks": {}}, {"networks": {"bridge": {}, "other": {}}}):
            commands = FakeCommands()
            commands.npm.update(patch)
            with self.assertRaises(ValueError):
                verify_containers(CONFIG, commands)
            self.assertEqual(commands.mutations(), [])
        for key, value in (("NetworkID", "d" * 64), ("IPAddress", "10.40.0.3"), ("Gateway", "10.40.0.9"), ("IPPrefixLen", True)):
            commands = FakeCommands()
            commands.npm["networks"]["bridge"][key] = value
            with self.assertRaises(ValueError):
                verify_containers(CONFIG, commands)

    def test_bridge_device_pool_and_scope_reject(self):
        for patch in ({"id": "d" * 64}, {"driver": "host"}, {"options": {}}, {"pools": []},
                      {"pools": [{"Subnet": "10.50.0.0/16", "Gateway": CONFIG.npm_gateway}]}):
            commands = FakeCommands()
            commands.bridge.update(patch)
            with self.assertRaises(ValueError):
                verify_containers(CONFIG, commands)

    def test_unhealthy_server_public_binding_extra_network_and_foreign_project_reject(self):
        for patch in ({"running": False}, {"health": "unhealthy"}, {"paused": True}, {"restarting": True},
                      {"ports": {"8769/tcp": [{"HostIp": "0.0.0.0", "HostPort": "28769"}]}},
                      {"networks": {"shipkit-control": {}, "bridge": {}}}, {"project": "foreign"}, {"service": "other"}):
            commands = FakeCommands()
            commands.server.update(copy.deepcopy(patch))
            with self.assertRaises(ValueError):
                verify_containers(CONFIG, commands)
            self.assertEqual(commands.mutations(), [])


if __name__ == "__main__":
    unittest.main()
