// Junta ao app.json a chave do Google Maps para o mapa no Android (só nas versões instaladas;
// o Expo Go usa a dele). Vem da variável GOOGLE_MAPS_ANDROID_API_KEY, fora do repositório.
module.exports = ({ config }) => {
  const chave = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  if (!chave) return config;
  return { ...config, plugins: [...config.plugins, ['react-native-maps', { androidGoogleMapsApiKey: chave }]] };
};
