import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Platform } from 'react-native';

import { enviarFoto } from '@/data/fotos-servidor';
import { useGuardado } from '@/data/guardar';
import { t } from '@/i18n';
import { useSessao } from '@/state/sessao';

const hoje = () => new Date().toISOString().slice(0, 10);

/**
 * Selfie do motorista uma vez por dia, antes de ficar online, como a Uber: confirma que quem conduz é quem foi aprovado.
 * A foto vai para o Supabase Storage (balde selfies, supabase/fotos.sql) e o painel mostra-a ao lado das fotos da inscrição.
 * Ainda não há comparação automática de rostos: a equipa compara no painel.
 */
export function useSelfieDoDia() {
  const { perfil } = useSessao();
  const telefone = perfil?.telefone ?? '';
  const [ultimoDia, setUltimoDia] = useGuardado<string | null>(telefone ? `chauffeur.selfie.${telefone}` : null, null);
  const [aEnviar, setAEnviar] = useState(false);
  // A conta de demonstração não precisa: é só para testar o ecrã.
  const precisa = Boolean(telefone) && !perfil?.motoristaDemo && ultimoDia !== hoje();

  async function tirar(): Promise<boolean> {
    if (Platform.OS !== 'web') {
      const ok = await new Promise<boolean>((resolver) =>
        Alert.alert(t('Confirma que és tu'), t('Antes de ficares online, tira uma selfie. Fazemos isto uma vez por dia, para os clientes saberem que quem conduz é quem aprovámos.'), [
          { text: t('Agora não'), style: 'cancel', onPress: () => resolver(false) },
          { text: t('Tirar selfie'), onPress: () => resolver(true) },
        ]),
      );
      if (!ok) return false;
      const permissao = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissao.granted) {
        Alert.alert(t('Sem acesso à câmara'), t('Para ficares online, permite o acesso à câmara nas definições do telemóvel.'));
        return false;
      }
    }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', cameraType: ImagePicker.CameraType.front, quality: 0.6 });
    if (r.canceled) return false;
    setAEnviar(true);
    // Sem servidor (testes), fica só marcado neste telemóvel.
    await enviarFoto('selfies', `${telefone.replace(/\D/g, '')}/${hoje()}-${Date.now()}.jpg`, r.assets[0].uri);
    setAEnviar(false);
    setUltimoDia(hoje());
    return true;
  }

  return { precisa, tirar, aEnviar };
}
