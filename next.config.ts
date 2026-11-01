import type { NextConfig } from 'next'

// Project site: https://<user>.github.io/tools/
// Set NEXT_PUBLIC_BASE_PATH="" when deploying to a custom domain root.
const configuredBasePath = (
  process.env.NEXT_PUBLIC_BASE_PATH ?? '/tools'
).trim()

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: configuredBasePath.length > 0 ? configuredBasePath : undefined,
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
}

export default nextConfig
