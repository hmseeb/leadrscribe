@echo off
call "C:\Program Files\Microsoft Visual Studio\18\Community\Common7\Tools\VsDevCmd.bat" -arch=amd64
set VULKAN_SDK=C:\VulkanSDK\1.4.341.0
cd /d C:\Users\hsbaz\leadrscribe
cargo check --manifest-path src-tauri/Cargo.toml
