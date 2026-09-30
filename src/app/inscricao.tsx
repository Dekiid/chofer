import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotaoPrincipal, BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { TIPOS_VIATURA } from '@/data/categorias';
import { normalizarTelefone } from '@/data/motorista';
import { FOTOS_PEDIDAS, useInscricoes, type FotoPedida } from '@/state/inscricoes';

const LUGARES = [4, 5, 7];

export default function Inscricao() {
  const cores = usePalette();
  const s = estilos(cores);
  const { submeter } = useInscricoes();

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [documento, setDocumento] = useState('');
  const [cartaConducao, setCartaConducao] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [ano, setAno] = useState('');
  const [matricula, setMatricula] = useState('');
  const [tipo, setTipo] = useState<string>(TIPOS_VIATURA[0].tipo);
  const [lugares, setLugares] = useState(4);
  const [fotos, setFotos] = useState<Partial<Record<FotoPedida, string>>>({});
  const [tentouEnviar, setTentouEnviar] = useState(false);
  const [enviada, setEnviada] = useState(false);

  const telefoneValido = normalizarTelefone(telefone);
  const erros = {
    nome: nome.trim().length < 3,
    telefone: !telefoneValido,
    documento: documento.trim().length < 5,
    cartaConducao: cartaConducao.trim().length < 5,
    marca: !marca.trim(),
    modelo: !modelo.trim(),
    ano: !/^(19|20)\d{2}$/.test(ano.trim()),
    matricula: matricula.trim().length < 5,
    fotos: FOTOS_PEDIDAS.some((f) => !fotos[f.id]),
  };
  const valido = !Object.values(erros).some(Boolean);

  async function escolherFoto(id: FotoPedida) {
    const resultado = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
    if (!resultado.canceled) setFotos((atual) => ({ ...atual, [id]: resultado.assets[0].uri }));
  }

  function enviar() {
    setTentouEnviar(true);
    if (!valido || !telefoneValido) return;
    submeter({
      nome: nome.trim(),
      telefone: telefoneValido,
      documento: documento.trim(),
      cartaConducao: cartaConducao.trim(),
      marca: marca.trim(),
      modelo: modelo.trim(),
      ano: ano.trim(),
      matricula: matricula.trim().toUpperCase(),
      tipo,
      lugares,
      fotos: fotos as Record<FotoPedida, string>,
    });
    setEnviada(true);
  }

  if (enviada) {
    return (
      <SafeAreaView style={[s.ecra, s.centro]}>
        <Text style={s.titulo}>Inscrição enviada</Text>
        <Text style={[s.ajuda, { textAlign: 'center', marginBottom: Spacing.four }]}>
          Vamos rever os teus dados e as fotos do carro. Assim que a inscrição for aprovada, o teu carro passa a aparecer na app.
        </Text>
        <BotaoPrincipal texto="Voltar ao início" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const campo = (rotulo: string, valor: string, mudar: (t: string) => void, erro: boolean, mensagem: string, props?: TextInputProps) => (
    <View style={s.campo}>
      <Text style={s.rotulo}>{rotulo}</Text>
      <TextInput
        value={valor}
        onChangeText={mudar}
        placeholderTextColor={cores.textSecondary}
        style={[s.input, tentouEnviar && erro && s.inputErro]}
        {...props}
      />
      {tentouEnviar && erro && <Text style={s.erro}>{mensagem}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.tituloCabecalho}>Inscrever o meu carro</Text>
      </View>

      <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
        <Text style={s.secao}>Dados pessoais</Text>
        {campo('Nome completo', nome, setNome, erros.nome, 'Escreve o nome completo.', { placeholder: 'Ex.: João Macuácua', autoComplete: 'name' })}
        {campo('Número de contacto', telefone, setTelefone, erros.telefone, 'Número móvel moçambicano, ex.: 84 123 4567.', {
          placeholder: '84 123 4567',
          keyboardType: 'phone-pad',
          autoComplete: 'tel',
        })}
        <Text style={s.ajuda}>Os clientes usam este número para te ligar durante a viagem.</Text>
        {campo('Número do BI', documento, setDocumento, erros.documento, 'Escreve o número do BI.', { autoCapitalize: 'characters' })}
        {campo('Número da carta de condução', cartaConducao, setCartaConducao, erros.cartaConducao, 'Escreve o número da carta.', {
          autoCapitalize: 'characters',
        })}

        <Text style={s.secao}>O carro</Text>
        <View style={s.linha}>
          <View style={{ flex: 1 }}>{campo('Marca', marca, setMarca, erros.marca, 'Obrigatório.', { placeholder: 'Ex.: Mercedes-Benz' })}</View>
          <View style={{ flex: 1 }}>{campo('Modelo', modelo, setModelo, erros.modelo, 'Obrigatório.', { placeholder: 'Ex.: Classe E' })}</View>
        </View>
        <View style={s.linha}>
          <View style={{ flex: 1 }}>{campo('Ano', ano, setAno, erros.ano, 'Ex.: 2021.', { placeholder: '2021', keyboardType: 'number-pad', maxLength: 4 })}</View>
          <View style={{ flex: 1 }}>
            {campo('Matrícula', matricula, setMatricula, erros.matricula, 'Obrigatório.', { placeholder: 'AFK 123 MC', autoCapitalize: 'characters' })}
          </View>
        </View>

        <Text style={s.rotulo}>Tipo</Text>
        <View style={s.opcoes}>
          {TIPOS_VIATURA.map((t) => (
            <Pressable key={t.tipo} onPress={() => setTipo(t.tipo)} style={[s.opcao, tipo === t.tipo && s.opcaoAtiva]}>
              <Text style={[s.textoOpcao, tipo === t.tipo && s.textoOpcaoAtiva]}>{t.tipo}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.rotulo}>Lugares para passageiros</Text>
        <View style={s.opcoes}>
          {LUGARES.map((n) => (
            <Pressable key={n} onPress={() => setLugares(n)} style={[s.opcao, lugares === n && s.opcaoAtiva]}>
              <Text style={[s.textoOpcao, lugares === n && s.textoOpcaoAtiva]}>{n}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.secao}>Fotos do carro</Text>
        <Text style={s.ajuda}>Precisamos destas quatro fotos, com boa luz. A foto de frente é a que os clientes vão ver na app.</Text>
        <View style={s.grelha}>
          {FOTOS_PEDIDAS.map((f) => {
            const uri = fotos[f.id];
            return (
              <Pressable
                key={f.id}
                onPress={() => escolherFoto(f.id)}
                accessibilityLabel={`Escolher foto: ${f.nome}`}
                style={[s.foto, tentouEnviar && !uri && s.inputErro]}>
                {uri ? (
                  <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <View style={s.fotoVazia}>
                    <Text style={s.mais}>+</Text>
                    <Text style={s.dica}>{f.dica}</Text>
                  </View>
                )}
                <View style={s.etiqueta}>
                  <Text style={s.etiquetaTexto}>{f.nome}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        {tentouEnviar && erros.fotos && <Text style={s.erro}>Faltam fotos do carro.</Text>}

        <View style={{ marginTop: Spacing.four }}>
          <BotaoPrincipal texto="Enviar inscrição" onPress={enviar} />
        </View>
        <Text style={[s.ajuda, { textAlign: 'center', marginTop: Spacing.two }]}>A inscrição só fica ativa depois da nossa aprovação.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    centro: { alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
    cabecalho: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    tituloCabecalho: { color: c.text, fontSize: 20, fontWeight: '700' },
    titulo: { color: c.text, fontSize: 24, fontWeight: '800', marginBottom: Spacing.two },
    conteudo: { padding: Spacing.three, paddingBottom: Spacing.five },
    secao: { color: c.text, fontSize: 18, fontWeight: '700', marginTop: Spacing.four, marginBottom: Spacing.two },
    campo: { marginBottom: Spacing.three },
    rotulo: { color: c.text, fontWeight: '600', marginBottom: Spacing.one },
    input: { backgroundColor: c.backgroundElement, color: c.text, borderRadius: Radius.card, paddingHorizontal: Spacing.three, paddingVertical: 12, fontSize: 16, borderWidth: 1.5, borderColor: 'transparent' },
    inputErro: { borderColor: '#D93025' },
    erro: { color: '#D93025', marginTop: Spacing.one, fontSize: 13 },
    ajuda: { color: c.textSecondary, fontSize: 13, marginTop: -Spacing.two, marginBottom: Spacing.three },
    linha: { flexDirection: 'row', gap: Spacing.two },
    opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginBottom: Spacing.three },
    opcao: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.pill, backgroundColor: c.backgroundElement },
    opcaoAtiva: { backgroundColor: c.primary },
    textoOpcao: { color: c.text, fontWeight: '600' },
    textoOpcaoAtiva: { color: c.onPrimary },
    grelha: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
    foto: { width: '48.5%', aspectRatio: 4 / 3, borderRadius: Radius.card, overflow: 'hidden', backgroundColor: c.backgroundElement, borderWidth: 1.5, borderColor: 'transparent' },
    fotoVazia: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.two },
    mais: { color: c.text, fontSize: 28, fontWeight: '300' },
    dica: { color: c.textSecondary, fontSize: 11, textAlign: 'center' },
    etiqueta: { position: 'absolute', left: Spacing.two, top: Spacing.two, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: Radius.pill, paddingHorizontal: Spacing.two, paddingVertical: 2 },
    etiquetaTexto: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  });
}
