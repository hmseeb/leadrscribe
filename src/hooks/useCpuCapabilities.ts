import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CpuCapabilities, CpuCapabilitiesSchema } from "../lib/types";

export function useCpuCapabilities() {
  const [cpuCapabilities, setCpuCapabilities] = useState<CpuCapabilities | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCpuCapabilities = async () => {
      try {
        const result = await invoke("get_cpu_capabilities");
        const parsed = CpuCapabilitiesSchema.parse(result);
        setCpuCapabilities(parsed);
      } catch (error) {
        console.error("Failed to fetch CPU capabilities:", error);
        // Default to not supporting Parakeet if detection fails
        setCpuCapabilities({
          has_avx: false,
          has_avx2: false,
          supports_parakeet: false,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchCpuCapabilities();
  }, []);

  return { cpuCapabilities, loading };
}
