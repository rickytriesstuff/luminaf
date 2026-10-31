import type { Metadata, Viewport } from "next";
import "./globals.css";
import {PwaRegister} from "@/components/pwa-register";
import {ApiGatewayScript} from "@/components/api-gateway-script";
export const metadata:Metadata={title:"Luminaf | Your wellness, in focus",description:"A thoughtful space to build healthier habits and track progress.",applicationName:"Luminaf",manifest:(process.env.NEXT_PUBLIC_SITE_BASE_PATH||"")+"/manifest.webmanifest",appleWebApp:{capable:true,statusBarStyle:"black-translucent",title:"Luminaf"}};
export const viewport:Viewport={themeColor:"#050706",width:"device-width",initialScale:1};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" className="dark"><body><ApiGatewayScript/><PwaRegister/>{children}</body></html>;}