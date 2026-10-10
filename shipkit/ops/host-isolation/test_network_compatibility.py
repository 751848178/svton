"""Docker host/none null IPAM is valid; populated malformed pools fail closed."""
import json
import unittest
from unittest.mock import patch
import network
from isolation_config import load_config


class NetworkCompatibilityTests(unittest.TestCase):
    def test_host_none_and_missing_ipam_have_no_subnets(self):
        for record in ({"Driver": "host", "IPAM": {"Config": None}},
                       {"Driver": "null", "IPAM": {"Config": None}},
                       {"Driver": "null", "IPAM": None}, {}, {"IPAM": {}}):
            with self.subTest(record=record):
                self.assertEqual([], list(network.configured_subnets(record)))

    def test_nonempty_invalid_ipam_or_subnet_is_not_treated_as_empty(self):
        for ipam in ([], {"Config": {}}, {"Config": "wrong"}, {"Config": [None]},
                     {"Config": [{}]}, {"Config": [{"Subnet": None}]},
                     {"Config": [{"Subnet": ""}]}, {"Config": [{"Subnet": "invalid:subnet"}]}):
            with self.subTest(ipam=ipam), self.assertRaises(ValueError):
                list(network.configured_subnets({"IPAM": ipam}))

    def mock_networks(self, records):
        def run(*args):
            if args[:3] == ("docker", "network", "ls"):
                return "host\nnone\nbridge\n"
            if args[:3] == ("docker", "network", "inspect"):
                return json.dumps(records)
            if args[:5] == ("ip", "-j", "-4", "route", "show"):
                return "[]"
            if args[:4] == ("ip", "-o", "link", "show"):
                return ""
            self.fail("Unexpected mutation: " + repr(args))
        return patch("network.run", side_effect=run)

    def test_conflict_preflight_accepts_real_host_none_null_and_valid_bridge(self):
        records = [{"Driver": "host", "IPAM": {"Config": None}},
                   {"Driver": "null", "IPAM": {"Config": None}},
                   {"Driver": "bridge", "IPAM": {"Config": [{"Subnet": "172.18.0.0/16"}]}},
                   {"IPAM": {"Config": [{"Subnet": "fd00::/64"}]}}]
        with self.mock_networks(records):
            network.reject_conflicts(load_config({}))

    def test_null_pools_do_not_hide_an_overlapping_other_network(self):
        records = [{"Driver": "null", "IPAM": {"Config": None}},
                   {"IPAM": {"Config": [{"Subnet": "172.30.241.0/28"}]}}]
        with self.mock_networks(records), self.assertRaisesRegex(ValueError, "overlaps"):
            network.reject_conflicts(load_config({}))

    def test_invalid_pool_rejects_before_network_create_or_receipt_mutation(self):
        with self.mock_networks([{"IPAM": {"Config": [None]}}]) as run, \
                patch("network.read_receipt", return_value=None), patch("network.freeze_receipt") as freeze:
            # The desired network is absent from the mock listing.
            with self.assertRaisesRegex(ValueError, "invalid subnet"):
                network.ensure_network(load_config({}), create=True)
            freeze.assert_not_called()
            self.assertFalse(any(call[0][:3] == ("docker", "network", "create") for call in run.call_args_list))


if __name__ == "__main__":
    unittest.main()
