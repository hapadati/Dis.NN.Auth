// auth/verify-vpn.js
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

export async function isVpnIp(ip) {
  if (!ip || ip.startsWith("::1")) return false; // ローカルは除外

  const apiKey = process.env.VPNAPI_KEY;
  if (!apiKey) {
    console.warn("⚠️ VPNAPI_KEY is not set. Skipping VPN check.");
    return false;
  }

  try {
    const res = await fetch(`https://vpnapi.io/api/${ip}?key=${apiKey}`);
    if (!res.ok) {
      console.warn("⚠️ VPN API request failed:", res.status);
      return false;
    }

    const data = await res.json();
    const vpnDetected = data?.security?.vpn || data?.security?.proxy || data?.security?.tor;
    return vpnDetected === true;
  } catch (err) {
    console.error("❌ VPN check error:", err);
    return false;
  }
}
