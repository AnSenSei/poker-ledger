import { ImageResponse } from 'next/og';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #166534, #16a34a)',
          borderRadius: 40,
          fontSize: 120,
        }}
      >
        🃏
      </div>
    ),
    { width: 192, height: 192 }
  );
}
