@echo off
call "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat"
set PATH=C:\Users\hsbaz\.cargo\bin;C:\Program Files\LLVM\bin;C:\Program Files\Microsoft Visual Studio\18\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\Ninja;%PATH%
set VULKAN_SDK=C:\VulkanSDK\1.4.341.0
set CMAKE_GENERATOR=Ninja
cd /d C:\Users\hsbaz\leadrscribe\src-tauri
cargo update -p whisper-rs-sys
cargo update -p whisper-rs
