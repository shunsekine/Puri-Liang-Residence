import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const gasUrl = process.env.GAS_WEBHOOK_URL;
    if (!gasUrl) {
      console.warn('[API /api/reserve] GAS_WEBHOOK_URL is not set in environment variables.');
      // モック成功レスポンス（GAS URL未設定時用）
      return NextResponse.json({ success: true, mock: true });
    }

    const gasRes = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(body),
    });

    const data = await gasRes.json().catch(() => ({ success: true }));

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[API /api/reserve] Error proxying to GAS:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
