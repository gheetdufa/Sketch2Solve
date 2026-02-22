/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: "http://localhost:8000/:path*" },
      { source: "/ws/:path*", destination: "http://localhost:8000/ws/:path*" },
      { source: "/uploads/:path*", destination: "http://localhost:8000/uploads/:path*" },
    ];
  },
};

module.exports = nextConfig;
