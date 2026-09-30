import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LoadLink', short_name: 'LoadLink', description: 'Find freight that fits your van.',
    start_url: '/find', display: 'standalone', background_color: '#f7f8fb', theme_color: '#2563eb',
  };
}
