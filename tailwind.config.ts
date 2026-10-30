import type { Config } from "tailwindcss";
const config:Config={content:["./src/**/*.{ts,tsx}"],darkMode:"class",theme:{extend:{colors:{ink:"#050706",panel:"#0B100E",elevated:"#111916",line:"#1D2A24",neon:"#00E58A",mint:"#8CFFC9",muted:"#91A49A",danger:"#FF6B75"},boxShadow:{glow:"0 0 36px rgba(0,229,138,.12)"},fontFamily:{sans:["Arial","sans-serif"]}}},plugins:[]};
export default config;