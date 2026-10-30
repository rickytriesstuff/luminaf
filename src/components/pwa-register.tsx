"use client";
import {useEffect} from "react";
export function PwaRegister(){useEffect(()=>{if("serviceWorker" in navigator){navigator.serviceWorker.register("/sw.js").catch(()=>{/* PWA enhancements are optional when registration is blocked. */});}},[]);return null;}
