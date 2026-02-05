"use client";

import { useEffect, useState, useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { Lock, Github, Shield, Zap, Globe } from "lucide-react";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import Link from "next/link";
import Image from "next/image";

const WORDS = ["Emails", "Notes", "Code", "Messages", "Documents", "Ideas"];

function Typewriter() {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentText, setCurrentText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const word = WORDS[currentWordIndex];
    const typeSpeed = isDeleting ? 50 : 100;

    if (!isDeleting && currentText === word) {
      setTimeout(() => setIsDeleting(true), 2000);
      return;
    }

    if (isDeleting && currentText === "") {
      setIsDeleting(false);
      setCurrentWordIndex((prev) => (prev + 1) % WORDS.length);
      return;
    }

    const timeout = setTimeout(() => {
      setCurrentText((prev) =>
        isDeleting ? prev.slice(0, -1) : word.slice(0, prev.length + 1)
      );
    }, typeSpeed);

    return () => clearTimeout(timeout);
  }, [currentText, isDeleting, currentWordIndex]);

  return (
    <span className="gradient-text-accent">
      {currentText}
      <span className="animate-blink">|</span>
    </span>
  );
}

export function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const springConfig = { stiffness: 100, damping: 30 };

  // Screenshot animation - subtle float and scale on scroll
  const screenshotY = useSpring(
    useTransform(scrollYProgress, [0, 0.5], [0, -50]),
    springConfig
  );
  const screenshotScale = useSpring(
    useTransform(scrollYProgress, [0, 0.5], [1, 0.95]),
    springConfig
  );

  // Parallax orbs
  const orb1Y = useSpring(
    useTransform(scrollYProgress, [0, 1], [0, -200]),
    springConfig
  );
  const orb2Y = useSpring(
    useTransform(scrollYProgress, [0, 1], [0, -300]),
    springConfig
  );
  const orb3Y = useSpring(
    useTransform(scrollYProgress, [0, 1], [0, -150]),
    springConfig
  );

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen overflow-hidden pt-28 md:pt-32 pb-0"
    >
      {/* Background orbs */}
      <motion.div
        style={{ y: orb1Y }}
        className="absolute top-20 left-1/4 w-80 h-80 bg-primary-500/20 rounded-full blur-3xl animate-pulse-slow z-0 pointer-events-none"
      />
      <motion.div
        style={{ y: orb2Y }}
        className="absolute top-40 right-1/4 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl animate-pulse-slow z-0 pointer-events-none"
        initial={{ opacity: 0.5 }}
      />
      <motion.div
        style={{ y: orb3Y }}
        className="absolute bottom-20 left-1/3 w-[500px] h-[500px] bg-slate-500/10 rounded-full blur-3xl animate-pulse-slow z-0 pointer-events-none"
      />

      <div className="container mx-auto px-4 relative z-10">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-8"
        >
          <Badge variant="primary">
            <Lock className="w-4 h-4" />
            100% Offline & Private
          </Badge>
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-center mb-6"
        >
          <h1 className="text-5xl md:text-7xl font-bold text-slate-100 mb-4">
            Your Voice, Your Device
          </h1>
          <p className="text-3xl md:text-5xl font-semibold text-slate-400">
            <Typewriter />
          </p>
        </motion.div>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-xl md:text-2xl text-slate-400 text-center max-w-3xl mx-auto mb-10"
        >
          Press a key. Speak. Watch your words appear.{" "}
          <span className="text-slate-300">No cloud. No subscription. No bullshit.</span>
        </motion.p>

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-wrap justify-center gap-6 md:gap-10 mb-10"
        >
          <div className="flex items-center gap-2 text-slate-300">
            <Shield className="w-5 h-5 text-primary-400" />
            <span>100% offline</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <Zap className="w-5 h-5 text-accent-400" />
            <span>&lt;50ms latency</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <Globe className="w-5 h-5 text-cyan-400" />
            <span>99+ languages</span>
          </div>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-wrap justify-center gap-4 mb-6"
        >
          <Link href="#download">
            <Button size="lg" variant="primary">
              Download Free
            </Button>
          </Link>
          <Link
            href="https://github.com/hmseeb/leadrscribe"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="lg" variant="secondary">
              <Github className="w-5 h-5" />
              View on GitHub
            </Button>
          </Link>
        </motion.div>

        {/* Social Proof */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="text-sm text-slate-500 text-center mb-12"
        >
          Open source. MIT licensed. Fork it, extend it, make it yours.
        </motion.p>

        {/* Screenshot */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
          style={{
            y: screenshotY,
            scale: screenshotScale,
          }}
          className="max-w-4xl mx-auto"
        >
          <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-primary-500/10 border border-slate-700/50 glow-primary">
            <Image
              src="/app-screenshot.png"
              alt="LeadrScribe app interface"
              width={1200}
              height={750}
              className="w-full h-auto"
              priority
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
