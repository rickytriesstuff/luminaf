import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata:Metadata={title:"Luminaf | Your wellness, in focus",description:"A thoughtful space to build healthier habits and track progress.",applicationName:"Luminaf",manifest:"/manifest.webmanifest",appleWebApp:{capable:true,statusBarStyle:"black-translucent",title:"Luminaf"}};
export const viewport:Viewport={themeColor:"#050706",width:"device-width",initialScale:1};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" className="dark"><body>{children}</body></html>;}