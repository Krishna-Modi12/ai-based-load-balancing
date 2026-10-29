"""Hybrid API/CLI experiment matrix runner.

Examples:
  python -m app.experiment_cli --policy round_robin --profile uniform
  python -m app.experiment_cli --matrix --duration 30 --warmup 5
"""
from __future__ import annotations

import argparse
import os
import time
from itertools import product

import httpx

POLICIES = ("round_robin", "least_connections", "ai_latency")
PROFILES = ("uniform", "heterogeneous", "bursty", "mixed")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run measured load-balancer experiments through the API.")
    parser.add_argument("--api-url", default=os.getenv("EXPERIMENT_API_URL", "http://localhost:8000"))
    parser.add_argument("--admin-token", default=os.getenv("ADMIN_TOKEN", "change-me"))
    parser.add_argument("--policy", choices=POLICIES)
    parser.add_argument("--profile", choices=PROFILES)
    parser.add_argument("--matrix", action="store_true", help="Run all three policies across all four profiles.")
    parser.add_argument("--duration", type=float, default=10)
    parser.add_argument("--warmup", type=float, default=2)
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--request-rate", type=float)
    parser.add_argument("--repetitions", type=int, default=3)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--scenario", choices=("none", "node_failure", "stale_telemetry", "missing_model", "timeout"), default="none")
    parser.add_argument("--wait", type=float, default=2, help="Polling interval in seconds.")
    return parser.parse_args()


def create_and_start(client: httpx.Client, args: argparse.Namespace, policy: str, profile: str, repetition: int) -> str:
    payload = {
        "name": f"phase7-{profile}-{policy}-r{repetition}",
        "policy": policy,
        "workload_profile": profile,
        "repetition": repetition,
        "scenario": args.scenario,
        "duration_seconds": args.duration,
        "warmup_seconds": args.warmup,
        "concurrency": args.concurrency,
        "request_rate": args.request_rate,
        "seed": args.seed + repetition - 1,
        "target_base_url": args.api_url.rstrip("/"),
        "request_timeout_seconds": max(10, args.wait * 5),
        "notes": "Created by backend.app.experiment_cli; raw observations retained by API.",
    }
    response = client.post("/api/v1/experiments", json=payload)
    response.raise_for_status()
    experiment_id = response.json()["id"]
    response = client.post(f"/api/v1/experiments/{experiment_id}/start", headers={"X-Admin-Token": args.admin_token})
    response.raise_for_status()
    return experiment_id


def wait_for_completion(client: httpx.Client, experiment_id: str, interval: float) -> dict:
    while True:
        response = client.get(f"/api/v1/experiments/{experiment_id}")
        response.raise_for_status()
        result = response.json()
        print(f"{experiment_id}: {result['status']}", flush=True)
        if result["status"] in {"completed", "failed", "cancelled"}:
            return result
        time.sleep(interval)


def main() -> int:
    args = parse_args()
    if not args.matrix and (not args.policy or not args.profile):
        raise SystemExit("Specify --policy and --profile, or use --matrix.")
    policies = POLICIES if args.matrix else (args.policy,)
    profiles = PROFILES if args.matrix else (args.profile,)
    with httpx.Client(base_url=args.api_url.rstrip("/"), timeout=30) as client:
        for policy, profile, repetition in product(policies, profiles, range(1, args.repetitions + 1)):
            experiment_id = create_and_start(client, args, policy, profile, repetition)
            result = wait_for_completion(client, experiment_id, args.wait)
            if result["status"] != "completed":
                print(f"{experiment_id}: {result['status']} (no benchmark claim made)", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
