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
          borderRadius: 80,
          fontSize: 320,
        }}
      >
        🃏
      </div>
    ),
    { width: 512, height: 512 }
  );
}
