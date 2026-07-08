import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  try {
    const path = params.path.join("/");
    const searchParams = req.nextUrl.searchParams.toString();
    const targetUrl = `https://belleforet-data.vercel.app/api/v5/${path}?${searchParams}`;
    
    console.log("[Local Proxy] Fetching:", targetUrl);
    
    const response = await fetch(targetUrl, {
      headers: {
        Authorization: req.headers.get("Authorization") || "",
      },
      cache: "no-store"
    });
    
    const text = await response.text();
    console.log("[Local Proxy] Response length:", text.length, "status:", response.status);
    
    return new NextResponse(text, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/json",
      }
    });
  } catch (error: any) {
    console.error("[Local Proxy] Error:", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
