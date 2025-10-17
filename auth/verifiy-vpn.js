import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

export async function isVpnIp(ip) {
  if (!ip || ip.startsWith("::1")) return false; // ローカルアクセスは許可

  const apiKey = process.env.VPNAPI_KEY;
  const res = await fetch(`https://vpnapi.io/api/${ip}?key=${apiKey}`);
  const data = await res.json();

  // VPNやProxyなどの情報をチェック
  const vpnDetected = data?.security?.vpn || data?.security?.proxy || data?.security?.tor;
  return vpnDetected === true;
}
