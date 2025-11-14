/// CPU feature detection for runtime capability checks
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct CpuCapabilities {
    pub has_avx: bool,
    pub has_avx2: bool,
    pub supports_parakeet: bool,
}

/// Check if the CPU supports the required features for Parakeet models
///
/// Parakeet models use ONNX Runtime compiled with AVX/AVX2 instructions.
/// On CPUs without these features, the process will crash with STATUS_ILLEGAL_INSTRUCTION.
pub fn check_cpu_capabilities() -> CpuCapabilities {
    #[cfg(target_arch = "x86_64")]
    {
        let has_avx = is_x86_feature_detected!("avx");
        let has_avx2 = is_x86_feature_detected!("avx2");
        let supports_parakeet = has_avx && has_avx2;

        CpuCapabilities {
            has_avx,
            has_avx2,
            supports_parakeet,
        }
    }

    #[cfg(not(target_arch = "x86_64"))]
    {
        // Non-x86_64 architectures: assume no support for now
        // (ONNX Runtime binaries are x86_64-specific anyway)
        CpuCapabilities {
            has_avx: false,
            has_avx2: false,
            supports_parakeet: false,
        }
    }
}

/// Check if Parakeet models can be loaded on this CPU
pub fn supports_parakeet() -> bool {
    check_cpu_capabilities().supports_parakeet
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cpu_detection() {
        let caps = check_cpu_capabilities();
        // Just verify it doesn't panic - actual values depend on hardware
        println!("CPU Capabilities: {:?}", caps);
    }
}
