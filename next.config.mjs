/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'genkit', '@genkit-ai/googleai', 'exceljs'],
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
