"use client";
import {useEffect} from "react";
import {sitePath} from "@/lib/site-path";
export function PwaRegister(){useEffect(()=>{if("serviceWorker" in navigator){navigator.serviceWorker.register(sitePath("/sw.js"),{scope:sitePath("/")}).catch(()=>{/* PWA enhancements are optional when registration is blocked. */});}},[]);return null;}
