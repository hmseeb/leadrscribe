import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Features } from "@/components/Features";
import { HowItWorks } from "@/components/HowItWorks";
import { Download } from "@/components/Download";
import { Footer } from "@/components/Footer";
import { getLatestRelease } from "@/lib/github";

export const revalidate = 300; // Revalidate every 5 minutes

export default async function Home() {
  let downloadLinks = null;
  try {
    downloadLinks = await getLatestRelease();
  } catch (error) {
    console.error("Failed to fetch releases:", error);
  }

  return (
    <main className="min-h-screen bg-slate-950 relative overflow-hidden">
      <Header />
      <Hero />
      <Features />
      <HowItWorks />
      <Download downloadLinks={downloadLinks} />
      <Footer />
    </main>
  );
}
