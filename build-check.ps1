$env:VULKAN_SDK = "C:\VulkanSDK\1.4.341.0"
$env:PATH = "C:\Users\hsbaz\.cargo\bin;C:\Program Files\LLVM\bin;C:\Program Files\Microsoft Visual Studio\18\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\Ninja;" + $env:PATH
$env:CMAKE_GENERATOR = "Ninja"

Set-Location C:\Users\hsbaz\leadrscribe
& "C:\Users\hsbaz\.cargo\bin\cargo.exe" check --manifest-path src-tauri/Cargo.toml
