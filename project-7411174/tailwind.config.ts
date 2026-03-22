import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#080C1A",
          secondary: "#0E1428",
          card: "#131929",
          elevated: "#1A2238",
        },
        accent: {
          cyan: "#00D4B8",
          "cyan-dim": "#00A896",
          "cyan-glow": "rgba(0,212,184,0.25)",
          amber: "#F59E0B",
          red: "#EF4444",
          green: "#10B981",
        },
        text: {
          primary: "#F1F5F9",
          secondary: "#94A3B8",
          muted: "#475569",
        },
        border: {
          DEFAULT: "rgba(255,255,255,0.08)",
          accent: "rgba(0,212,184,0.4)",
        },
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans SC", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      backgroundImage: {
        "hero-gradient": "radial-gradient(ellipse at 60% 0%, #0d2033 0%, #080C1A 60%)",
        "card-gradient": "linear-gradient(135deg, #131929 0%, #0E1428 100%)",
        "cyan-gradient": "linear-gradient(135deg, #00D4B8 0%, #00A896 100%)",
        "glow-radial": "radial-gradient(circle at center, rgba(0,212,184,0.15) 0%, transparent 70%)",
      },
      boxShadow: {
        "glow-cyan": "0 0 20px rgba(0,212,184,0.3)",
        "glow-cyan-lg": "0 0 40px rgba(0,212,184,0.2)",
        card: "0 4px 24px rgba(0,0,0,0.4)",
        "card-hover": "0 8px 40px rgba(0,0,0,0.5)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "slide-right": "slideRight 0.3s ease-out",
        float: "float 6s ease-in-out infinite",
        "particle-1": "particle1 8s ease-in-out infinite",
        "particle-2": "particle2 10s ease-in-out infinite",
        "particle-3": "particle3 12s ease-in-out infinite",
        "progress-scan": "progressScan 2s ease-in-out infinite",
        shimmer: "shimmer 6s ease-in-out infinite alternate",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideRight: {
          "0%": { opacity: "0", transform: "translateX(-20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        particle1: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)", opacity: "0.6" },
          "33%": { transform: "translate(40px, -30px) scale(1.2)", opacity: "1" },
          "66%": { transform: "translate(-20px, 20px) scale(0.8)", opacity: "0.4" },
        },
        particle2: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)", opacity: "0.4" },
          "40%": { transform: "translate(-50px, 30px) scale(1.3)", opacity: "0.8" },
          "70%": { transform: "translate(30px, -40px) scale(0.7)", opacity: "0.3" },
        },
        particle3: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)", opacity: "0.5" },
          "50%": { transform: "translate(60px, 20px) scale(1.1)", opacity: "0.9" },
        },
        progressScan: {
          "0%": { width: "0%", marginLeft: "0%" },
          "50%": { width: "60%", marginLeft: "20%" },
          "100%": { width: "0%", marginLeft: "100%" },
        },
        shimmer: {
          "0%": { opacity: "0.4", transform: "scaleX(0.85)" },
          "50%": { opacity: "0.85", transform: "scaleX(1)" },
          "100%": { opacity: "0.4", transform: "scaleX(0.85)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
