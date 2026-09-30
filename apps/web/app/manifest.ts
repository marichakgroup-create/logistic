import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LoadLink', short_name: 'LoadLink', description: 'Find freight that fits your van.',
    start_url: '/find', display: 'standalone', background_color: '#f7f8f6', theme_color: '#f7f8f6',
  };
}
