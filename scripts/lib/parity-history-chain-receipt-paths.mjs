import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";

export function validateOwnedHistoryPaths(receipt, expectedRunRoot) {
  requireValue(isAbsolute(receipt.canonicalRunRoot), "run-root-relative");
  if (expectedRunRoot === undefined) {
    requireValue(
      receipt.canonicalTempRoot === realpathSync(tmpdir()),
      "temp-root-mismatch",
    );
  } else {
    requireValue(
      isAbsolute(expectedRunRoot) &&
        resolve(expectedRunRoot) === expectedRunRoot &&
        realpathSync(expectedRunRoot) === expectedRunRoot &&
        receipt.canonicalRunRoot === expectedRunRoot,
      "expected-run-root-mismatch",
    );
    requireValue(
      realpathSync(receipt.canonicalTempRoot) === receipt.canonicalTempRoot,
      "parent-root-not-canonical",
    );
  }
  requireValue(
    dirname(receipt.canonicalRunRoot) === receipt.canonicalTempRoot,
    "run-root-not-direct-child",
  );
  requireValue(
    basename(receipt.canonicalRunRoot) === receipt.runId,
    "run-id-mismatch",
  );
  requireValue(
    receipt.f455.path ===
      join(receipt.canonicalRunRoot, "f455", "f455-positive-e2e-evidence.json"),
    "f455-path",
  );
  requireValue(
    receipt.f456.path ===
      join(
        receipt.canonicalRunRoot,
        "f456",
        "f456-version-history-evidence.json",
      ),
    "f456-path",
  );
  requireValue(
    !relative(receipt.canonicalRunRoot, receipt.f456.path).startsWith(".."),
    "path-outside-root",
  );
}

function requireValue(value, reason) {
  if (!value) throw new Error(`F537_HISTORY_RECEIPT_INVALID: ${reason}`);
}
