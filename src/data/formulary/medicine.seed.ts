/**
 * Catalogue seed: brands actually prescribed in Pakistani ADULT medicine OPD.
 *
 * ============================ READ BEFORE USE ============================
 * Same rules as the paediatric seed, restated because they matter more here
 * (this list is ~2x the size and the temptation to trust it is ~2x as strong):
 *
 * Every row is `provenance: 'manual'` and carries NO DRAP registration number.
 * That is the honest state of it: this is a starting vocabulary for the NAME
 * autocomplete, NOT a verified extract of the DRAP registry. Before this ships
 * to a real clinic every row must be reconciled against the DRAP public
 * database and flipped to `provenance: 'DRAP'` with its registration number --
 * `validateContentPack` refuses any row claiming DRAP provenance without one.
 *
 * Run these through the same reconciler that produced drap_generated.json.
 * Expect a LOWER hit rate than the paediatric run: adult brands turn over
 * faster, several below are multi-source generics with a dozen near-identical
 * DRAP entries, and a few (Warfarin, Theophylline SR, Tamsulosin, Heparin) are
 * listed by generic precisely because no single brand dominates the Pakistani
 * market. Those will come back `unresolved` and that is correct -- resolve them
 * to whatever your pharmacy actually stocks, or delete them.
 *
 * What this list is allowed to do (PRODUCT.md 11): autocomplete a NAME, and
 * offer a strength as a suggestion the doctor confirms. It must never fill a
 * dose, a frequency or a duration. No dosing evidence lives in this file.
 *
 * Strengths are the pack sizes commonly dispensed in Pakistan; where a brand
 * ships several, the common ones are listed as separate rows so autocomplete
 * offers the choice rather than guessing.
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

export const medicineFormularySeed: FormularyEntry[] = [
  // --- analgesia / antipyresis / NSAIDs ------------------------------------
  m('Panadol', 'Paracetamol', '500mg', 'tablet'),
  m('Panadol Extend', 'Paracetamol', '665mg', 'tablet'),
  m('Provas', 'Paracetamol', '500mg', 'tablet'),
  m('Paracetamol Infusion', 'Paracetamol', '1g/100ml', 'infusion'),
  m('Brufen', 'Ibuprofen', '400mg', 'tablet'),
  m('Brufen', 'Ibuprofen', '600mg', 'tablet'),
  m('Voltral', 'Diclofenac sodium', '50mg', 'tablet'),
  m('Voltral SR', 'Diclofenac sodium', '75mg', 'tablet'),
  m('Voltral', 'Diclofenac sodium', '75mg/3ml', 'injection'),
  m('Dicloran', 'Diclofenac sodium', '50mg', 'tablet'),
  m('Caflam', 'Diclofenac potassium', '50mg', 'tablet'),
  m('Ponstan', 'Mefenamic acid', '500mg', 'capsule'),
  m('Synflex', 'Naproxen sodium', '550mg', 'tablet'),
  m('Celebrex', 'Celecoxib', '200mg', 'capsule'),
  m('Arcoxia', 'Etoricoxib', '90mg', 'tablet'),
  m('Nuberol Forte', 'Paracetamol + Orphenadrine', '650/50mg', 'tablet'),
  m('Tramal', 'Tramadol', '50mg', 'capsule'),
  m('Tramal', 'Tramadol', '100mg/2ml', 'injection'),
  m('Nalbuphine', 'Nalbuphine', '10mg/ml', 'injection'),
  m('Morphine Sulphate', 'Morphine', '10mg/ml', 'injection'),

  // --- antibiotics: penicillins & beta-lactam combinations ------------------
  m('Amoxil', 'Amoxicillin', '250mg', 'capsule'),
  m('Amoxil', 'Amoxicillin', '500mg', 'capsule'),
  m('Augmentin', 'Amoxicillin + Clavulanic acid', '625mg', 'tablet'),
  m('Augmentin', 'Amoxicillin + Clavulanic acid', '1g', 'tablet'),
  m('Augmentin IV', 'Amoxicillin + Clavulanic acid', '1.2g', 'injection'),
  m('Calamox', 'Amoxicillin + Clavulanic acid', '625mg', 'tablet'),
  m('Curam', 'Amoxicillin + Clavulanic acid', '1g', 'tablet'),
  m('Ampiclox', 'Ampicillin + Cloxacillin', '500mg', 'capsule'),
  m('Orbenin', 'Cloxacillin', '500mg', 'capsule'),
  m('Tazocin', 'Piperacillin + Tazobactam', '4.5g', 'injection'),
  m('Crystapen', 'Benzylpenicillin', '1 MU', 'injection'),
  m('Penidure LA', 'Benzathine benzylpenicillin', '1.2 MU', 'injection'),

  // --- antibiotics: cephalosporins ------------------------------------------
  m('Velosef', 'Cephradine', '500mg', 'capsule'),
  m('Keflex', 'Cephalexin', '500mg', 'capsule'),
  m('Zinnat', 'Cefuroxime', '250mg', 'tablet'),
  m('Zinnat', 'Cefuroxime', '500mg', 'tablet'),
  m('Cefspan', 'Cefixime', '400mg', 'capsule'),
  m('Cefiget', 'Cefixime', '400mg', 'capsule'),
  m('Rocephin', 'Ceftriaxone', '1g', 'injection'),
  m('Oxidil', 'Ceftriaxone', '1g', 'injection'),
  m('Fortum', 'Ceftazidime', '1g', 'injection'),
  m('Sulzone', 'Cefoperazone + Sulbactam', '1.5g', 'injection'),
  m('Maxipime', 'Cefepime', '1g', 'injection'),

  // --- antibiotics: macrolides, quinolones, others ---------------------------
  m('Azomax', 'Azithromycin', '250mg', 'capsule'),
  m('Azomax', 'Azithromycin', '500mg', 'tablet'),
  m('Zithromax', 'Azithromycin', '500mg', 'tablet'),
  m('Klaricid', 'Clarithromycin', '250mg', 'tablet'),
  m('Klaricid', 'Clarithromycin', '500mg', 'tablet'),
  m('Erythrocin', 'Erythromycin', '250mg', 'tablet'),
  m('Ciproxin', 'Ciprofloxacin', '500mg', 'tablet'),
  m('Novidat', 'Ciprofloxacin', '500mg', 'tablet'),
  m('Cravit', 'Levofloxacin', '500mg', 'tablet'),
  m('Leflox', 'Levofloxacin', '500mg', 'tablet'),
  m('Avelox', 'Moxifloxacin', '400mg', 'tablet'),
  m('Vibramycin', 'Doxycycline', '100mg', 'capsule'),
  m('Septran DS', 'Sulfamethoxazole + Trimethoprim', '960mg', 'tablet'),
  m('Flagyl', 'Metronidazole', '400mg', 'tablet'),
  m('Flagyl IV', 'Metronidazole', '500mg/100ml', 'infusion'),
  m('Uvamin Retard', 'Nitrofurantoin', '100mg', 'capsule'),
  m('Monurol', 'Fosfomycin trometamol', '3g', 'sachet'),
  m('Dalacin C', 'Clindamycin', '300mg', 'capsule'),
  m('Amikin', 'Amikacin', '500mg', 'injection'),
  m('Gentamicin', 'Gentamicin', '80mg', 'injection'),
  m('Vancomycin', 'Vancomycin', '500mg', 'injection'),
  m('Zyvox', 'Linezolid', '600mg', 'tablet'),
  m('Meronem', 'Meropenem', '1g', 'injection'),
  m('Tienam', 'Imipenem + Cilastatin', '500mg', 'injection'),

  // --- anti-tuberculous -----------------------------------------------------
  m('Myrin-P Forte', 'Rifampicin + Isoniazid + Pyrazinamide + Ethambutol', '150/75/400/275mg', 'tablet'),
  m('Rimactazid', 'Rifampicin + Isoniazid', '150/75mg', 'tablet'),
  m('Rifadin', 'Rifampicin', '300mg', 'capsule'),
  m('Isoniazid', 'Isoniazid', '300mg', 'tablet'),
  m('Myambutol', 'Ethambutol', '400mg', 'tablet'),
  m('Pyrazinamide', 'Pyrazinamide', '500mg', 'tablet'),
  m('Streptomycin', 'Streptomycin', '1g', 'injection'),
  m('Pyridoxine', 'Pyridoxine (Vitamin B6)', '50mg', 'tablet'),

  // --- antimalarial / antiparasitic / antiviral / antifungal ----------------
  m('Coartem', 'Artemether + Lumefantrine', '20/120mg', 'tablet'),
  m('Artem', 'Artemether', '80mg/ml', 'injection'),
  m('Resochin', 'Chloroquine', '150mg', 'tablet'),
  m('Primaquine', 'Primaquine', '15mg', 'tablet'),
  m('Zentel', 'Albendazole', '400mg', 'tablet'),
  m('Vermox', 'Mebendazole', '100mg', 'tablet'),
  m('Zovirax', 'Aciclovir', '400mg', 'tablet'),
  m('Zovirax', 'Aciclovir', '800mg', 'tablet'),
  m('Valtrex', 'Valaciclovir', '500mg', 'tablet'),
  m('Diflucan', 'Fluconazole', '150mg', 'capsule'),
  m('Sporanox', 'Itraconazole', '100mg', 'capsule'),
  m('Lamisil', 'Terbinafine', '250mg', 'tablet'),
  m('Nizoral', 'Ketoconazole', '2%', 'shampoo'),

  // --- cardiovascular: antihypertensives ------------------------------------
  m('Norvasc', 'Amlodipine', '5mg', 'tablet'),
  m('Norvasc', 'Amlodipine', '10mg', 'tablet'),
  m('Herbesser', 'Diltiazem', '60mg', 'tablet'),
  m('Isoptin', 'Verapamil', '80mg', 'tablet'),
  m('Zestril', 'Lisinopril', '10mg', 'tablet'),
  m('Capoten', 'Captopril', '25mg', 'tablet'),
  m('Renitec', 'Enalapril', '5mg', 'tablet'),
  m('Zaart', 'Losartan', '50mg', 'tablet'),
  m('Zaart-H', 'Losartan + Hydrochlorothiazide', '50/12.5mg', 'tablet'),
  m('Micardis', 'Telmisartan', '40mg', 'tablet'),
  m('Micardis', 'Telmisartan', '80mg', 'tablet'),
  m('Diovan', 'Valsartan', '80mg', 'tablet'),
  m('Co-Diovan', 'Valsartan + Hydrochlorothiazide', '80/12.5mg', 'tablet'),
  m('Concor', 'Bisoprolol', '2.5mg', 'tablet'),
  m('Concor', 'Bisoprolol', '5mg', 'tablet'),
  m('Tenormin', 'Atenolol', '50mg', 'tablet'),
  m('Betaloc', 'Metoprolol', '50mg', 'tablet'),
  m('Dilatrend', 'Carvedilol', '6.25mg', 'tablet'),
  m('Inderal', 'Propranolol', '10mg', 'tablet'),
  m('Inderal', 'Propranolol', '40mg', 'tablet'),
  m('Hydrochlorothiazide', 'Hydrochlorothiazide', '25mg', 'tablet'),
  m('Natrilix SR', 'Indapamide', '1.5mg', 'tablet'),
  m('Aldomet', 'Methyldopa', '250mg', 'tablet'),
  m('Minipress', 'Prazosin', '1mg', 'tablet'),

  // --- cardiovascular: ischaemia, failure, rhythm, lipids -------------------
  m('Loprin', 'Aspirin', '75mg', 'tablet'),
  m('Ascard', 'Aspirin', '75mg', 'tablet'),
  m('Disprin', 'Aspirin', '300mg', 'tablet'),
  m('Plavix', 'Clopidogrel', '75mg', 'tablet'),
  m('Brilinta', 'Ticagrelor', '90mg', 'tablet'),
  m('Angised', 'Glyceryl trinitrate', '0.5mg', 'sublingual tablet'),
  m('Imdur', 'Isosorbide mononitrate', '60mg', 'tablet'),
  m('Isordil', 'Isosorbide dinitrate', '5mg', 'sublingual tablet'),
  m('Lipitor', 'Atorvastatin', '10mg', 'tablet'),
  m('Lipitor', 'Atorvastatin', '20mg', 'tablet'),
  m('Lipiget', 'Atorvastatin', '20mg', 'tablet'),
  m('Crestor', 'Rosuvastatin', '10mg', 'tablet'),
  m('Zocor', 'Simvastatin', '20mg', 'tablet'),
  m('Lipanthyl', 'Fenofibrate', '160mg', 'tablet'),
  m('Lasix', 'Furosemide', '40mg', 'tablet'),
  m('Lasix', 'Furosemide', '20mg/2ml', 'injection'),
  m('Aldactone', 'Spironolactone', '25mg', 'tablet'),
  m('Lanoxin', 'Digoxin', '0.25mg', 'tablet'),
  m('Cordarone', 'Amiodarone', '200mg', 'tablet'),
  m('Warfarin', 'Warfarin sodium', '5mg', 'tablet'),
  m('Clexane', 'Enoxaparin', '40mg/0.4ml', 'injection'),
  m('Clexane', 'Enoxaparin', '60mg/0.6ml', 'injection'),
  m('Heparin', 'Heparin sodium', '5000 IU/ml', 'injection'),
  m('Xarelto', 'Rivaroxaban', '20mg', 'tablet'),
  m('Eliquis', 'Apixaban', '5mg', 'tablet'),

  // --- endocrine: diabetes ---------------------------------------------------
  m('Glucophage', 'Metformin', '500mg', 'tablet'),
  m('Glucophage', 'Metformin', '850mg', 'tablet'),
  m('Glucophage XR', 'Metformin', '500mg', 'tablet'),
  m('Neodipar', 'Metformin', '500mg', 'tablet'),
  m('Diamicron MR', 'Gliclazide', '30mg', 'tablet'),
  m('Diamicron MR', 'Gliclazide', '60mg', 'tablet'),
  m('Amaryl', 'Glimepiride', '2mg', 'tablet'),
  m('Getryl', 'Glimepiride', '2mg', 'tablet'),
  m('Daonil', 'Glibenclamide', '5mg', 'tablet'),
  m('Januvia', 'Sitagliptin', '100mg', 'tablet'),
  m('Galvus', 'Vildagliptin', '50mg', 'tablet'),
  m('Jardiance', 'Empagliflozin', '10mg', 'tablet'),
  m('Forxiga', 'Dapagliflozin', '10mg', 'tablet'),
  m('Humulin R', 'Insulin human (soluble)', '100 IU/ml', 'injection'),
  m('Humulin N', 'Insulin human (isophane)', '100 IU/ml', 'injection'),
  m('Humulin 70/30', 'Insulin human (biphasic isophane)', '100 IU/ml', 'injection'),
  m('Mixtard 30 HM', 'Insulin human (biphasic isophane)', '100 IU/ml', 'injection'),
  m('Novomix 30', 'Insulin aspart (biphasic)', '100 IU/ml', 'injection'),
  m('NovoRapid', 'Insulin aspart', '100 IU/ml', 'injection'),
  m('Lantus', 'Insulin glargine', '100 IU/ml', 'injection'),
  m('Glucose 25%', 'Dextrose', '25%', 'injection'),

  // --- endocrine: thyroid, bone, steroids -----------------------------------
  m('Eltroxin', 'Levothyroxine', '50mcg', 'tablet'),
  m('Eltroxin', 'Levothyroxine', '100mcg', 'tablet'),
  m('Thyronorm', 'Levothyroxine', '25mcg', 'tablet'),
  m('Neo-Mercazole', 'Carbimazole', '5mg', 'tablet'),
  m('Propylthiouracil', 'Propylthiouracil', '50mg', 'tablet'),
  m('Deltacortril', 'Prednisolone', '5mg', 'tablet'),
  m('Solu-Medrol', 'Methylprednisolone', '500mg', 'injection'),
  m('Dexa', 'Dexamethasone', '4mg/ml', 'injection'),
  m('Hydrocortisone', 'Hydrocortisone sodium succinate', '100mg', 'injection'),
  m('Fludrocortisone', 'Fludrocortisone', '0.1mg', 'tablet'),
  m('CAC-1000 Plus', 'Calcium + Vitamin C + Vitamin D3', '', 'effervescent tablet'),
  m('Osnate-D', 'Calcium + Vitamin D3', '', 'tablet'),
  m('Qalsan-D', 'Calcium carbonate + Vitamin D3', '', 'chewable tablet'),
  m('Indrop-D', 'Cholecalciferol', '200000 IU/ml', 'injection'),
  m('Fosamax', 'Alendronate', '70mg', 'tablet'),
  m('Alfacalcidol', 'Alfacalcidol', '0.25mcg', 'capsule'),

  // --- respiratory -----------------------------------------------------------
  m('Ventolin Inhaler', 'Salbutamol', '100mcg/puff', 'inhaler'),
  m('Ventolin Nebules', 'Salbutamol', '2.5mg/2.5ml', 'solution'),
  m('Atrovent', 'Ipratropium bromide', '250mcg/ml', 'solution'),
  m('Seretide', 'Fluticasone + Salmeterol', '250/25mcg', 'inhaler'),
  m('Symbicort', 'Budesonide + Formoterol', '160/4.5mcg', 'inhaler'),
  m('Flixotide', 'Fluticasone propionate', '125mcg/puff', 'inhaler'),
  m('Pulmicort', 'Budesonide', '0.5mg/2ml', 'solution'),
  m('Spiriva', 'Tiotropium bromide', '18mcg', 'inhalation capsule'),
  m('Montiget', 'Montelukast', '10mg', 'tablet'),
  m('Singulair', 'Montelukast', '10mg', 'tablet'),
  m('Theophylline SR', 'Theophylline', '200mg', 'tablet'),
  m('Mucolator', 'Acetylcysteine', '200mg', 'sachet'),
  m('Ambrolex', 'Ambroxol', '30mg/5ml', 'syrup'),
  m('Sinecod', 'Butamirate citrate', '50mg', 'tablet'),

  // --- antihistamines / allergy ---------------------------------------------
  m('Zyrtec', 'Cetirizine', '10mg', 'tablet'),
  m('Softin', 'Cetirizine', '10mg', 'tablet'),
  m('Rigix', 'Cetirizine', '10mg', 'tablet'),
  m('Telfast', 'Fexofenadine', '120mg', 'tablet'),
  m('Loratin', 'Loratadine', '10mg', 'tablet'),
  m('Clarinase', 'Loratadine + Pseudoephedrine', '', 'tablet'),
  m('Avil', 'Pheniramine maleate', '45.5mg/2ml', 'injection'),
  m('Piriton', 'Chlorpheniramine', '4mg', 'tablet'),
  m('Adrenaline', 'Epinephrine', '1mg/ml', 'injection'),

  // --- gastrointestinal ------------------------------------------------------
  m('Risek', 'Omeprazole', '20mg', 'capsule'),
  m('Risek', 'Omeprazole', '40mg', 'capsule'),
  m('Risek IV', 'Omeprazole', '40mg', 'injection'),
  m('Nexum', 'Esomeprazole', '40mg', 'capsule'),
  m('Zoltra', 'Pantoprazole', '40mg', 'tablet'),
  m('Zantac', 'Ranitidine', '150mg', 'tablet'),
  m('Gaviscon', 'Sodium alginate + Antacid', '', 'suspension'),
  m('Mucaine', 'Oxethazaine + Antacid', '', 'suspension'),
  m('Motilium', 'Domperidone', '10mg', 'tablet'),
  m('Maxolon', 'Metoclopramide', '10mg', 'tablet'),
  m('Onseron', 'Ondansetron', '8mg', 'tablet'),
  m('Zofran', 'Ondansetron', '4mg/2ml', 'injection'),
  m('Buscopan', 'Hyoscine butylbromide', '10mg', 'tablet'),
  m('Colofac', 'Mebeverine', '135mg', 'tablet'),
  m('Librax', 'Chlordiazepoxide + Clidinium', '', 'tablet'),
  m('Imodium', 'Loperamide', '2mg', 'capsule'),
  m('Duphalac', 'Lactulose', '3.35g/5ml', 'syrup'),
  m('Laxoberon', 'Sodium picosulfate', '7.5mg/ml', 'drops'),
  m('Peditral', 'Oral rehydration salts', 'WHO low-osmolarity', 'sachet'),
  m('Enterogermina', 'Bacillus clausii spores', '2 billion/5ml', 'solution'),
  m('Ursofalk', 'Ursodeoxycholic acid', '250mg', 'capsule'),
  m('Hepamerz', 'L-Ornithine L-Aspartate', '3g', 'sachet'),
  m('Rifagut', 'Rifaximin', '550mg', 'tablet'),
  m('Mesacol', 'Mesalazine', '400mg', 'tablet'),

  // --- neurology / psychiatry ------------------------------------------------
  m('Tegral', 'Carbamazepine', '200mg', 'tablet'),
  m('Epival', 'Sodium valproate', '500mg', 'tablet'),
  m('Keppra', 'Levetiracetam', '500mg', 'tablet'),
  m('Dilantin', 'Phenytoin', '100mg', 'capsule'),
  m('Phenobarbitone', 'Phenobarbital', '30mg', 'tablet'),
  m('Rivotril', 'Clonazepam', '0.5mg', 'tablet'),
  m('Valium', 'Diazepam', '5mg', 'tablet'),
  m('Diazepam', 'Diazepam', '10mg/2ml', 'injection'),
  m('Xanax', 'Alprazolam', '0.25mg', 'tablet'),
  m('Lexotanil', 'Bromazepam', '3mg', 'tablet'),
  m('Lyrica', 'Pregabalin', '75mg', 'capsule'),
  m('Neurontin', 'Gabapentin', '300mg', 'capsule'),
  m('Tryptanol', 'Amitriptyline', '25mg', 'tablet'),
  m('Prozac', 'Fluoxetine', '20mg', 'capsule'),
  m('Zoloft', 'Sertraline', '50mg', 'tablet'),
  m('Cipralex', 'Escitalopram', '10mg', 'tablet'),
  m('Betaserc', 'Betahistine', '16mg', 'tablet'),
  m('Stemetil', 'Prochlorperazine', '5mg', 'tablet'),
  m('Sibelium', 'Flunarizine', '5mg', 'capsule'),
  m('Imigran', 'Sumatriptan', '50mg', 'tablet'),
  m('Neurobion', 'Vitamin B1 + B6 + B12', '', 'tablet'),
  m('Neurobion Injection', 'Vitamin B1 + B6 + B12', '', 'injection'),
  m('Artane', 'Trihexyphenidyl', '2mg', 'tablet'),
  m('Madopar', 'Levodopa + Benserazide', '250mg', 'tablet'),

  // --- rheumatology / gout ---------------------------------------------------
  m('Zyloric', 'Allopurinol', '100mg', 'tablet'),
  m('Zyloric', 'Allopurinol', '300mg', 'tablet'),
  m('Feburic', 'Febuxostat', '40mg', 'tablet'),
  m('Colchicine', 'Colchicine', '0.5mg', 'tablet'),
  m('Methotrexate', 'Methotrexate', '2.5mg', 'tablet'),
  m('Plaquenil', 'Hydroxychloroquine', '200mg', 'tablet'),
  m('Salazopyrin', 'Sulfasalazine', '500mg', 'tablet'),
  m('Folic Acid', 'Folic acid', '5mg', 'tablet'),

  // --- renal / urology -------------------------------------------------------
  m('Tamsulosin', 'Tamsulosin', '0.4mg', 'capsule'),
  m('Xatral XL', 'Alfuzosin', '10mg', 'tablet'),
  m('Proscar', 'Finasteride', '5mg', 'tablet'),
  m('Urispas', 'Flavoxate', '200mg', 'tablet'),
  m('Ditropan', 'Oxybutynin', '5mg', 'tablet'),
  m('Sodium Bicarbonate', 'Sodium bicarbonate', '500mg', 'tablet'),
  m('Resonium A', 'Sodium polystyrene sulfonate', '', 'powder'),
  m('Renasave', 'Calcium acetate', '667mg', 'tablet'),
  m('Recormon', 'Epoetin beta', '4000 IU', 'injection'),

  // --- haematinics, vitamins, supplements ------------------------------------
  m('Ferrofol', 'Ferrous sulphate + Folic acid', '', 'tablet'),
  m('Fefol', 'Ferrous sulphate + Folic acid', '', 'capsule'),
  m('Sangobion', 'Iron + Vitamin B complex', '', 'capsule'),
  m('Feroglobin', 'Iron + Zinc + B vitamins', '', 'syrup'),
  m('Venofer', 'Iron sucrose', '100mg/5ml', 'injection'),
  m('Surbex-Z', 'B-complex + Zinc', '', 'tablet'),
  m('Vitamin K1', 'Phytomenadione', '10mg', 'injection'),
  m('Ascorbic Acid', 'Vitamin C', '500mg', 'tablet'),
  m('Potassium Chloride', 'Potassium chloride', '600mg', 'tablet'),
  m('Magnesium Sulphate', 'Magnesium sulphate', '50%', 'injection'),

  // --- skin -------------------------------------------------------------------
  m('Fucidin', 'Fusidic acid', '2%', 'cream'),
  m('Mupirocin', 'Mupirocin', '2%', 'ointment'),
  m('Betnovate', 'Betamethasone valerate', '0.1%', 'cream'),
  m('Elocon', 'Mometasone furoate', '0.1%', 'cream'),
  m('Dermovate', 'Clobetasol propionate', '0.05%', 'cream'),
  m('Daktarin', 'Miconazole', '2%', 'cream'),
  m('Canesten', 'Clotrimazole', '1%', 'cream'),
  m('Scabex', 'Permethrin', '5%', 'solution'),
  m('Calamine Lotion', 'Calamine', '', 'solution'),
  m('Silver Sulphadiazine', 'Silver sulfadiazine', '1%', 'cream'),
  m('Emollient Cream', 'White soft paraffin + Liquid paraffin', '', 'cream'),

  // --- eye, ear, nose ----------------------------------------------------------
  m('Tobrex', 'Tobramycin', '0.3%', 'drops'),
  m('Chloromycetin', 'Chloramphenicol', '0.5%', 'drops'),
  m('Refresh Tears', 'Carboxymethylcellulose', '0.5%', 'drops'),
  m('Sofradex', 'Framycetin + Dexamethasone', '', 'drops'),
  m('Ciplox-D', 'Ciprofloxacin + Dexamethasone', '', 'drops'),
  m('Otrivin', 'Xylometazoline', '0.1%', 'drops'),
  m('Normal Saline Nasal Drops', 'Sodium chloride', '0.9%', 'drops'),
  m('Flixonase', 'Fluticasone propionate', '50mcg/spray', 'nasal spray'),

  // --- intravenous fluids -------------------------------------------------------
  m('Normal Saline', 'Sodium chloride', '0.9%', 'infusion'),
  m('Ringer Lactate', "Compound sodium lactate (Ringer's lactate)", '', 'infusion'),
  m('Dextrose Water', 'Dextrose', '5%', 'infusion'),
  m('Dextrose Saline', 'Dextrose 5% + Sodium chloride 0.9%', '', 'infusion'),
];

export default medicineFormularySeed;
