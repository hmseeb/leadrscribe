# Import VS environment FIRST
$vsPath = "C:\Program Files\Microsoft Visual Studio\18\Community"
$devShell = "$vsPath\Common7\Tools\Microsoft.VisualStudio.DevShell.dll"
Import-Module $devShell
Enter-VsDevShell -VsInstallPath $vsPath -SkipAutomaticLocation -DevCmdArguments "-arch=amd64"

# Set all env vars AFTER VS dev shell (it may clear them)
$env:PATH = "C:\Users\hsbaz\.cargo\bin;" + $env:PATH
$env:VULKAN_SDK = "C:\VulkanSDK\1.4.341.0"
$env:PATH = "$env:VULKAN_SDK\Bin;" + $env:PATH
$env:CARGO_TARGET_DIR = "C:\t"

# Set signing key for updater - MUST be after Enter-VsDevShell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content "$env:USERPROFILE\.tauri\leadrscribe.key" -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""

Write-Host "TAURI_SIGNING_PRIVATE_KEY set: $($env:TAURI_SIGNING_PRIVATE_KEY.Substring(0, 20))..."
Write-Host "Key length: $($env:TAURI_SIGNING_PRIVATE_KEY.Length) chars"

# Build
Set-Location "C:\Users\hsbaz\leadrscribe"
& bun run tauri build
