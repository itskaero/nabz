/**
 * Catalogue seed: brands actually prescribed in Pakistani paediatric practice.
 *
 * ============================ READ BEFORE USE ============================
 * Every row here is `provenance: 'manual'` and carries NO DRAP registration
 * number, which is the honest state of it: this is a starting vocabulary for
 * the name-autocomplete, NOT a verified extract of the DRAP registry.
 *
 * Before this ships to a real clinic, each row must be reconciled against the
 * DRAP public database and flipped to `provenance: 'DRAP'` with its
 * registration number attached -- `validateContentPack` refuses any row that
 * claims DRAP provenance without one, so the upgrade cannot be done sloppily.
 *
 * What this list is allowed to do (PRODUCT.md 11): autocomplete a NAME. It may
 * offer a strength as a suggestion the doctor confirms. It must never fill a
 * dose, a frequency or a duration, and no dosing evidence lives in this file --
 * that is a separate table, keyed on generic, and every row of it is cited.
 *
 * Grow this from usage, not from a bulk scrape. PRODUCT.md 11a is explicit that
 * scraping the Pakistani commercial catalogue sites for a monetised product is
 * a licensing problem, and their dosage text is leaflet copy, not evidence.
 * ========================================================================
 */
import type { FormularyEntry } from '@domain/pack.ts';

const m = (
  brand: string,
  generic: string,
  strength?: string,
  form?: string,
): FormularyEntry => {
  const row: FormularyEntry = { brand, generic, provenance: 'manual' };
  if (strength) row.strength = strength;
  if (form) row.form = form;
  return row;
};

export const formularySeed: FormularyEntry[] = [
  // --- analgesia / antipyresis ---------------------------------------------
  m('Panadol', 'Paracetamol', '500mg', 'tablet'),
  m('Panadol Syrup', 'Paracetamol', '120mg/5ml', 'syrup'),
  m('Panadol Drops', 'Paracetamol', '100mg/ml', 'drops'),
  m('Calpol', 'Paracetamol', '120mg/5ml', 'syrup'),
  m('Calpol Forte', 'Paracetamol', '250mg/5ml', 'syrup'),
  m('Febrol', 'Paracetamol', '120mg/5ml', 'syrup'),
  m('Provas', 'Paracetamol', '500mg', 'tablet'),
  m('Paracetamol Suppository', 'Paracetamol', '125mg', 'suppository'),
  m('Brufen', 'Ibuprofen', '400mg', 'tablet'),
  m('Brufen Syrup', 'Ibuprofen', '100mg/5ml', 'syrup'),
  m('Ibucon', 'Ibuprofen', '100mg/5ml', 'syrup'),
  m('Ponstan', 'Mefenamic acid', '250mg', 'capsule'),
  m('Ponstan Syrup', 'Mefenamic acid', '50mg/5ml', 'syrup'),
  m('Synflex', 'Naproxen sodium', '275mg', 'tablet'),

  // --- antibiotics: penicillins --------------------------------------------
  m('Amoxil', 'Amoxicillin', '125mg/5ml', 'syrup'),
  m('Amoxil', 'Amoxicillin', '250mg/5ml', 'syrup'),
  m('Amoxil', 'Amoxicillin', '250mg', 'capsule'),
  m('Amoxil', 'Amoxicillin', '500mg', 'capsule'),
  m('Amoxil Drops', 'Amoxicillin', '125mg/1.25ml', 'drops'),
  m('Augmentin', 'Amoxicillin + Clavulanic acid', '156mg/5ml', 'syrup'),
  m('Augmentin', 'Amoxicillin + Clavulanic acid', '312mg/5ml', 'syrup'),
  m('Augmentin', 'Amoxicillin + Clavulanic acid', '457mg/5ml', 'syrup'),
  m('Augmentin', 'Amoxicillin + Clavulanic acid', '625mg', 'tablet'),
  m('Calamox', 'Amoxicillin + Clavulanic acid', '312mg/5ml', 'syrup'),
  m('Curam', 'Amoxicillin + Clavulanic acid', '457mg/5ml', 'syrup'),
  m('Penbritin', 'Ampicillin', '125mg/5ml', 'syrup'),
  m('Crystapen', 'Benzylpenicillin', '1 MU', 'injection'),

  // --- antibiotics: cephalosporins -----------------------------------------
  m('Velosef', 'Cephradine', '125mg/5ml', 'syrup'),
  m('Velosef', 'Cephradine', '250mg/5ml', 'syrup'),
  m('Velosef', 'Cephradine', '500mg', 'capsule'),
  m('Cefspan', 'Cefixime', '100mg/5ml', 'syrup'),
  m('Cefspan', 'Cefixime', '400mg', 'capsule'),
  m('Cefiget', 'Cefixime', '100mg/5ml', 'syrup'),
  m('Ceclor', 'Cefaclor', '125mg/5ml', 'syrup'),
  m('Ceftum', 'Cefuroxime', '125mg/5ml', 'syrup'),
  m('Zinnat', 'Cefuroxime', '250mg', 'tablet'),
  m('Rocephin', 'Ceftriaxone', '250mg', 'injection'),
  m('Rocephin', 'Ceftriaxone', '1g', 'injection'),
  m('Fortum', 'Ceftazidime', '500mg', 'injection'),
  m('Keflex', 'Cephalexin', '125mg/5ml', 'syrup'),

  // --- antibiotics: macrolides & others ------------------------------------
  m('Azomax', 'Azithromycin', '200mg/5ml', 'syrup'),
  m('Azomax', 'Azithromycin', '250mg', 'capsule'),
  m('Zithromax', 'Azithromycin', '200mg/5ml', 'syrup'),
  m('Klaricid', 'Clarithromycin', '125mg/5ml', 'syrup'),
  m('Klaricid', 'Clarithromycin', '250mg', 'tablet'),
  m('Erythrocin', 'Erythromycin', '125mg/5ml', 'syrup'),
  m('Septran', 'Sulfamethoxazole + Trimethoprim', '240mg/5ml', 'syrup'),
  m('Septran DS', 'Sulfamethoxazole + Trimethoprim', '960mg', 'tablet'),
  m('Flagyl', 'Metronidazole', '200mg/5ml', 'suspension'),
  m('Flagyl', 'Metronidazole', '400mg', 'tablet'),
  m('Nidazole', 'Metronidazole', '200mg/5ml', 'suspension'),
  m('Vibramycin', 'Doxycycline', '100mg', 'capsule'),
  m('Ciproxin', 'Ciprofloxacin', '250mg/5ml', 'suspension'),
  m('Cravit', 'Levofloxacin', '250mg', 'tablet'),
  m('Amikin', 'Amikacin', '100mg', 'injection'),
  m('Gentamicin', 'Gentamicin', '20mg', 'injection'),

  // --- respiratory ----------------------------------------------------------
  m('Ventolin Syrup', 'Salbutamol', '2mg/5ml', 'syrup'),
  m('Ventolin Inhaler', 'Salbutamol', '100mcg/puff', 'inhaler'),
  m('Ventolin Nebules', 'Salbutamol', '2.5mg/2.5ml', 'solution'),
  m('Salbetol', 'Salbutamol', '2mg/5ml', 'syrup'),
  m('Flixotide', 'Fluticasone propionate', '50mcg/puff', 'inhaler'),
  m('Seretide', 'Fluticasone + Salmeterol', '25/50mcg', 'inhaler'),
  m('Becotide', 'Beclometasone', '50mcg/puff', 'inhaler'),
  m('Atrovent', 'Ipratropium bromide', '250mcg/ml', 'solution'),
  m('Montiget', 'Montelukast', '4mg', 'tablet'),
  m('Montiget', 'Montelukast', '5mg', 'tablet'),
  m('Singulair', 'Montelukast', '4mg', 'tablet'),
  m('Pulmicort', 'Budesonide', '0.5mg/2ml', 'solution'),
  m('Hydrillin', 'Diphenhydramine + Ammonium chloride', '', 'syrup'),
  m('Toplexil', 'Oxomemazine + Guaifenesin', '', 'syrup'),

  // --- antihistamines / allergy --------------------------------------------
  m('Zyrtec', 'Cetirizine', '5mg/5ml', 'syrup'),
  m('Zyrtec', 'Cetirizine', '10mg', 'tablet'),
  m('Softin', 'Cetirizine', '5mg/5ml', 'syrup'),
  m('Rigix', 'Cetirizine', '10mg', 'tablet'),
  m('Telfast', 'Fexofenadine', '30mg', 'tablet'),
  m('Piriton', 'Chlorpheniramine', '2mg/5ml', 'syrup'),
  m('Avil', 'Pheniramine maleate', '22.5mg/5ml', 'syrup'),
  m('Clarinase', 'Loratadine + Pseudoephedrine', '', 'tablet'),
  m('Loratin', 'Loratadine', '5mg/5ml', 'syrup'),
  m('Deltacortril', 'Prednisolone', '5mg', 'tablet'),
  m('Prednisolone Syrup', 'Prednisolone', '15mg/5ml', 'syrup'),
  m('Solu-Medrol', 'Methylprednisolone', '40mg', 'injection'),
  m('Dexa', 'Dexamethasone', '4mg/ml', 'injection'),

  // --- gastrointestinal -----------------------------------------------------
  m('Peditral', 'Oral rehydration salts', 'WHO formula', 'sachet'),
  m('Orsal', 'Oral rehydration salts', 'WHO formula', 'sachet'),
  m('ORS Sachet', 'Oral rehydration salts', 'WHO low-osmolarity', 'sachet'),
  m('Zincat', 'Zinc sulphate', '20mg/5ml', 'syrup'),
  m('Zinc-D', 'Zinc sulphate', '20mg', 'tablet'),
  m('Motilium', 'Domperidone', '5mg/5ml', 'suspension'),
  m('Gravinate', 'Dimenhydrinate', '12.5mg/4ml', 'syrup'),
  m('Risek', 'Omeprazole', '20mg', 'capsule'),
  m('Nexum', 'Esomeprazole', '20mg', 'capsule'),
  m('Zantac', 'Ranitidine', '75mg/5ml', 'syrup'),
  m('Duphalac', 'Lactulose', '3.35g/5ml', 'syrup'),
  m('Enterogermina', 'Bacillus clausii spores', '2 billion/5ml', 'solution'),
  m('Protexin', 'Probiotic (multi-strain)', '', 'sachet'),
  m('Buscopan', 'Hyoscine butylbromide', '10mg', 'tablet'),
  m('Colicaid', 'Simethicone + Dill oil', '', 'drops'),
  m('Smecta', 'Diosmectite', '3g', 'sachet'),

  // --- antiparasitic --------------------------------------------------------
  m('Vermox', 'Mebendazole', '100mg', 'tablet'),
  m('Vermox Suspension', 'Mebendazole', '100mg/5ml', 'suspension'),
  m('Zentel', 'Albendazole', '400mg', 'tablet'),
  m('Zentel Suspension', 'Albendazole', '200mg/5ml', 'suspension'),
  m('Combantrin', 'Pyrantel pamoate', '250mg/5ml', 'suspension'),
  m('Coartem', 'Artemether + Lumefantrine', '20/120mg', 'tablet'),
  m('Resochin', 'Chloroquine', '150mg', 'tablet'),

  // --- vitamins, iron, supplements -----------------------------------------
  m('Vidaylin', 'Multivitamin', '', 'syrup'),
  m('Vidaylin Drops', 'Multivitamin', '', 'drops'),
  m('Surbex-Z', 'B-complex + Zinc', '', 'tablet'),
  m('Ferrofol', 'Ferrous sulphate + Folic acid', '', 'tablet'),
  m('Sangobion', 'Iron + Vitamin B complex', '', 'capsule'),
  m('Feroglobin', 'Iron + Zinc + B vitamins', '', 'syrup'),
  m('Iberet Folic', 'Ferrous sulphate + Folic acid', '', 'tablet'),
  m('Indrop-D', 'Cholecalciferol', '400 IU/drop', 'drops'),
  m('Osnate-D', 'Calcium + Vitamin D3', '', 'tablet'),
  m('Sandoz Cal', 'Calcium carbonate + Vitamin D3', '', 'tablet'),
  m('Folic Acid', 'Folic acid', '5mg', 'tablet'),
  m('Vitamin K1', 'Phytomenadione', '1mg', 'injection'),

  // --- skin -----------------------------------------------------------------
  m('Fucidin', 'Fusidic acid', '2%', 'cream'),
  m('Polyfax', 'Polymyxin B + Bacitracin', '', 'ointment'),
  m('Betnovate', 'Betamethasone valerate', '0.1%', 'cream'),
  m('Elocon', 'Mometasone furoate', '0.1%', 'cream'),
  m('Daktarin', 'Miconazole', '2%', 'cream'),
  m('Canesten', 'Clotrimazole', '1%', 'cream'),
  m('Nizoral', 'Ketoconazole', '2%', 'solution'),
  m('Scabex', 'Permethrin', '5%', 'solution'),
  m('Calamine Lotion', 'Calamine', '', 'solution'),
  m('Dermovate', 'Clobetasol propionate', '0.05%', 'cream'),
  m('Zole-F', 'Clotrimazole + Fluocinolone', '', 'cream'),
  m('Mupirocin', 'Mupirocin', '2%', 'ointment'),

  // --- eye, ear, nose -------------------------------------------------------
  m('Tobrex', 'Tobramycin', '0.3%', 'drops'),
  m('Chloromycetin', 'Chloramphenicol', '0.5%', 'drops'),
  m('Sofradex', 'Framycetin + Dexamethasone', '', 'drops'),
  m('Otrivin Paediatric', 'Xylometazoline', '0.05%', 'drops'),
  m('Nasivion', 'Oxymetazoline', '0.025%', 'drops'),
  m('Normal Saline Nasal Drops', 'Sodium chloride', '0.9%', 'drops'),
  m('Ciplox-D', 'Ciprofloxacin + Dexamethasone', '', 'drops'),
  m('Waxsol', 'Docusate sodium', '0.5%', 'drops'),

  // --- neurology ------------------------------------------------------------
  m('Epival', 'Sodium valproate', '200mg/5ml', 'syrup'),
  m('Tegral', 'Carbamazepine', '100mg/5ml', 'suspension'),
  m('Rivotril', 'Clonazepam', '0.5mg', 'tablet'),
  m('Keppra', 'Levetiracetam', '100mg/ml', 'solution'),
  m('Diazepam Rectal', 'Diazepam', '5mg', 'solution'),
  m('Phenobarbitone', 'Phenobarbital', '20mg/5ml', 'syrup'),

  // --- misc -----------------------------------------------------------------
  m('Lasix', 'Furosemide', '10mg/ml', 'solution'),
  m('Aldactone', 'Spironolactone', '25mg', 'tablet'),
  m('Adrenaline', 'Epinephrine', '1mg/ml', 'injection'),
  m('Hydrocortisone', 'Hydrocortisone sodium succinate', '100mg', 'injection'),
  m('Nystatin Oral', 'Nystatin', '100000 units/ml', 'solution'),
  m('Miconazole Oral Gel', 'Miconazole', '2%', 'ointment'),
];

export default formularySeed;
