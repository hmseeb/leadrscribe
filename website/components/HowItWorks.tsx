"use client";

import { motion } from "framer-motion";
import { Settings, Mic, Type, Check } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Settings,
    title: "Configure Your Shortcut",
    description:
      "Set your preferred key combo. Ctrl+Space, Cmd+Shift+D, whatever works for you.",
    color: "from-primary-500 to-cyan-500",
  },
  {
    number: "02",
    icon: Mic,
    title: "Press & Speak",
    description:
      "Hold your shortcut and talk naturally. The app captures your audio locally.",
    color: "from-cyan-500 to-violet-500",
  },
  {
    number: "03",
    icon: Type,
    title: "Text Appears",
    description:
      "Your words are transcribed by local AI models and typed wherever your cursor is.",
    color: "from-violet-500 to-accent-500",
  },
  {
    number: "04",
    icon: Check,
    title: "That's It",
    description:
      "No account. No login. No cloud. Just transcription that works.",
    color: "from-accent-500 to-primary-500",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 relative">
      {/* Background accent */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-500/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-slate-100 mb-4">
            How It Works
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Four simple steps to voice-powered productivity
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Connection line */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-primary-500/50 via-violet-500/50 to-accent-500/50 hidden md:block" />

            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative flex gap-6 mb-12 last:mb-0"
              >
                {/* Step number/icon */}
                <div className="relative z-10 flex-shrink-0">
                  <div
                    className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} p-[1px]`}
                  >
                    <div className="w-full h-full rounded-2xl bg-slate-900 flex items-center justify-center">
                      <step.icon className="w-7 h-7 text-slate-100" />
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 pt-2">
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className={`text-sm font-mono font-bold bg-gradient-to-r ${step.color} bg-clip-text text-transparent`}
                    >
                      {step.number}
                    </span>
                    <h3 className="text-xl font-semibold text-slate-100">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
