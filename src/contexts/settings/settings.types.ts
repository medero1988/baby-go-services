export type SettingValue = Record<string, unknown> | unknown[];

export type SettingResponse = {
  id: string;
  code: string;
  value: SettingValue;
  createdAt?: string;
  updatedAt?: string;
};

export type SettingListResponse = {
  items: SettingResponse[];
};

export interface SupportedCountry {
  code: string;
  phoneCode: string;
}

export const SUPPORTED_COUNTRIES_CODE = 'supported-countries';
export const PRODUCT_TAXONOMY_CODE = 'product-taxonomy';

/** Semilla de `supported-countries` si no existe. */
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
