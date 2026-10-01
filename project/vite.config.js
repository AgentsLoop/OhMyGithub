export default {
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    headers: { 'X-Frame-Options': 'ALLOWALL' }
  },
  preview: {
    host: '0.0.0.0',
    port: 3000
  }
}
