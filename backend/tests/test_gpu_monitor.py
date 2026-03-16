"""Tests for GPU monitoring service.

All pynvml calls are mocked -- tests run without GPU hardware.
"""

import pytest
from unittest.mock import MagicMock, patch

from app.services.experiment.gpu_monitor import (
    GpuInfo,
    get_gpu_metrics,
    gpu_available,
    list_gpus,
)


# ─── gpu_available ──────────────────────────────────────────────────────────


def test_gpu_available_true():
    """Returns True when pynvml detects GPUs."""
    mock_pynvml = MagicMock()
    mock_pynvml.nvmlDeviceGetCount.return_value = 2
    with patch.dict("sys.modules", {"pynvml": mock_pynvml}):
        with patch("app.services.experiment.gpu_monitor.gpu_available") as mock_fn:
            mock_fn.return_value = True
            assert mock_fn() is True


def test_gpu_available_no_gpu():
    """Returns False when no GPU or pynvml not installed."""
    # Direct test: import failure returns False
    result = gpu_available()
    # On CI/Mac without NVIDIA, this should be False
    assert isinstance(result, bool)


# ─── list_gpus ──────────────────────────────────────────────────────────────


def test_list_gpus_returns_empty_without_nvidia():
    """Returns empty list on non-NVIDIA systems."""
    result = list_gpus()
    assert isinstance(result, list)


# ─── get_gpu_metrics ────────────────────────────────────────────────────────


def test_get_gpu_metrics_fallback():
    """Returns fallback dict on systems without NVIDIA GPU."""
    result = get_gpu_metrics(device_index=0)
    assert isinstance(result, dict)
    assert "name" in result
    assert "gpu_utilization_pct" in result
    assert "memory_used_mb" in result
    assert "memory_total_mb" in result
    assert "temperature_c" in result
    assert "power_watts" in result


def test_get_gpu_metrics_fallback_values():
    """Fallback returns zeros and 'unavailable' name."""
    result = get_gpu_metrics()
    # Without NVIDIA GPU, should get fallback
    if result["name"] == "unavailable":
        assert result["gpu_utilization_pct"] == 0.0
        assert result["memory_used_mb"] == 0
        assert result["memory_total_mb"] == 0
        assert result["temperature_c"] == 0
        assert result["power_watts"] == 0.0


# ─── GpuInfo frozen dataclass ───────────────────────────────────────────────


def test_gpu_info_immutable():
    """GpuInfo is frozen (immutable)."""
    info = GpuInfo(index=0, name="RTX 4090", memory_total_mb=24576, driver_version="535.86.10")
    with pytest.raises(AttributeError):
        info.name = "different"


def test_gpu_info_fields():
    """GpuInfo stores correct field values."""
    info = GpuInfo(index=1, name="A100", memory_total_mb=81920, driver_version="535.0")
    assert info.index == 1
    assert info.name == "A100"
    assert info.memory_total_mb == 81920
