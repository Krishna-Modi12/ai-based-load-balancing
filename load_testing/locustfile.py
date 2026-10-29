"""Bounded local scenarios.

Run, for example:
``locust -f load_testing/locustfile.py --headless -u 4 -t 30s --host http://localhost:8000``
Set ``WORKLOAD_PROFILE`` to uniform, heterogeneous, bursty, or mixed.
"""
import os
import random

from locust import HttpUser, between, task


class BalancedDemoUser(HttpUser):
    wait_time = between(0.02, 0.1)
    profile = os.getenv("WORKLOAD_PROFILE", "mixed")
    rng = random.Random(int(os.getenv("WORKLOAD_SEED", "42")))

    def _request_class(self) -> str:
        if self.profile == "uniform":
            return "normal"
        if self.profile == "heterogeneous":
            return self.rng.choices(["light", "normal", "heavy"], weights=[1, 2, 1])[0]
        if self.profile == "bursty":
            return "normal"
        return self.rng.choices(["light", "normal", "heavy"], weights=[1, 3, 1])[0]

    @task
    def route(self):
        request_class = self._request_class()
        self.client.get(f"/api/v1/route?request_class={request_class}", name=f"route/{request_class}")
