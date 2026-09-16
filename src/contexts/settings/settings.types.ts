export interface SupportedCountry {
  code: string;
  phoneCode: string;
}

/** Semilla usada por el seeder si no existe el documento `settings`. */
export const DEFAULT_SUPPORTED_COUNTRIES: SupportedCountry[] = [
  { code: 'NL', phoneCode: '+31' },
  { code: 'ES', phoneCode: '+34' },
  { code: 'IT', phoneCode: '+39' },
  { code: 'DE', phoneCode: '+49' },
  { code: 'BE', phoneCode: '+32' },
  { code: 'UK', phoneCode: '+44' },
  { code: 'PT', phoneCode: '+351' },
  { code: 'FR', phoneCode: '+33' },
];
