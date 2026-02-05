import { Hero } from "@/components/Hero";
import { Features } from "@/components/Features";
import { HowItWorks } from "@/components/HowItWorks";
import { Download } from "@/components/Download";
import { Footer } from "@/components/Footer";
import { getLatestRelease } from "@/lib/github";

export const revalidate = 3600; // Revalidate every hour

export default async function Home() {
  const downloadLinks = await getLatestRelease();

  return (
    <main className="min-h-screen bg-slate-950 relative overflow-hidden noise">
      {/* Fixed navigation (optional - can add later) */}

      <Hero />
      <Features />
      <HowItWorks />
      <Download downloadLinks={downloadLinks} />
      <Footer />
    </main>
  );
}
