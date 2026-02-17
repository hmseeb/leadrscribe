@echo off
call "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat"
set PATH=C:\Users\hsbaz\.cargo\bin;C:\Program Files\LLVM\bin;%PATH%
set VULKAN_SDK=C:\VulkanSDK\1.4.341.0
cd /d C:\Users\hsbaz\leadrscribe
bun run tauri dev
