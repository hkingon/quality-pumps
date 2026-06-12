import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60; // 60 seconds timeout (default on Vercel is 10-15s, increased for vision extraction)

const EXTRACTION_PROMPT = `You are a precision engineering data extraction system. Accurately digitize ALL pump performance curves from this graph.

Step 1 — Read AXES carefully:
• X-axis: flow rate label, units (m³/h, L/s, GPM, m³/min, etc.), minimum value, maximum value
• Each Y-axis (left and/or right): label, units, minimum value, maximum value
• Read tick mark values precisely — do not guess or round

Step 2 — Identify ALL CURVES present. Common pump curves include:
• Head (H) — typically declines left to right
• Efficiency (η or %) — typically a hump/bell shape
• NPSHr (Net Positive Suction Head required) — typically rises left to right
• Power (P, kW, HP, BHP) — typically rises left to right
• Multiple speed curves (e.g. 1450 RPM, 1750 RPM) — label each with its speed
• Iso-efficiency contour lines — label each with its efficiency value

Step 3 — EXTRACT DATA POINTS for every curve:
• Extract at minimum 12–20 (flow, value) coordinate pairs per curve
• Always include the curve's start (minimum flow) and end (maximum flow)
• Include any peak, trough, knee, or inflection point
• Space intermediate points to faithfully reproduce the curve shape

Return ONLY a valid JSON object — no markdown fences, no explanation text:
{
  "graph_title": "string or null",
  "pump_model": "string or null",
  "speed_rpm": "string or null",
  "axes": {
    "x": {"label": "Flow Rate", "unit": "m³/h", "min": 0, "max": 100},
    "y_axes": [
      {"id": "left1", "label": "Head", "unit": "m", "min": 0, "max": 60, "side": "left"},
      {"id": "right1", "label": "Efficiency", "unit": "%", "min": 0, "max": 100, "side": "right"}
    ]
  },
  "curves": [
    {
      "name": "Head",
      "unit": "m",
      "y_axis_id": "left1",
      "data_points": [
        {"flow": 0, "value": 55.0},
        {"flow": 10, "value": 52.5}
      ]
    }
  ],
  "notes": "string or null"
}`;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user and check admin role
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || user.user_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Access Denied. Admin privileges required.' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Use PDF, PNG, or JPG.' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const base64 = arrayBufferToBase64(bytes);
    const isPdf = file.type === 'application/pdf';

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Claude API key is not configured on the server.' }, { status: 500 });
    }

    const client = new Anthropic({
      apiKey: apiKey,
    });

    const imageContent = isPdf
      ? ({
          type: 'document' as const,
          source: {
            type: 'base64' as const,
            media_type: 'application/pdf' as const,
            data: base64,
          },
        })
      : ({
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: file.type as 'image/png' | 'image/jpeg',
            data: base64,
          },
        });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            imageContent,
            { type: 'text', text: EXTRACTION_PROMPT },
          ],
        },
      ],
    });

    let text = (message.content[0] as { type: string; text: string }).text.trim();
    text = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (match) text = match[0];

    const curveData = JSON.parse(text);
    return NextResponse.json({ curve_data: curveData });

  } catch (err: unknown) {
    console.error('Pump curve extraction error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Extraction failed: ${message}` }, { status: 500 });
  }
}
