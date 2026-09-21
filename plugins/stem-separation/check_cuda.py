"""Verify the requested GPU environment can execute CUDA operations."""
import torch

if not torch.cuda.is_available():
    raise RuntimeError(f"CUDA is unavailable in PyTorch {torch.__version__}")
value = torch.ones(1, device="cuda") * 2
torch.cuda.synchronize()
assert value.item() == 2
print("CUDA ready:", torch.cuda.get_device_name(0))
