"use client";

import { motion } from "framer-motion";
import {
  Keyboard,
  WifiOff,
  Cpu,
  Zap,
  Globe,
  Github,
  Monitor,
  Sparkles,
} from "lucide-react";
import { Card } from "./ui/Card";

const features = [
  {
    icon: Keyboard,
    title: "One Shortcut, Infinite Words",
    description:
      "Configure your perfect trigger. Hold to talk or toggle on/off.",
    color: "text-primary-400",
  },
  {
    icon: WifiOff,
    title: "Truly Offline",
    description:
      "No internet required. Ever. Your voice stays on your machine.",
    color: "text-cyan-400",
  },
  {
    icon: Cpu,
    title: "Multiple Engines",
    description:
      "Choose Whisper (GPU-accelerated) or Parakeet (CPU-friendly).",
    color: "text-violet-400",
  },
  {
    icon: Zap,
    title: "Voice Activity Detection",
    description:
      "Silero VAD filters silence automatically. Only transcribe what matters.",
    color: "text-accent-400",
  },
  {
    icon: Globe,
    title: "99+ Languages",
    description:
      "Automatic language detection. Speak in any language, get text.",
    color: "text-emerald-400",
  },
  {
    icon: Github,
    title: "Open Source",
    description: "MIT licensed. Read the code. Fork it. Extend it. Contribute.",
    color: "text-slate-300",
  },
  {
    icon: Monitor,
    title: "Cross-Platform",
    description:
      "Windows, macOS (Intel & Apple Silicon), Linux. Same great experience.",
    color: "text-blue-400",
  },
  {
    icon: Sparkles,
    title: "Debug Mode",
    description:
      "Developer-friendly. Press a shortcut to inspect what's happening under the hood.",
    color: "text-pink-400",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
};

export function Features() {
  return (
    <section id="features" className="py-24 relative">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-900/50 to-transparent" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-slate-100 mb-4">
            Everything You Need
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Powerful features that respect your privacy and work without the
            cloud
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {features.map((feature, index) => (
            <motion.div key={index} variants={itemVariants}>
              <Card className="h-full group">
                <div
                  className={`w-12 h-12 rounded-xl bg-slate-800/50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 ${feature.color}`}
                >
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-slate-100 mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
