"use client";

import { Github, Heart } from "lucide-react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="py-12 border-t border-slate-800/50">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo and tagline */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">LS</span>
            </div>
            <span className="text-slate-400 text-sm">
              LeadrScribe — Your voice, your device
            </span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6">
            <Link
              href="https://github.com/hmseeb/leadrscribe"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-slate-400 hover:text-slate-100 transition-colors text-sm"
            >
              <Github className="w-4 h-4" />
              GitHub
            </Link>
            <span className="text-slate-700">|</span>
            <span className="flex items-center gap-1 text-slate-500 text-sm">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-xs text-slate-400">
                MIT
              </span>
              License
            </span>
          </div>

          {/* Made with love */}
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            Made with
            <Heart className="w-4 h-4 text-red-500 fill-red-500" />
            for privacy
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 text-center text-slate-600 text-xs">
          © {new Date().getFullYear()} LeadrScribe. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
