@echo off
call "C:\Program Files\Microsoft Visual Studio\18\Community\Common7\Tools\VsDevCmd.bat" -arch=amd64
set PATH=C:\Users\hsbaz\.cargo\bin;%PATH%
set VULKAN_SDK=C:\VulkanSDK\1.4.341.0
set PATH=%VULKAN_SDK%\Bin;%PATH%
set CARGO_TARGET_DIR=C:\t
set TAURI_SIGNING_PRIVATE_KEY_PASSWORD=

:: Read the private key from file
for /f "delims=" %%i in ('type "%USERPROFILE%\.tauri\leadrscribe.key"') do set "TAURI_SIGNING_PRIVATE_KEY=%%i"

cd /d C:\Users\hsbaz\leadrscribe
bun run tauri build
