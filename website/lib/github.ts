const GITHUB_REPO = "hmseeb/leadrscribe";

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface Release {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
  assets: ReleaseAsset[];
}

export interface DownloadLinks {
  windows?: ReleaseAsset;
  macos?: ReleaseAsset;
  macosArm?: ReleaseAsset;
  linux?: ReleaseAsset;
  linuxDeb?: ReleaseAsset;
  version: string;
  releaseUrl: string;
}

export async function getLatestRelease(): Promise<DownloadLinks | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Failed to fetch release:", response.status);
      return null;
    }

    const release: Release = await response.json();
    const assets = release.assets;

    const findAsset = (patterns: string[]): ReleaseAsset | undefined => {
      return assets.find((asset) =>
        patterns.some((pattern) =>
          asset.name.toLowerCase().includes(pattern.toLowerCase())
        )
      );
    };

    return {
      windows: findAsset([".exe", "_x64-setup.exe", "_x64_en-US.msi"]),
      macos: findAsset(["_x64.dmg", "darwin-x86_64", "macos-x64"]),
      macosArm: findAsset(["_aarch64.dmg", "darwin-aarch64", "macos-arm64", "apple-silicon"]),
      linux: findAsset([".AppImage", "_amd64.AppImage"]),
      linuxDeb: findAsset([".deb", "_amd64.deb"]),
      version: release.tag_name,
      releaseUrl: release.html_url,
    };
  } catch (error) {
    console.error("Error fetching release:", error);
    return null;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
