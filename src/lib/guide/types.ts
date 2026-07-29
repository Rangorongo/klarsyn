// A structured, ordered filing guide for one deduction — never free text,
// so it can be rendered consistently and (later) language-polished by AI
// without risking the facts themselves.
export interface GuideStep {
  // Box/bilaga reference in Skatteverket's declaration.
  ruta: string;
  // Documents the user should gather/keep in case of a query.
  dokumentationskrav: string[];
  // Ordered, concrete steps.
  steg: string[];
}
