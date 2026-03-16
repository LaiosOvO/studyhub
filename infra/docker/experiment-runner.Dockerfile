# Base image for StudyHub experiment execution containers.
#
# Provides CUDA runtime, Python 3.12, and common ML libraries.
# Users can add project-specific deps via requirements.txt in workspace.
#
# Reference: autoresearch Docker execution pattern.

FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04

LABEL com.studyhub.type="experiment-runner"

# Prevent interactive prompts during package install
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install Python 3.12 and essentials
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.12 \
    python3.12-venv \
    python3-pip \
    git \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Make python3.12 the default python
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.12 1 \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.12 1

# Install common ML libraries as defaults
RUN pip install --no-cache-dir --break-system-packages \
    torch \
    numpy \
    pandas \
    scikit-learn \
    matplotlib \
    tqdm

WORKDIR /workspace

# Default: run the training script
CMD ["python", "train.py"]
