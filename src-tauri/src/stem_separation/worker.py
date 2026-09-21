"""Host-owned Demucs runner. Stdout contains only newline-delimited JSON events."""
import contextlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys


def emit(stage, **fields):
    print(json.dumps({"stage": stage, **fields}, ensure_ascii=False), flush=True)


class ProgressStream:
    """Demucs 4.0.1 reports inference progress through tqdm on stderr."""
    def __init__(self, stream):
        self.stream = stream
        self.last = -1

    def write(self, text):
        self.stream.write(text)
        match = re.search(r"(\d{1,3})%\|", text)
        if match:
            percent = min(100, int(match[1]))
            if percent != self.last:
                self.last = percent
                emit("separating", progress=percent)

    def flush(self):
        self.stream.flush()

    def isatty(self):
        return False


cached_model = None
cached_model_key = None


def run(request):
    global cached_model, cached_model_key
    os.environ["TORCH_HOME"] = request["cacheDir"]
    # Imports and third-party messages must never corrupt the JSON protocol.
    with contextlib.redirect_stdout(sys.stderr):
        import torch
        import soundfile as sf
        from demucs.apply import apply_model
        from demucs.pretrained import get_model
        import numpy as np

    device = request["device"]
    if device == "auto":
        device = "cuda" if torch.cuda.is_available() else (
            "mps" if torch.backends.mps.is_available() else "cpu"
        )
    if device == "cuda" and not torch.cuda.is_available():
        raise RuntimeError("当前分离环境不支持 NVIDIA GPU，请在插件设置中选择 CPU 或安装 CUDA 版 PyTorch。")
    if device == "mps" and not torch.backends.mps.is_available():
        raise RuntimeError("当前分离环境不支持 Apple MPS，请在插件设置中选择 CPU。")
    model_key = (request["cacheDir"], request["model"], device)
    if cached_model is None or cached_model_key != model_key:
        emit("loading", device=device)
    with contextlib.redirect_stdout(sys.stderr):
        if cached_model is None or cached_model_key != model_key:
            cached_model = get_model(request["model"])
            cached_model.eval()
            cached_model.to(device)
            cached_model_key = model_key
        model = cached_model
        try:
            import imageio_ffmpeg
            ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        except ImportError:
            ffmpeg = shutil.which("ffmpeg")
        if not ffmpeg:
            raise RuntimeError("缺少音频组件，请点击「一键准备」自动修复。")
        decoded = subprocess.run(
            [ffmpeg, "-nostdin", "-v", "error", "-i", request["source"],
             "-f", "f32le", "-ac", str(model.audio_channels), "-ar", str(model.samplerate), "pipe:1"],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            creationflags=0x08000000 if os.name == "nt" else 0,
        )
        if decoded.returncode:
            raise RuntimeError("无法读取音乐文件：" + decoded.stderr.decode("utf-8", errors="replace")[-2000:])
        samples = np.frombuffer(decoded.stdout, dtype="<f4").reshape(-1, model.audio_channels).T.copy()
        wav = torch.from_numpy(samples)
    if wav.numel() == 0 or not torch.isfinite(wav).all():
        raise RuntimeError("音频为空或包含无效采样。")
    reference = wav.mean(0)
    mean = reference.mean()
    scale = reference.std().clamp_min(1e-8)
    emit("separating", progress=0, device=device)
    with contextlib.redirect_stderr(ProgressStream(sys.stderr)), torch.no_grad():
        sources = apply_model(
            model, ((wav - mean) / scale)[None], device=device,
            shifts=1, split=True, overlap=0.25, progress=True, num_workers=0,
        )[0].cpu()
    sources = sources * scale + mean
    vocal_index = model.sources.index("vocals")
    vocals = sources[vocal_index]
    accompaniment = sum(sources[i] for i in range(len(model.sources)) if i != vocal_index)
    # Share one gain so the exported pair keeps the original relative balance.
    peak = max(1.0, vocals.abs().max().item(), accompaniment.abs().max().item())
    emit("exporting", device=device)
    output = Path(request["outputDir"])
    for name, audio in (("vocals", vocals), ("accompaniment", accompaniment)):
        sf.write(str(output / f"{name}.wav"), (audio / peak).t().numpy(), model.samplerate, subtype="PCM_16")
    emit("done", progress=100, device=device)


def process_request(request):
    try:
        run(request)
        return True
    except ImportError as error:
        emit("error", message=f"分离环境缺少组件：{error}。请点击「一键准备」自动修复。")
        return False
    except Exception as error:
        emit("error", message=str(error))
        return False


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    if sys.argv[1] == "--persistent":
        for line in sys.stdin:
            process_request(json.loads(line))
    else:
        sys.exit(0 if process_request(json.loads(sys.argv[1])) else 1)
