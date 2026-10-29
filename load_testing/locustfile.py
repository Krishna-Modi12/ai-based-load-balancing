"""Run only against the local Compose stack: locust -f locustfile.py --host http://localhost:8000"""
from locust import HttpUser, between, task


class BalancedDemoUser(HttpUser):
    wait_time = between(0.02, 0.1)

    @task(6)
    def normal(self): self.client.get("/api/v1/route?request_class=normal", name="route/normal")

    @task(3)
    def light(self): self.client.get("/api/v1/route?request_class=light", name="route/light")

    @task(1)
    def heavy(self): self.client.get("/api/v1/route?request_class=heavy", name="route/heavy")
