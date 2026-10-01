import { router } from 'expo-router';
import { useState } from 'react';

import { estilosPasso, PassoRegisto } from '@/components/passo-registo';
import { Text, TextInput } from '@/components/texto';
import { BotaoPrincipal } from '@/components/ui';
import { usePalette } from '@/constants/use-palette';
import { useSessao } from '@/state/sessao';

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function Email() {
  const c = usePalette();
  const s = estilosPasso(c);
  const sessao = useSessao();
  const [email, setEmail] = useState(sessao.perfil?.email ?? '');
  const [erro, setErro] = useState('');
  const valido = EMAIL_VALIDO.test(email.trim());

  async function seguinte() {
    const falhou = await sessao.guardarPerfil({ email: email.trim().toLowerCase() });
    if (falhou) return setErro(falhou);
    router.push('/registo/termos');
  }

  return (
    <PassoRegisto
      titulo="Qual é o teu email?"
      descricao="Para receberes os recibos das viagens e recuperares a conta se mudares de número."
      onVoltar={() => router.back()}
      rodape={<BotaoPrincipal texto="Seguinte" escuro onPress={seguinte} desativado={!valido} />}>
      <TextInput
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          setErro('');
        }}
        placeholder="nome@exemplo.co.mz"
        placeholderTextColor={c.textSecondary}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        returnKeyType="done"
        onSubmitEditing={() => valido && seguinte()}
        accessibilityLabel="Email"
        style={[s.campo, s.campoAtivo]}
      />
      {email.includes('@') && email.length > 5 && !valido ? <Text style={s.erro}>Confirma o email: falta alguma coisa.</Text> : null}
      {erro ? <Text style={s.erro}>{erro}</Text> : null}
    </PassoRegisto>
  );
}
