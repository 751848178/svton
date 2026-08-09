export function GET() {
  return new Response(null, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=86400',
      'Content-Length': '0',
    },
  });
}
