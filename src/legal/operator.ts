/** The operator is an individual (no company, registration or VAT). Address is supplied by the operator. */
export const OPERATOR: {
  name: string;
  country: string;
  address: string | null;
  registration: string | null;
  vat: string | null;
  contactEmail: string;
  privacyEmail: string;
} = {
  name: 'Alberto Valdes Rey',
  country: 'LU',
  address: null,
  registration: null,
  vat: null,
  contactEmail: 'alberto.valdes.rey.official@gmail.com',
  privacyEmail: 'alberto.valdes.rey.official@gmail.com',
};

export const OPERATOR_CONTACT_EMAIL: string = OPERATOR.contactEmail;
