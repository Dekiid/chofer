import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { estilosPasso, PassoRegisto } from '@/components/passo-registo';
import { Text, TextInput } from '@/components/texto';
import { BotaoPrincipal } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { supabase } from '@/data/tempo-real';
import { t } from '@/i18n';
import { useSessao } from '@/state/sessao';

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Entrar com um link no email, enquanto as SMS não saem (a Twilio está por pagar).
 * O link do email volta a este ecrã com ?code=…, que se troca pela sessão no mesmo telemóvel.
 */
export default function EntrarEmail() {
  const c = usePalette();
  const s = estilosPasso(c);
  const sessao = useSessao();
  const { code, error_description } = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [email, setEmail] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [aEntrar, setAEntrar] = useState(Boolean(code));
  const [erro, setErro] = useState(error_description ? t('O link já não é válido. Pede outro.') : '');
  const trocado = useRef(false);
  const valido = EMAIL_VALIDO.test(email.trim());

  // Veio do link do email: troca o código pela sessão. A sessão nova leva a app ao passo do registo que falta.
  useEffect(() => {
    const sb = supabase();
    if (!code || !sb || trocado.current) return;
    trocado.current = true;
    sb.auth.exchangeCodeForSession(code).then(({ error }) => {
      setAEntrar(false);
      if (error) setErro(t('Não foi possível entrar com este link. Abre-o no mesmo telemóvel onde o pediste, ou pede outro.'));
    });
  }, [code]);

  // Já entrou: segue para o registo, que continua no passo que falta (número, nome, termos).
  useEffect(() => {
    if (sessao.estado === 'dentro' && sessao.perfil?.entrouPorEmail) router.replace('/registo');
  }, [sessao.estado, sessao.perfil]);

  async function enviar() {
    setAEnviar(true);
    setErro('');
    const falhou = await sessao.pedirLinkEmail(email.trim().toLowerCase());
    setAEnviar(false);
    if (falhou) return setErro(falhou);
    setEnviado(true);
  }

  if (aEntrar) {
    return (
      <PassoRegisto titulo={t('A entrar…')} descricao={t('Estamos a confirmar o link do teu email.')} onVoltar={() => router.replace('/registo')}>
        <ActivityIndicator color={c.text} style={{ alignSelf: 'flex-start', marginTop: Spacing.two }} />
      </PassoRegisto>
    );
  }

  return (
    <PassoRegisto
      titulo={enviado ? t('Abre o teu email') : t('Entra com o teu email')}
      descricao={
        enviado
          ? t('Enviámos um link para {email}. Abre-o neste telemóvel para entrares. Vê também na pasta de spam.', { email: email.trim().toLowerCase() })
          : t('Enviamos um link para entrares, sem SMS. Depois pedimos o teu número para o motorista te ligar.')
      }
      onVoltar={() => (router.canGoBack() ? router.back() : router.replace('/registo'))}
      rodape={
        enviado ? null : aEnviar ? (
          <ActivityIndicator color={c.text} style={{ paddingVertical: Spacing.three }} />
        ) : (
          <BotaoPrincipal texto={t('Enviar link')} escuro onPress={enviar} desativado={!valido} />
        )
      }>
      {enviado ? (
        <Text style={s.ligacao} onPress={() => setEnviado(false)}>
          {t('Mudar o email ou enviar outra vez')}
        </Text>
      ) : (
        <TextInput
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setErro('');
          }}
          placeholder={t('nome@exemplo.co.mz')}
          placeholderTextColor={c.textSecondary}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          returnKeyType="send"
          onSubmitEditing={() => valido && enviar()}
          accessibilityLabel={t('Email')}
          style={[s.campo, s.campoAtivo]}
        />
      )}
      {erro ? <Text style={s.erro}>{erro}</Text> : null}
    </PassoRegisto>
  );
}
