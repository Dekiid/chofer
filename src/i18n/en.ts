// Traduções para inglês, por área da app. A chave é o texto em português, exatamente como está no código.
import { cliente } from '@/i18n/en/cliente';
import { comum } from '@/i18n/en/comum';
import { conta } from '@/i18n/en/conta';
import { extras } from '@/i18n/en/extras';
import { motorista } from '@/i18n/en/motorista';
import { novidades } from '@/i18n/en/novidades';
import { viagem } from '@/i18n/en/viagem';

export const en: Record<string, string> = {
  ...comum,
  ...cliente,
  ...conta,
  ...motorista,
  ...viagem,
  ...extras,
  ...novidades,
};
