import { ImageResponse } from 'next/og';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
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
          borderRadius: 14,
          fontSize: 40,
        }}
      >
        🃏
      </div>
    ),
    { ...size }
  );
}
