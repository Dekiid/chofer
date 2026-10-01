// Traduções para inglês, por área da app. A chave é o texto em português, exatamente como está no código.
import { cliente } from '@/i18n/en/cliente';
import { comum } from '@/i18n/en/comum';
import { motorista } from '@/i18n/en/motorista';
import { viagem } from '@/i18n/en/viagem';

export const en: Record<string, string> = {
  ...comum,
  ...cliente,
  ...motorista,
  ...viagem,
};
