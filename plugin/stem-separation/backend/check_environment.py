"""Check dependencies; optionally prepare the model in the supplied cache."""
import os
import shutil
import subprocess
import sys
import torch
import soundfile
from demucs.pretrained import get_model

try:
    import imageio_ffmpeg
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
except ImportError:
    ffmpeg = shutil.which("ffmpeg")
if not ffmpeg:
    raise RuntimeError("Audio decoder is missing")
subprocess.run([ffmpeg, "-version"], check=True, stdout=subprocess.DEVNULL,
               stderr=subprocess.DEVNULL, creationflags=0x08000000 if os.name == "nt" else 0)
if len(sys.argv) > 1:
    os.environ["TORCH_HOME"] = sys.argv[1]
    get_model("htdemucs_6s")

print("Demucs ready; CUDA:", torch.cuda.is_available())
