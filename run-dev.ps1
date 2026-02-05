# Import VS environment
$vsPath = "C:\Program Files\Microsoft Visual Studio\18\Community"
$devShell = "$vsPath\Common7\Tools\Microsoft.VisualStudio.DevShell.dll"
Import-Module $devShell
Enter-VsDevShell -VsInstallPath $vsPath -SkipAutomaticLocation -DevCmdArguments "-arch=amd64"

# Restore cargo to PATH
$env:PATH = "C:\Users\hsbaz\.cargo\bin;" + $env:PATH

# Set Vulkan SDK
$env:VULKAN_SDK = "C:\VulkanSDK\1.4.341.0"
$env:PATH = "$env:VULKAN_SDK\Bin;" + $env:PATH

# Use shorter target directory
$env:CARGO_TARGET_DIR = "C:\t"

# Set location and run dev
Set-Location "C:\Users\hsbaz\leadrscribe"
& bun run tauri dev
