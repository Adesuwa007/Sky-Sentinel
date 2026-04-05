import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["three", "@react-three/fiber", "@react-three/drei"],

  allowedDevOrigins: ["192.168.29.8"],

  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      '@splinetool/react-spline/next': path.resolve(__dirname, 'node_modules/@splinetool/react-spline/dist/react-spline-next.js'),
      '@splinetool/react-spline': path.resolve(__dirname, 'node_modules/@splinetool/react-spline/dist/react-spline.js'),
    };
    return config;
  },
};

export default nextConfig;