param(
    [string]$EnvironmentPath = (Join-Path $env:LOCALAPPDATA 'MonoDemucs'),
    [ValidateSet('cpu', 'cu124')][string]$Compute = 'cpu'
)

$ErrorActionPreference = 'Stop'
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    throw 'Please install uv first: winget install astral-sh.uv'
}

$EnvironmentPath = [IO.Path]::GetFullPath($EnvironmentPath)
$pythonExe = Join-Path $EnvironmentPath 'Scripts/python.exe'
if (-not (Test-Path -LiteralPath $pythonExe)) {
    & uv venv --python 3.12 $EnvironmentPath
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the Python environment.' }
}
& uv pip install --python $pythonExe "torch==2.5.1+$Compute" "torchaudio==2.5.1+$Compute" --index-url "https://download.pytorch.org/whl/$Compute"
if ($LASTEXITCODE -ne 0) { throw 'Could not install PyTorch.' }
& uv pip install --python $pythonExe -r (Join-Path $PSScriptRoot 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Could not install Demucs.' }
& $pythonExe -I (Join-Path $PSScriptRoot 'check_environment.py')
if ($LASTEXITCODE -ne 0) { throw 'The separation environment did not pass its import check.' }
if ($Compute -eq 'cu124') {
    & $pythonExe -I (Join-Path $PSScriptRoot 'check_cuda.py')
    if ($LASTEXITCODE -ne 0) { throw 'CUDA verification failed. Check the NVIDIA driver and GPU environment.' }
}
Write-Output 'Ready. Open the separation tool in Mono to use this environment:'
Write-Output $pythonExe
Write-Output 'Mono can detect this environment automatically. The model downloads on the first separation.'
