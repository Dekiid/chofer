import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotaoPrincipal, BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { COMISSAO, formatarMzn, paraMzn, TIPOS_VIATURA } from '@/data/categorias';
import { lerTelefone, paisAtual } from '@/data/paises';
import { lerData, mascaraData } from '@/data/datas';
import { normalizarTelefone } from '@/data/motorista';
import { CODIGO_MOTORISTA_VALIDO, codigoConviteMotorista, normalizarCodigoMotorista } from '@/data/convite-motorista';
import { FOTOS_PEDIDAS, useInscricoes, type FotoPedida } from '@/state/inscricoes';
import { useSessao } from '@/state/sessao';
import { Text, TextInput } from '@/components/texto';
import { t } from '@/i18n';

const LUGARES = [4, 5, 7];
// Distância usada no exemplo de ganhos da nota da comissão.
const KM_EXEMPLO = 10;

const validadeFutura = (t: string) => {
  const d = lerData(t);
  return d != null && d.getTime() > Date.now();
};

export default function Inscricao() {
  const cores = usePalette();
  const s = estilos(cores);
  const { submeter } = useInscricoes();
  const { perfil } = useSessao();

  // Quem já inscreveu um carro não volta a escrever os dados de dono.
  const anterior = useInscricoes().inscricoes.find((i) => i.telefone === perfil?.telefone);
  const [nome, setNome] = useState(anterior?.nome ?? '');
  const [quemConduz, setQuemConduz] = useState<'eu' | 'outro'>('eu');
  const [motoristaNome, setMotoristaNome] = useState('');
  const [motoristaTelefone, setMotoristaTelefone] = useState('');
  // O número da conta, para o carro ficar ligado a este motorista no modo motorista.
  const [telefone, setTelefone] = useState(lerTelefone(perfil?.telefone ?? '').digitos ?? '');
  const [documento, setDocumento] = useState(anterior?.documento ?? '');
  const [cartaConducao, setCartaConducao] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [ano, setAno] = useState('');
  const [matricula, setMatricula] = useState('');
  const [tipo, setTipo] = useState<string>(TIPOS_VIATURA[0].tipo);
  const [lugares, setLugares] = useState(4);
  const [preco, setPreco] = useState('');
  const [casamentos, setCasamentos] = useState(false);
  const [semDecoracao, setSemDecoracao] = useState('');
  const [comDecoracao, setComDecoracao] = useState('');
  const [fotoDecorada, setFotoDecorada] = useState<string | null>(null);
  const [validadeCarta, setValidadeCarta] = useState('');
  const [validadeSeguro, setValidadeSeguro] = useState('');
  const [validadeInspecao, setValidadeInspecao] = useState('');
  const [fotos, setFotos] = useState<Partial<Record<FotoPedida, string>>>({});
  const [tentouEnviar, setTentouEnviar] = useState(false);
  const [enviada, setEnviada] = useState(false);
  // Link de convite de outro motorista: ?convite=MOT-1234.
  const [convite, setConvite] = useState(normalizarCodigoMotorista(useLocalSearchParams<{ convite?: string }>().convite ?? ''));

  const telefoneValido = normalizarTelefone(telefone);
  const outro = quemConduz === 'outro';
  const motoristaTelefoneValido = normalizarTelefone(motoristaTelefone);
  const erros = {
    motoristaNome: outro && motoristaNome.trim().length < 3,
    motoristaTelefone: outro && (!motoristaTelefoneValido || motoristaTelefoneValido === telefoneValido),
    nome: nome.trim().length < 3,
    telefone: !telefoneValido,
    documento: documento.trim().length < 5,
    cartaConducao: cartaConducao.trim().length < 5,
    marca: !marca.trim(),
    modelo: !modelo.trim(),
    ano: !/^(19|20)\d{2}$/.test(ano.trim()),
    matricula: matricula.trim().length < 5,
    preco: !(Number(preco) > 0),
    semDecoracao: casamentos && !(Number(semDecoracao) > 0),
    comDecoracao: casamentos && !(Number(comDecoracao) > 0),
    fotos: FOTOS_PEDIDAS.some((f) => !fotos[f.id]),
    validadeCarta: !validadeFutura(validadeCarta),
    validadeSeguro: !validadeFutura(validadeSeguro),
    validadeInspecao: !validadeFutura(validadeInspecao),
    convite: convite !== '' && (!CODIGO_MOTORISTA_VALIDO.test(convite) || (telefoneValido != null && convite === codigoConviteMotorista(telefoneValido))),
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
      porKmMzn: Math.max(1, Math.round(paraMzn(Number(preco)))),
      casamento: casamentos
        ? { semDecoracaoMzn: Math.round(paraMzn(Number(semDecoracao))), comDecoracaoMzn: Math.round(paraMzn(Number(comDecoracao))), foto: fotoDecorada ? { uri: fotoDecorada } : undefined }
        : undefined,
      fotos: fotos as Record<FotoPedida, string>,
      validades: { carta: lerData(validadeCarta)!, seguro: lerData(validadeSeguro)!, inspecao: lerData(validadeInspecao)! },
      motorista: outro && motoristaTelefoneValido ? { nome: motoristaNome.trim(), telefone: motoristaTelefoneValido } : undefined,
      convite: convite || undefined,
    });
    setEnviada(true);
  }

  if (enviada) {
    return (
      <SafeAreaView style={[s.ecra, s.centro]}>
        <Text style={s.titulo}>{t('Inscrição enviada')}</Text>
        <Text style={[s.ajuda, { textAlign: 'center', marginBottom: Spacing.four }]}>
          {t('Vamos rever os teus dados e as fotos do carro. Assim que a inscrição for aprovada, o teu carro passa a aparecer na app.')}
        </Text>
        <BotaoPrincipal texto={t('Voltar ao início')} onPress={() => router.back()} />
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
        <Text style={s.tituloCabecalho}>{t('Inscrever o meu carro')}</Text>
      </View>

      <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Text style={s.secao}>{t('Dados pessoais')}</Text>
        {campo(t('Nome completo'), nome, setNome, erros.nome, t('Escreve o nome completo.'), { placeholder: t('Ex.: {exemplo}', { exemplo: 'João Macuácua' }), autoComplete: 'name' })}
        {campo(t('Número de contacto'), telefone, setTelefone, erros.telefone, t('Número móvel de {pais}, ex.: {exemplo}.', { pais: t(paisAtual().nome), exemplo: paisAtual().exemploNumero }), {
          placeholder: paisAtual().exemploNumero,
          keyboardType: 'phone-pad',
          autoComplete: 'tel',
        })}
        <Text style={s.ajuda}>{outro ? t('O teu número, para falarmos contigo sobre o carro e veres o resumo dos teus carros.') : t('Os clientes usam este número para te ligar durante a viagem.')}</Text>
        {campo(t('Número do BI'), documento, setDocumento, erros.documento, t('Escreve o número do BI.'), { autoCapitalize: 'characters' })}
        {campo(t('Código de convite (opcional)'), convite, (v) => setConvite(normalizarCodigoMotorista(v)), erros.convite, t('O código tem a forma MOT-1234 e não pode ser o teu.'), {
          placeholder: 'MOT-1234',
          autoCapitalize: 'characters',
        })}

        <Text style={s.secao}>{t('Quem conduz este carro?')}</Text>
        <View style={s.opcoes}>
          {(['eu', 'outro'] as const).map((q) => (
            <Pressable key={q} onPress={() => setQuemConduz(q)} style={[s.opcao, quemConduz === q && s.opcaoAtiva]}>
              <Text style={[s.textoOpcao, quemConduz === q && s.textoOpcaoAtiva]}>{q === 'eu' ? t('Sou eu') : t('Outra pessoa')}</Text>
            </Pressable>
          ))}
        </View>
        {outro && (
          <>
            <Text style={s.ajuda}>{t('O motorista entra na app com o número dele e fica com o modo motorista só para este carro. Os clientes ligam-lhe a ele. Tu vês o resumo do carro.')}</Text>
            {campo(t('Nome do motorista'), motoristaNome, setMotoristaNome, erros.motoristaNome, t('Escreve o nome completo.'), { placeholder: t('Ex.: {exemplo}', { exemplo: 'Abel Sitoe' }) })}
            {campo(t('Número do motorista'), motoristaTelefone, setMotoristaTelefone, erros.motoristaTelefone, t('Número móvel de {pais}, diferente do teu.', { pais: t(paisAtual().nome) }), {
              placeholder: paisAtual().exemploNumero,
              keyboardType: 'phone-pad',
            })}
          </>
        )}
        {campo(outro ? t('Número da carta de condução do motorista') : t('Número da carta de condução'), cartaConducao, setCartaConducao, erros.cartaConducao, t('Escreve o número da carta.'), {
          autoCapitalize: 'characters',
        })}
        {campo(outro ? t('Carta do motorista válida até') : t('Carta válida até'), validadeCarta, (v) => setValidadeCarta(mascaraData(v)), erros.validadeCarta, t('Data futura, DD/MM/AAAA.'), {
          placeholder: t('DD/MM/AAAA'),
          keyboardType: 'number-pad',
        })}

        <Text style={s.secao}>{t('O carro')}</Text>
        <View style={s.linha}>
          <View style={{ flex: 1 }}>{campo(t('Marca'), marca, setMarca, erros.marca, t('Obrigatório.'), { placeholder: t('Ex.: {exemplo}', { exemplo: 'Mercedes-Benz' }) })}</View>
          <View style={{ flex: 1 }}>{campo(t('Modelo'), modelo, setModelo, erros.modelo, t('Obrigatório.'), { placeholder: t('Ex.: {exemplo}', { exemplo: 'Classe E' }) })}</View>
        </View>
        <View style={s.linha}>
          <View style={{ flex: 1 }}>{campo(t('Ano'), ano, setAno, erros.ano, t('Ex.: {exemplo}', { exemplo: '2021.' }), { placeholder: '2021', keyboardType: 'number-pad', maxLength: 4 })}</View>
          <View style={{ flex: 1 }}>
            {campo(t('Matrícula'), matricula, setMatricula, erros.matricula, t('Obrigatório.'), { placeholder: 'AFK 123 MC', autoCapitalize: 'characters' })}
          </View>
        </View>
        <View style={s.linha}>
          <View style={{ flex: 1 }}>
            {campo(t('Seguro válido até'), validadeSeguro, (v) => setValidadeSeguro(mascaraData(v)), erros.validadeSeguro, t('Data futura.'), {
              placeholder: t('DD/MM/AAAA'),
              keyboardType: 'number-pad',
            })}
          </View>
          <View style={{ flex: 1 }}>
            {campo(t('Inspeção válida até'), validadeInspecao, (v) => setValidadeInspecao(mascaraData(v)), erros.validadeInspecao, t('Data futura.'), {
              placeholder: t('DD/MM/AAAA'),
              keyboardType: 'number-pad',
            })}
          </View>
        </View>

        <Text style={s.rotulo}>{t('Tipo')}</Text>
        <View style={s.opcoes}>
          {TIPOS_VIATURA.map((x) => (
            <Pressable key={x.tipo} onPress={() => setTipo(x.tipo)} style={[s.opcao, tipo === x.tipo && s.opcaoAtiva]}>
              <Text style={[s.textoOpcao, tipo === x.tipo && s.textoOpcaoAtiva]}>{t(x.tipo)}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.rotulo}>{t('Lugares para passageiros')}</Text>
        <View style={s.opcoes}>
          {LUGARES.map((n) => (
            <Pressable key={n} onPress={() => setLugares(n)} style={[s.opcao, lugares === n && s.opcaoAtiva]}>
              <Text style={[s.textoOpcao, lugares === n && s.textoOpcaoAtiva]}>{n}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.secao}>{t('Preço')}</Text>
        {campo(t('Preço por km que propões ({moeda})', { moeda: paisAtual().simbolo }), preco, setPreco, erros.preco, t('Indica o preço por km.'), {
          placeholder: t('Ex.: {exemplo}', { exemplo: TIPOS_VIATURA.find((x) => x.tipo === tipo)?.porKmMzn ?? '' }),
          keyboardType: 'number-pad',
          maxLength: 4,
        })}
        <View style={s.nota}>
          {/* Só o valor que o dono recebe; a comissão da plataforma só a vê o administrador (Flavio, 2026-10-01). */}
          <Text style={s.notaTitulo}>{t('O que recebes')}</Text>
          <Text style={s.notaTexto}>
            {Number(preco) > 0
              ? t('Exemplo: numa viagem de {km} km, recebes {teu}. O preço fica sujeito à nossa aprovação.', {
                  km: KM_EXEMPLO,
                  teu: formatarMzn(paraMzn(Number(preco)) * KM_EXEMPLO * (1 - COMISSAO)),
                })
              : t('Indica o preço por km para veres quanto recebes numa viagem. O preço fica sujeito à nossa aprovação.')}
          </Text>
        </View>

        <Text style={s.secao}>{t('Casamentos')}</Text>
        <Text style={s.ajuda}>{t('Queres alugar o carro, com motorista, para casamentos? Indica quanto cobras pelo dia do casamento.')}</Text>
        <View style={s.opcoes}>
          {[true, false].map((sim) => (
            <Pressable key={String(sim)} onPress={() => setCasamentos(sim)} style={[s.opcao, casamentos === sim && s.opcaoAtiva]}>
              <Text style={[s.textoOpcao, casamentos === sim && s.textoOpcaoAtiva]}>{sim ? t('Sim') : t('Não')}</Text>
            </Pressable>
          ))}
        </View>
        {casamentos && (
          <>
            <View style={s.linha}>
              <View style={{ flex: 1 }}>
                {campo(t('Sem decoração ({moeda})', { moeda: paisAtual().simbolo }), semDecoracao, setSemDecoracao, erros.semDecoracao, t('Indica o preço.'), {
                  placeholder: t('Ex.: {exemplo}', { exemplo: 9000 }),
                  keyboardType: 'number-pad',
                  maxLength: 6,
                })}
              </View>
              <View style={{ flex: 1 }}>
                {campo(t('Com decoração ({moeda})', { moeda: paisAtual().simbolo }), comDecoracao, setComDecoracao, erros.comDecoracao, t('Indica o preço.'), {
                  placeholder: t('Ex.: {exemplo}', { exemplo: 12500 }),
                  keyboardType: 'number-pad',
                  maxLength: 6,
                })}
              </View>
            </View>
            <Text style={s.ajuda}>{t('Com decoração, és tu que decoras o carro (flores, fitas, laços) e incluis esse custo no preço.')}</Text>
            <Pressable
              onPress={async () => {
                const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
                if (!r.canceled) setFotoDecorada(r.assets[0].uri);
              }}
              accessibilityLabel={t('Escolher foto do carro decorado')}
              style={[s.foto, { marginBottom: Spacing.two }]}>
              {fotoDecorada ? (
                <Image source={{ uri: fotoDecorada }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <View style={s.fotoVazia}>
                  <Text style={s.mais}>+</Text>
                  <Text style={s.dica}>{t('O teu carro decorado, de frente na diagonal')}</Text>
                </View>
              )}
              <View style={s.etiqueta}>
                <Text style={s.etiquetaTexto}>{t('Decorado')}</Text>
              </View>
            </Pressable>
            <Text style={s.ajuda}>{t('Opcional. É a foto que os clientes veem na opção com decoração.')}</Text>
          </>
        )}

        <Text style={s.secao}>{t('Fotos do carro')}</Text>
        <Text style={s.ajuda}>{t('Precisamos destas quatro fotos, com boa luz. A foto de frente é a que os clientes vão ver na app.')}</Text>
        <View style={s.grelha}>
          {FOTOS_PEDIDAS.map((f) => {
            const uri = fotos[f.id];
            return (
              <Pressable
                key={f.id}
                onPress={() => escolherFoto(f.id)}
                accessibilityLabel={t('Escolher foto: {foto}', { foto: t(f.nome) })}
                style={[s.foto, tentouEnviar && !uri && s.inputErro]}>
                {uri ? (
                  <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <View style={s.fotoVazia}>
                    <Text style={s.mais}>+</Text>
                    <Text style={s.dica}>{t(f.dica)}</Text>
                  </View>
                )}
                <View style={s.etiqueta}>
                  <Text style={s.etiquetaTexto}>{t(f.nome)}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        {tentouEnviar && erros.fotos && <Text style={s.erro}>{t('Faltam fotos do carro.')}</Text>}

        <View style={{ marginTop: Spacing.four }}>
          <BotaoPrincipal texto={t('Enviar inscrição')} onPress={enviar} />
        </View>
        <Text style={[s.ajuda, { textAlign: 'center', marginTop: Spacing.two }]}>{t('A inscrição só fica ativa depois da nossa aprovação.')}</Text>
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
    nota: { backgroundColor: c.backgroundElement, borderLeftWidth: 3, borderLeftColor: c.accent, borderRadius: 10, padding: Spacing.three, gap: Spacing.one },
    notaTitulo: { color: c.text, fontWeight: '700' },
    notaTexto: { color: c.textSecondary, fontSize: 13 },
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
