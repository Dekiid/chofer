import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

// Toque do pedido novo, como na Uber: repete até o motorista aceitar, recusar ou o tempo acabar.
// Toca mesmo com o iPhone em silêncio, porque o motorista não pode perder um pedido.
let leitor: AudioPlayer | null = null;

export function tocarPedido(repetir = true) {
  // No browser (pré-visualização e cliente de testes) não há toque: o motorista usa o telemóvel.
  if (Platform.OS === 'web') return;
  try {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    leitor ??= createAudioPlayer(require('@/assets/sons/pedido.wav'));
    leitor.loop = repetir;
    leitor.volume = 1;
    leitor.seekTo(0).catch(() => {});
    leitor.play();
  } catch {
    // Sem som (por exemplo, no browser antes de tocar no ecrã), fica a vibração e o aviso.
  }
}

export function pararPedido() {
  try {
    leitor?.pause();
  } catch {}
}
