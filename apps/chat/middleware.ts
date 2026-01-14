import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Simple pass-through middleware
  // Session is managed client-side with implicit flow
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Only match pages, not API routes or static files
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
