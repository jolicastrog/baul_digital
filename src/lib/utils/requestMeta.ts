export function getRequestMeta(request: Request) {
  const ip =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    null;
  const user_agent = request.headers.get('user-agent') ?? null;
  return { ip_address: ip, user_agent };
}
