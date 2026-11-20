import unittest

if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromName("pipeline.tests.test_aggregate")
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    raise SystemExit(0 if result.wasSuccessful() else 1)
