"""GPU metrics collection via pynvml.

Provides real-time GPU utilization, memory, temperature, and power
monitoring. All functions are synchronous (pynvml is sync).
Can also be run as a standalone script for Tauri shell plugin.

All pynvml calls are wrapped in try/except -- GPU monitoring
must never crash the application.
"""

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class GpuInfo:
    """Static GPU device information."""

    index: int
    name: str
    memory_total_mb: int
    driver_version: str


def gpu_available() -> bool:
    """Quick check: is pynvml usable? Returns False on any exception."""
    try:
        import pynvml

        pynvml.nvmlInit()
        count = pynvml.nvmlDeviceGetCount()
        pynvml.nvmlShutdown()
        return count > 0
    except Exception:
        return False


def list_gpus() -> list[GpuInfo]:
    """Enumerate available GPUs. Returns empty list if no NVIDIA GPU or driver."""
    try:
        import pynvml

        pynvml.nvmlInit()
        count = pynvml.nvmlDeviceGetCount()
        driver = pynvml.nvmlSystemGetDriverVersion()

        gpus: list[GpuInfo] = []
        for i in range(count):
            handle = pynvml.nvmlDeviceGetHandleByIndex(i)
            name = pynvml.nvmlDeviceGetName(handle)
            mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)

            gpus.append(
                GpuInfo(
                    index=i,
                    name=name if isinstance(name, str) else name.decode("utf-8"),
                    memory_total_mb=mem_info.total // (1024 * 1024),
                    driver_version=(
                        driver if isinstance(driver, str) else driver.decode("utf-8")
                    ),
                )
            )

        pynvml.nvmlShutdown()
        return gpus

    except Exception as exc:
        logger.debug("Cannot enumerate GPUs: %s", exc)
        return []


def get_gpu_metrics(device_index: int = 0) -> dict:
    """Collect GPU metrics for real-time display.

    Returns dict with: name, gpu_utilization_pct, memory_used_mb,
    memory_total_mb, temperature_c, power_watts.

    If pynvml fails (no GPU, driver issue): returns dict with
    all zeros and name="unavailable".
    """
    fallback = {
        "name": "unavailable",
        "gpu_utilization_pct": 0.0,
        "memory_used_mb": 0,
        "memory_total_mb": 0,
        "temperature_c": 0,
        "power_watts": 0.0,
    }

    try:
        import pynvml

        pynvml.nvmlInit()
        handle = pynvml.nvmlDeviceGetHandleByIndex(device_index)

        name_raw = pynvml.nvmlDeviceGetName(handle)
        name = name_raw if isinstance(name_raw, str) else name_raw.decode("utf-8")

        utilization = pynvml.nvmlDeviceGetUtilizationRates(handle)
        mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
        temperature = pynvml.nvmlDeviceGetTemperature(
            handle, pynvml.NVML_TEMPERATURE_GPU
        )

        try:
            power_mw = pynvml.nvmlDeviceGetPowerUsage(handle)
            power_watts = power_mw / 1000.0
        except Exception:
            power_watts = 0.0

        pynvml.nvmlShutdown()

        return {
            "name": name,
            "gpu_utilization_pct": float(utilization.gpu),
            "memory_used_mb": int(mem_info.used // (1024 * 1024)),
            "memory_total_mb": int(mem_info.total // (1024 * 1024)),
            "temperature_c": int(temperature),
            "power_watts": round(power_watts, 1),
        }

    except Exception as exc:
        logger.debug("Cannot collect GPU metrics: %s", exc)
        return dict(fallback)


# ─── Standalone Script for Tauri Shell Plugin ─────────────────────────────────

if __name__ == "__main__":
    import json
    import sys
    import time

    device = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    interval = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0

    while True:
        metrics = get_gpu_metrics(device)
        print(json.dumps(metrics), flush=True)
        time.sleep(interval)
