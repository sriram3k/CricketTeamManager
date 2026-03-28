import { CapacitorConfig } from "@capacitor/cli";

// Set CAPACITOR_SERVER_URL to your DigitalOcean app URL before building
// e.g.  CAPACITOR_SERVER_URL=https://cricketteammanager-xxxx.ondigitalocean.app
const serverUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.crickiq.app",
  appName: "CrickIQ",
  // webDir is used when NOT using a live server URL (e.g. local testing)
  webDir: "dist/public",
  server: serverUrl
    ? {
        // Point directly at the live DigitalOcean server.
        // The webview loads the full web app from the server, so cookies,
        // sessions, and all API calls work identically to the browser.
        url: serverUrl,
        cleartext: false, // HTTPS only in production
      }
    : undefined,
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#16a34a", // CrickIQ green
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    StatusBar: {
      style: "Dark",
      backgroundColor: "#16a34a",
    },
  },
  android: {
    // Minimum SDK version — Android 7.0+
    minWebViewVersion: 60,
  },
  ios: {
    // Allow cookies from the server (required for session auth)
    limitsNavigationsToAppBoundDomains: false,
  },
};

export default config;
