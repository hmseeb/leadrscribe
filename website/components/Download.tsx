"use client";

import { motion } from "framer-motion";
import { Download as DownloadIcon, Apple, Github, ExternalLink } from "lucide-react";
import { Button } from "./ui/Button";
import Link from "next/link";
import { DownloadLinks, formatBytes } from "@/lib/github";

// Windows icon component
function WindowsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
    </svg>
  );
}

// Linux icon component
function LinuxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 01-.004-.021l-.004-.024a1.807 1.807 0 01-.15.706.953.953 0 01-.213.335.71.71 0 00-.088-.042c-.104-.045-.198-.064-.284-.133a1.312 1.312 0 00-.22-.066c.05-.06.146-.133.183-.198.053-.128.082-.264.088-.402v-.02a1.21 1.21 0 00-.061-.4c-.045-.134-.101-.2-.183-.333-.084-.066-.167-.132-.267-.132h-.016c-.093 0-.176.03-.262.132a.8.8 0 00-.205.334 1.18 1.18 0 00-.09.4v.019c.002.089.008.179.02.267-.193-.067-.438-.135-.607-.202a1.635 1.635 0 01-.018-.2v-.02a1.772 1.772 0 01.15-.768c.082-.22.232-.406.43-.533a.985.985 0 01.594-.2zm-2.962.059h.036c.142 0 .27.048.399.135.146.129.264.288.344.465.09.199.14.4.153.667v.004c.007.134.006.2-.002.266v.08c-.03.007-.056.018-.083.024-.152.055-.274.135-.393.2.012-.09.013-.18.003-.267v-.015c-.012-.133-.04-.2-.082-.333a.613.613 0 00-.166-.267.248.248 0 00-.183-.064h-.021c-.071.006-.13.04-.186.132a.552.552 0 00-.12.27.944.944 0 00-.023.33v.015c.012.135.037.2.08.334.046.134.098.2.166.268.01.009.02.018.034.024-.07.057-.117.07-.176.136a.304.304 0 01-.131.068 2.62 2.62 0 01-.275-.402 1.772 1.772 0 01-.155-.667 1.759 1.759 0 01.08-.668 1.43 1.43 0 01.283-.535c.128-.133.26-.2.418-.2zm1.37 1.706c.332 0 .733.065 1.216.399.293.2.523.269 1.052.468h.003c.255.136.405.266.478.399v-.131a.571.571 0 01.016.47c-.123.31-.516.643-1.063.842v.002c-.268.135-.501.333-.775.465-.276.135-.588.292-1.012.267a1.139 1.139 0 01-.448-.067 3.566 3.566 0 01-.322-.198c-.195-.135-.363-.332-.612-.465v-.005h-.005c-.4-.246-.616-.512-.686-.71-.07-.268-.005-.47.193-.6.224-.135.38-.271.483-.336.104-.074.143-.102.176-.131h.002v-.003c.169-.202.436-.47.839-.601.139-.036.294-.065.466-.065zm2.8 2.142c.358 1.417 1.196 3.475 1.735 4.473.286.534.855 1.659 1.102 3.024.156-.005.33.018.513.064.646-1.671-.546-3.467-1.089-3.966-.22-.2-.232-.335-.123-.335.59.534 1.365 1.572 1.646 2.757.13.535.16 1.104.021 1.67.067.028.135.06.205.067 1.032.534 1.413.938 1.23 1.537v-.025c-.06.135-.19.334-.396.4-.325.148-.726.066-1.095-.003-.045-.012-.09-.02-.135-.024-.15-.065-.32-.197-.496-.4-.14-.134-.27-.333-.393-.465-.123-.135-.242-.2-.357-.4a3.223 3.223 0 01-.347.733c-.2.267-.455.534-.672.733a2.36 2.36 0 01-.378.266v-.133c.105-.2.176-.333.2-.467.024-.133.037-.267-.023-.4-.19-.467-.51-.535-.86-.401-.39.135-.66.268-.863.535-.206.268-.37.534-.654.733a.992.992 0 01-.39.2c-.265.066-.568-.067-.923-.2-.342-.135-.719-.334-1.104-.4-.133-.022-.27-.034-.405-.067-.267-.067-.463-.2-.545-.535a.98.98 0 01.027-.468c.035-.2.088-.335.197-.535.088-.134.178-.266.328-.4-.23-.003-.45-.135-.635-.266a4.065 4.065 0 01-.49-.4.86.86 0 01-.202-.267c-.065-.135-.065-.266-.038-.4.09-.467.511-.735 1.016-.869.225-.066.466-.133.716-.133a2.734 2.734 0 01.313.013c.116.01.233.032.35.04-.125-.133-.233-.267-.309-.4a2.89 2.89 0 01-.372-1.203 1.44 1.44 0 01.082-.467c.1-.2.233-.335.43-.467-.171-.134-.27-.267-.33-.4a1.44 1.44 0 01-.093-.535c0-.066.004-.133.01-.2-.09.067-.18.135-.28.2-.1.065-.203.134-.324.133v-.003h-.01c-.084.135-.184.267-.352.4h.002c-.091.066-.196.134-.321.2-.124.067-.27.131-.445.2-.15.065-.296.133-.4.2-.13.067-.2.135-.231.2a.8.8 0 01-.025.067c-.15-.04-.3-.09-.455-.13-.067-.02-.134-.04-.2-.063l-.015-.005-.035-.01c-.065-.02-.125-.025-.185-.065a1.15 1.15 0 01-.155-.133c-.1-.134-.15-.334-.12-.535a.937.937 0 01.315-.535c.285-.266.645-.4 1.09-.532.263-.067.525-.133.862-.134h.015c.35-.006.7.065 1.046.135.353.073.696.2 1.065.334a9.993 9.993 0 011.36-.128h.02z" />
    </svg>
  );
}

interface DownloadProps {
  downloadLinks: DownloadLinks | null;
}

export function Download({ downloadLinks }: DownloadProps) {
  return (
    <section id="download" className="py-24 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary-500/5 to-transparent" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-slate-100 mb-4">
            Download LeadrScribe
          </h2>
          <p className="text-xl text-slate-400">
            Free forever. No account required.
          </p>
          {downloadLinks?.version && (
            <p className="text-sm text-slate-500 mt-2">
              Latest version: {downloadLinks.version}
            </p>
          )}
        </motion.div>

        {/* Download buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-wrap justify-center gap-4 mb-12"
        >
          {/* Windows */}
          {downloadLinks?.windows ? (
            <Link href={downloadLinks.windows.browser_download_url}>
              <Button size="lg" variant="primary" className="min-w-[200px]">
                <WindowsIcon className="w-5 h-5" />
                <div className="text-left">
                  <div>Windows</div>
                  <div className="text-xs opacity-70">
                    {formatBytes(downloadLinks.windows.size)}
                  </div>
                </div>
              </Button>
            </Link>
          ) : (
            <Button size="lg" variant="primary" className="min-w-[200px]" disabled>
              <WindowsIcon className="w-5 h-5" />
              <span>Windows</span>
            </Button>
          )}

          {/* macOS */}
          {downloadLinks?.macosArm || downloadLinks?.macos ? (
            <Link
              href={
                (downloadLinks.macosArm || downloadLinks.macos)!
                  .browser_download_url
              }
            >
              <Button size="lg" variant="secondary" className="min-w-[200px]">
                <Apple className="w-5 h-5" />
                <div className="text-left">
                  <div>macOS</div>
                  <div className="text-xs opacity-70">
                    {formatBytes(
                      (downloadLinks.macosArm || downloadLinks.macos)!.size
                    )}
                  </div>
                </div>
              </Button>
            </Link>
          ) : (
            <Button size="lg" variant="secondary" className="min-w-[200px]" disabled>
              <Apple className="w-5 h-5" />
              <span>macOS</span>
            </Button>
          )}

          {/* Linux */}
          {downloadLinks?.linux || downloadLinks?.linuxDeb ? (
            <Link
              href={
                (downloadLinks.linux || downloadLinks.linuxDeb)!
                  .browser_download_url
              }
            >
              <Button size="lg" variant="secondary" className="min-w-[200px]">
                <LinuxIcon className="w-5 h-5" />
                <div className="text-left">
                  <div>Linux</div>
                  <div className="text-xs opacity-70">
                    {formatBytes(
                      (downloadLinks.linux || downloadLinks.linuxDeb)!.size
                    )}
                  </div>
                </div>
              </Button>
            </Link>
          ) : (
            <Button size="lg" variant="secondary" className="min-w-[200px]" disabled>
              <LinuxIcon className="w-5 h-5" />
              <span>Linux</span>
            </Button>
          )}
        </motion.div>

        {/* Links */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-wrap justify-center gap-6 text-sm mb-8"
        >
          {downloadLinks?.releaseUrl && (
            <Link
              href={downloadLinks.releaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-slate-400 hover:text-primary-400 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              All releases
            </Link>
          )}
          <Link
            href="https://github.com/hmseeb/leadrscribe"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-slate-400 hover:text-primary-400 transition-colors"
          >
            <Github className="w-4 h-4" />
            Source code
          </Link>
        </motion.div>

        {/* System requirements */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-center text-sm text-slate-500 max-w-xl mx-auto"
        >
          Requires ~2GB for Whisper models. GPU recommended for fastest
          transcription.
        </motion.p>
      </div>
    </section>
  );
}
