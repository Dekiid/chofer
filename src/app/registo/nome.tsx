import { router } from 'expo-router';
import { useRef, useState } from 'react';
import type { TextInputInstance } from 'react-native';

import { estilosPasso, PassoRegisto } from '@/components/passo-registo';
import { Text, TextInput } from '@/components/texto';
import { BotaoPrincipal } from '@/components/ui';
import { usePalette } from '@/constants/use-palette';
import { t } from '@/i18n';
import { proximoPasso, useSessao } from '@/state/sessao';

export default function Nome() {
  const c = usePalette();
  const s = estilosPasso(c);
  const sessao = useSessao();
  const [nome, setNome] = useState(sessao.perfil?.nome ?? '');
  const [apelido, setApelido] = useState(sessao.perfil?.apelido ?? '');
  const [focado, setFocado] = useState<'nome' | 'apelido' | null>('nome');
  const [erro, setErro] = useState('');
  const campoApelido = useRef<TextInputInstance>(null);
  const valido = nome.trim().length >= 2 && apelido.trim().length >= 2;

  async function seguinte() {
    const falhou = await sessao.guardarPerfil({ nome: nome.trim(), apelido: apelido.trim() });
    if (falhou) return setErro(falhou);
    // Quem entrou pelo email já tem o email: salta esse passo.
    const perfil = sessao.perfil ? { ...sessao.perfil, nome: nome.trim(), apelido: apelido.trim() } : null;
    router.push((perfil && proximoPasso(perfil)) || '/registo/email');
  }

  return (
    <PassoRegisto
      titulo={t('Como te chamas?')}
      descricao={t('O motorista vê o teu nome quando te vai buscar.')}
      rodape={<BotaoPrincipal texto={t('Seguinte')} escuro onPress={seguinte} desativado={!valido} />}>
      <TextInput
        value={nome}
        onChangeText={setNome}
        placeholder={t('Nome')}
        placeholderTextColor={c.textSecondary}
        autoFocus
        autoCapitalize="words"
        textContentType="givenName"
        autoComplete="name-given"
        returnKeyType="next"
        onFocus={() => setFocado('nome')}
        onSubmitEditing={() => campoApelido.current?.focus()}
        style={[s.campo, focado === 'nome' && s.campoAtivo]}
      />
      <TextInput
        ref={campoApelido}
        value={apelido}
        onChangeText={setApelido}
        placeholder={t('Apelido')}
        placeholderTextColor={c.textSecondary}
        autoCapitalize="words"
        textContentType="familyName"
        autoComplete="name-family"
        returnKeyType="done"
        onFocus={() => setFocado('apelido')}
        onSubmitEditing={() => valido && seguinte()}
        style={[s.campo, focado === 'apelido' && s.campoAtivo]}
      />
      {erro ? <Text style={s.erro}>{erro}</Text> : null}
    </PassoRegisto>
  );
}
