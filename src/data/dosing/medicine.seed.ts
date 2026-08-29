/**
 * ADULT dosing evidence, keyed by GENERIC. Same contract as the paediatric
 * dosing seed: joined to the catalogue on generic, every row cited, every row
 * confirmed by the doctor at the point of prescribing (rule 3.2).
 *
 * ============================ READ BEFORE USE ============================
 * WHAT THIS FILE IS: a starter set drawn ONLY from WHO's openly licensed adult
 * references -- the exception PRODUCT.md 11a names. Nothing here comes from
 * BNF, Davidson's, Harrison's, Oxford Handbook, Lexicomp or Micromedex. Those
 * are consult-and-cite: a clinician reads the reference, authors the entry in
 * their own words, and stores the citation. Bulk-copying their tables is a
 * licensing violation and this file must never become that.
 *
 * WHY EVERY ROW IS `verified: false`: nobody has done the clinician
 * verification PRODUCT.md 11a requires. These rows exist to prove the citation
 * pipeline and give the cited-suggestion UI something real to show. The UI
 * labels them unverified. They are NOT a substitute for the pack author working
 * through their own references and flipping `verified` row by row.
 *
 * ------------------------- SCHEMA NOTE -----------------------------------
 * Paediatric dosing is mostly mg/kg; ADULT dosing is mostly a fixed regimen,
 * so rows below carry that via `DosingEntry.fixedDose` -- a real field now,
 * rendered by MedicationsSection.tsx alongside `mgPerKg`.
 *
 * `maxPerDay` carries a TRUE ceiling only where one exists, `note` carries the
 * practical text, and `mgPerKg` is used only where the drug really is
 * weight-based in adults (TB drugs, enoxaparin, prednisolone, primaquine).
 * `maxPerDay` is NOT abused to smuggle in a regimen -- that would print a
 * wrong label on a real prescription.
 * ========================================================================
 */
import type { DosingEntry } from '@domain/pack.ts';

const WMF = 'WHO Model Formulary 2008 (WHO, openly available)';
const AWARE =
  'The WHO AWaRe (Access, Watch, Reserve) antibiotic book (WHO, 2022), CC BY-NC-SA 3.0 IGO';
const PEN =
  'WHO Package of Essential Noncommunicable Disease Interventions for Primary Health Care (WHO PEN), 2020';
const HEARTS =
  'HEARTS technical package for cardiovascular disease management in primary health care (WHO, 2020)';
const TB_M4 =
  'WHO consolidated guidelines on tuberculosis. Module 4: treatment - drug-susceptible tuberculosis treatment (WHO, 2022)';
const MALARIA = 'WHO Guidelines for malaria (WHO, 2023)';
const ANAEMIA =
  'WHO Guideline: Daily iron supplementation in adult women and adolescent girls (WHO, 2016)';
const EML =
  'WHO Model List of Essential Medicines, 23rd list (2023)';

/** Every adult row shares this age band; written once so it reads honestly. */
const ADULT = { fromDays: 6570, label: '18 years and over' };

export const medicineDosingSeed: DosingEntry[] = [
  // ===================== analgesia / antipyresis =========================
  {
    generic: 'Paracetamol',
    indication: 'Fever or mild-to-moderate pain',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '500 mg to 1 g every 4 to 6 hours',
    maxPerDay: '4 g in 24 hours',
    reference: `${WMF}, section 2.1 (non-opioid analgesics), paracetamol`,
    verified: false,
    note: 'Reduce the ceiling in chronic liver disease, malnutrition or low body weight. Check every other product the patient is taking for hidden paracetamol before adding this.',
  },
  {
    generic: 'Ibuprofen',
    indication: 'Fever, pain or inflammation',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '200 to 400 mg every 6 to 8 hours, with food',
    maxPerDay: '2.4 g in 24 hours',
    reference: `${WMF}, section 2.1, ibuprofen`,
    verified: false,
    note: 'Avoid in peptic ulcer, CKD, heart failure, dehydration and in the third trimester. Very high-risk combination with an ACE inhibitor/ARB plus a diuretic.',
  },
  {
    generic: 'Diclofenac sodium',
    indication: 'Pain or inflammation',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '50 mg two to three times daily, with food',
    maxPerDay: '150 mg in 24 hours',
    reference: `${WMF}, section 2.1, diclofenac`,
    verified: false,
    note: 'Highest cardiovascular risk of the common NSAIDs. Same renal and GI cautions as ibuprofen.',
  },
  {
    generic: 'Tramadol',
    indication: 'Moderate to severe pain',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '50 to 100 mg every 4 to 6 hours',
    maxPerDay: '400 mg in 24 hours',
    reference: `${WMF}, section 2.2 (opioid analgesics), tramadol`,
    verified: false,
    note: 'Lowers the seizure threshold. Serotonin syndrome risk with SSRIs. Reduce the dose in renal or hepatic impairment and in the elderly.',
  },

  // ===================== antibiotics: Access group =======================
  {
    generic: 'Amoxicillin',
    indication: 'Community-acquired pneumonia (mild, outpatient)',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '1 g every 8 hours for 5 days',
    reference: `${AWARE}, community-acquired pneumonia (mild), first choice`,
    verified: false,
    note: 'Different indications use different doses and durations. Confirm the indication before accepting this row.',
  },
  {
    generic: 'Amoxicillin + Clavulanic acid',
    indication: 'Community-acquired pneumonia (moderate) or aspiration',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '875/125 mg every 12 hours, or 500/125 mg every 8 hours, for 5 days',
    reference: `${AWARE}, community-acquired pneumonia, amoxicillin+clavulanic acid`,
    verified: false,
  },
  {
    generic: 'Azithromycin',
    indication: 'Atypical pneumonia or as add-on to a beta-lactam',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '500 mg once daily for 3 days',
    reference: `${AWARE}, macrolides, azithromycin (adult)`,
    verified: false,
    note: 'QT prolongation; check for other QT-prolonging drugs.',
  },
  {
    generic: 'Doxycycline',
    indication: 'Atypical pneumonia, exacerbation of COPD, rickettsial illness',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '100 mg every 12 hours',
    reference: `${AWARE}, doxycycline (adult)`,
    verified: false,
    note: 'Take with a full glass of water and stay upright for 30 minutes. Avoid in pregnancy.',
  },
  {
    generic: 'Sulfamethoxazole + Trimethoprim',
    indication: 'Urinary tract infection or as directed by sensitivity',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '960 mg (800/160 mg) every 12 hours',
    reference: `${AWARE}, co-trimoxazole (adult)`,
    verified: false,
    note: 'Hyperkalaemia and rising creatinine, especially with an ACE inhibitor/ARB. Avoid in G6PD deficiency and late pregnancy.',
  },
  {
    generic: 'Nitrofurantoin',
    indication: 'Uncomplicated lower urinary tract infection (cystitis)',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '100 mg every 12 hours for 5 days',
    reference: `${AWARE}, lower urinary tract infection, first choice`,
    verified: false,
    note: 'Not for pyelonephritis and not if eGFR is low - it does not reach therapeutic tissue levels. Avoid at term in pregnancy.',
  },
  {
    generic: 'Metronidazole',
    indication: 'Anaerobic or protozoal infection',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '400 to 500 mg every 8 hours',
    reference: `${AWARE}, metronidazole (adult)`,
    verified: false,
    note: 'Metallic taste and nausea are common and lead to non-adherence - warn the patient. Avoid alcohol.',
  },
  {
    generic: 'Ceftriaxone',
    indication: 'Severe community-acquired infection requiring parenteral therapy',
    route: 'IV/IM',
    ageBand: ADULT,
    fixedDose: '1 to 2 g once daily',
    reference: `${AWARE}, ceftriaxone (adult), Watch group`,
    verified: false,
    note: 'Watch group - de-escalate to a narrower oral agent as soon as the culture allows. Do not co-infuse with calcium-containing fluids.',
  },
  {
    generic: 'Ciprofloxacin',
    indication: 'Pyelonephritis or as directed by sensitivity',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '500 mg every 12 hours',
    reference: `${AWARE}, ciprofloxacin (adult), Watch group`,
    verified: false,
    note: 'Watch group. Tendon rupture, aortic aneurysm and QT risk. Separate from calcium, iron, zinc and antacids by at least 2 hours or absorption fails.',
  },

  // ===================== tuberculosis (weight-based) =====================
  {
    generic: 'Isoniazid',
    indication: 'Drug-susceptible tuberculosis, intensive and continuation phase',
    route: 'oral',
    mgPerKg: 5,
    perDoses: 1,
    ageBand: ADULT,
    maxPerDay: '300 mg',
    reference: `${TB_M4}, adult daily dosing (range 4-6 mg/kg)`,
    verified: false,
    note: 'In practice given as a fixed-dose combination by weight band, not as a calculated single-drug dose. Add pyridoxine to prevent peripheral neuropathy.',
  },
  {
    generic: 'Rifampicin',
    indication: 'Drug-susceptible tuberculosis, intensive and continuation phase',
    route: 'oral',
    mgPerKg: 10,
    perDoses: 1,
    ageBand: ADULT,
    maxPerDay: '600 mg',
    reference: `${TB_M4}, adult daily dosing (range 8-12 mg/kg)`,
    verified: false,
    note: 'Warn about orange urine and tears. Powerful enzyme inducer: oral contraceptives, warfarin, sulfonylureas and many others become unreliable.',
  },
  {
    generic: 'Pyrazinamide',
    indication: 'Drug-susceptible tuberculosis, intensive phase',
    route: 'oral',
    mgPerKg: 25,
    perDoses: 1,
    ageBand: ADULT,
    reference: `${TB_M4}, adult daily dosing (range 20-30 mg/kg)`,
    verified: false,
    note: 'Raises uric acid and can precipitate gout. Hepatotoxic.',
  },
  {
    generic: 'Ethambutol',
    indication: 'Drug-susceptible tuberculosis, intensive phase',
    route: 'oral',
    mgPerKg: 15,
    perDoses: 1,
    ageBand: ADULT,
    reference: `${TB_M4}, adult daily dosing (range 15-20 mg/kg)`,
    verified: false,
    note: 'Optic neuritis: check colour vision and acuity at baseline and tell the patient to stop and report any visual change.',
  },
  {
    generic: 'Pyridoxine (Vitamin B6)',
    indication: 'Prevention of isoniazid-induced peripheral neuropathy',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '25 mg once daily throughout isoniazid treatment',
    reference: `${TB_M4}, pyridoxine co-administration with isoniazid`,
    verified: false,
  },

  // ===================== malaria =========================================
  {
    generic: 'Artemether + Lumefantrine',
    indication: 'Uncomplicated falciparum malaria',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '4 tablets (80/480 mg) twice daily for 3 days, for body weight 35 kg and over',
    reference: `${MALARIA}, treatment of uncomplicated P. falciparum malaria, artemether-lumefantrine`,
    verified: false,
    note: 'Absorption depends on fat - give with milk or a fatty meal. Six doses total: 0, 8, 24, 36, 48 and 60 hours.',
  },
  {
    generic: 'Primaquine',
    indication: 'Radical cure of P. vivax or P. ovale (anti-relapse)',
    route: 'oral',
    mgPerKg: 0.25,
    perDoses: 1,
    ageBand: ADULT,
    reference: `${MALARIA}, radical cure of P. vivax and P. ovale, 14-day primaquine regimen`,
    verified: false,
    note: 'HAEMOLYSIS RISK: test G6PD status before starting wherever testing is available. Contraindicated in pregnancy. Given daily for 14 days.',
  },

  // ===================== cardiovascular ==================================
  {
    generic: 'Amlodipine',
    indication: 'Hypertension',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '5 mg once daily, increased to 10 mg once daily if needed',
    maxPerDay: '10 mg',
    reference: `${HEARTS}, treatment protocol, calcium channel blocker step`,
    verified: false,
    note: 'Ankle oedema is dose-related and a common reason patients stop - explain it up front.',
  },
  {
    generic: 'Telmisartan',
    indication: 'Hypertension',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '40 mg once daily, increased to 80 mg once daily if needed',
    maxPerDay: '80 mg',
    reference: `${HEARTS}, treatment protocol, ARB step`,
    verified: false,
    note: 'Contraindicated in pregnancy. Check creatinine and potassium 1-2 weeks after starting or up-titrating.',
  },
  {
    generic: 'Lisinopril',
    indication: 'Hypertension',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '10 mg once daily, titrated up to 20 to 40 mg once daily',
    maxPerDay: '40 mg',
    reference: `${HEARTS}, treatment protocol, ACE inhibitor step; ${EML}, cardiovascular medicines`,
    verified: false,
    note: 'Dry cough is the usual reason for switching to an ARB. Contraindicated in pregnancy and bilateral renal artery stenosis.',
  },
  {
    generic: 'Hydrochlorothiazide',
    indication: 'Hypertension',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '12.5 to 25 mg once daily in the morning',
    maxPerDay: '25 mg for hypertension',
    reference: `${HEARTS}, treatment protocol, thiazide step`,
    verified: false,
    note: 'Check sodium and potassium after starting, particularly in the elderly.',
  },
  {
    generic: 'Bisoprolol',
    indication: 'Hypertension, angina or heart failure',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '2.5 to 5 mg once daily, titrated to response',
    maxPerDay: '10 mg',
    reference: `${EML}, beta blockers; ${HEARTS}, treatment protocol`,
    verified: false,
    note: 'In heart failure start low and go slow. Do not stop abruptly in ischaemic heart disease.',
  },
  {
    generic: 'Aspirin',
    indication: 'Secondary prevention of cardiovascular disease',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '75 to 100 mg once daily, after food',
    reference: `${HEARTS}, secondary prevention; ${EML}, antithrombotic medicines`,
    verified: false,
    note: 'For established vascular disease. Routine primary prevention is not recommended - confirm the indication.',
  },
  {
    generic: 'Atorvastatin',
    indication: 'Cardiovascular risk reduction / dyslipidaemia',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '20 mg once daily; 40 to 80 mg once daily for high-intensity therapy',
    maxPerDay: '80 mg',
    reference: `${HEARTS}, statin therapy; ${EML}, lipid-lowering medicines`,
    verified: false,
    note: 'Contraindicated in pregnancy. Check baseline LFTs. Ask about muscle pain at each review.',
  },
  {
    generic: 'Furosemide',
    indication: 'Oedema in heart failure, renal or hepatic disease',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '20 to 40 mg once or twice daily, titrated to response',
    reference: `${WMF}, section 16 (diuretics), furosemide`,
    verified: false,
    note: 'Dose is titrated against weight and symptoms, not fixed. Monitor potassium, sodium and creatinine.',
  },
  {
    generic: 'Spironolactone',
    indication: 'Heart failure, resistant hypertension or ascites',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '25 mg once daily',
    reference: `${WMF}, section 16, spironolactone; ${EML}`,
    verified: false,
    note: 'Hyperkalaemia, particularly with an ACE inhibitor/ARB or in CKD. Check potassium and creatinine within 1-2 weeks.',
  },
  {
    generic: 'Glyceryl trinitrate',
    indication: 'Acute anginal chest pain',
    route: 'sublingual',
    ageBand: ADULT,
    fixedDose: '0.5 mg under the tongue, repeated after 5 minutes if pain persists',
    reference: `${WMF}, section 12.1 (antianginal medicines), glyceryl trinitrate`,
    verified: false,
    note: 'Sit down before taking. If pain persists after 2 doses over 10 minutes, go to hospital. Contraindicated with sildenafil and similar drugs.',
  },
  {
    generic: 'Enoxaparin',
    indication: 'Treatment dose for venous thromboembolism',
    route: 'subcutaneous',
    mgPerKg: 1,
    perDoses: 2,
    ageBand: ADULT,
    reference: `${EML}, antithrombotic medicines, low-molecular-weight heparin`,
    verified: false,
    note: '1 mg/kg every 12 hours. Prophylaxis is a fixed 40 mg once daily and is a different row. Reduce in renal impairment; check platelets.',
  },
  {
    generic: 'Warfarin sodium',
    indication: 'Anticoagulation (INR-guided)',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: 'INR-GUIDED - no fixed dose. Typical start 5 mg once daily, then adjust',
    reference: `${WMF}, section 10.2 (medicines affecting coagulation), warfarin`,
    verified: false,
    note: 'This row exists to state that a dose CANNOT be suggested. Target INR depends on indication. Rifampicin, azoles, macrolides, NSAIDs and diet all shift it.',
  },

  // ===================== diabetes ========================================
  {
    generic: 'Metformin',
    indication: 'Type 2 diabetes mellitus',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '500 mg once or twice daily with meals, increased gradually',
    maxPerDay: '2 g in 24 hours',
    reference: `${PEN}, protocol 1 (diabetes), metformin; ${EML}, medicines for diabetes`,
    verified: false,
    note: 'First-line. Titrate over weeks to limit GI upset. Review the dose if eGFR is reduced and stop if eGFR falls below 30. Hold before contrast imaging.',
  },
  {
    generic: 'Gliclazide',
    indication: 'Type 2 diabetes mellitus',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: 'Modified release 30 mg once daily with breakfast, titrated to response',
    maxPerDay: '120 mg (modified release)',
    reference: `${PEN}, protocol 1 (diabetes), sulfonylurea; ${EML}`,
    verified: false,
    note: 'Hypoglycaemia risk, worse in the elderly, in CKD and during Ramadan fasting. Teach the patient to recognise and treat a hypo before they leave.',
  },
  {
    generic: 'Insulin human (isophane)',
    indication: 'Diabetes mellitus requiring insulin',
    route: 'subcutaneous',
    ageBand: ADULT,
    fixedDose: 'INDIVIDUALISED - typical start 10 units at bedtime, or 0.2 units/kg/day, then titrated on the home glucose log',
    reference: `${PEN}, protocol 1 (diabetes), insulin initiation; ${EML}, insulins`,
    verified: false,
    note: 'Never a computed dose. Titration is against the fasting reading and is the whole treatment. Check injection sites for lipohypertrophy at every visit.',
  },

  // ===================== gastrointestinal ================================
  {
    generic: 'Omeprazole',
    indication: 'Peptic ulcer disease or gastro-oesophageal reflux',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '20 mg once daily before breakfast; 40 mg once daily in severe disease',
    reference: `${WMF}, section 17.1 (antiulcer medicines), omeprazole`,
    verified: false,
    note: 'Take 30 minutes before food. Review the need at each visit - long-term use is rarely reviewed and often unnecessary.',
  },
  {
    generic: 'Metoclopramide',
    indication: 'Nausea and vomiting',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '10 mg up to three times daily, for a maximum of 5 days',
    maxPerDay: '30 mg in 24 hours',
    reference: `${WMF}, section 17.2 (antiemetic medicines), metoclopramide`,
    verified: false,
    note: 'Acute dystonia in young patients; tardive dyskinesia with prolonged use. Short courses only.',
  },
  {
    generic: 'Ondansetron',
    indication: 'Nausea and vomiting',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '4 to 8 mg every 8 to 12 hours as required',
    reference: `${WMF}, section 17.2, ondansetron; ${EML}`,
    verified: false,
    note: 'QT prolongation, especially with electrolyte disturbance or other QT drugs. Causes constipation.',
  },
  {
    generic: 'Oral rehydration salts',
    indication: 'Dehydration from acute diarrhoea',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: 'Low-osmolarity ORS, freely after each loose stool; roughly 200-400 ml per stool in adults',
    reference: `${EML}, oral rehydration salts; ${WMF}, section 17.5.1`,
    verified: false,
    note: 'Volume-depleted adults with ongoing losses may need litres per day. Severe dehydration needs IV fluid, not ORS.',
  },
  {
    generic: 'Hyoscine butylbromide',
    indication: 'Abdominal or biliary colic, irritable bowel symptoms',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '10 to 20 mg three to four times daily',
    maxPerDay: '80 mg in 24 hours',
    reference: `${WMF}, section 17.5 (antispasmodics), hyoscine butylbromide`,
    verified: false,
    note: 'Anticholinergic: avoid in glaucoma, prostatism and paralytic ileus.',
  },

  // ===================== respiratory =====================================
  {
    generic: 'Salbutamol',
    indication: 'Acute bronchospasm in asthma or COPD',
    route: 'inhaled',
    ageBand: ADULT,
    fixedDose: '100 to 200 micrograms (1 to 2 puffs) as required, up to four times daily',
    reference: `${WMF}, section 25.1 (antiasthmatic medicines), salbutamol`,
    verified: false,
    note: 'Rising reliever use is the single most useful marker of poor control - ask how many inhalers per month. Check technique and offer a spacer.',
  },
  {
    generic: 'Prednisolone',
    indication: 'Acute exacerbation of asthma or COPD',
    route: 'oral',
    mgPerKg: 0.5,
    perDoses: 1,
    ageBand: ADULT,
    maxPerDay: '40 to 50 mg once daily in the morning',
    reference: `${WMF}, section 25.1, oral corticosteroid for acute asthma`,
    verified: false,
    note: 'Typically 5 to 7 days; no taper needed for a short course. Raises blood glucose sharply in diabetes - warn the patient.',
  },
  {
    generic: 'Beclometasone',
    indication: 'Maintenance (preventer) therapy in asthma',
    route: 'inhaled',
    ageBand: ADULT,
    fixedDose: '200 to 400 micrograms twice daily, adjusted to control',
    reference: `${WMF}, section 25.1, inhaled corticosteroid`,
    verified: false,
    note: 'Rinse the mouth after use to prevent oral candidiasis. Emphasise that this one works only if taken when well.',
  },

  // ===================== endocrine / other ===============================
  {
    generic: 'Levothyroxine',
    indication: 'Hypothyroidism',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: 'Start 25 to 50 micrograms once daily on an empty stomach; full replacement is about 1.6 micrograms/kg/day',
    reference: `${WMF}, section 18.8 (thyroid hormones), levothyroxine; ${EML}`,
    verified: false,
    note: 'Start at 25 micrograms in the elderly or in ischaemic heart disease. Recheck TSH after 6 to 8 weeks, not sooner. Separate from calcium and iron by 4 hours.',
  },
  {
    generic: 'Carbimazole',
    indication: 'Hyperthyroidism',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: 'Start 15 to 40 mg daily, reduced once euthyroid',
    reference: `${WMF}, section 18.8 (antithyroid medicines), carbimazole; ${EML}`,
    verified: false,
    note: 'AGRANULOCYTOSIS: tell every patient to stop and get an urgent CBC if they develop sore throat, mouth ulcers or fever. Not first-line in the first trimester.',
  },
  {
    generic: 'Ferrous sulphate + Folic acid',
    indication: 'Iron deficiency anaemia in adults',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '60 mg elemental iron with 2.8 mg folic acid once daily for 3 months',
    reference: `${ANAEMIA}, daily supplementation regimen for anaemic adult women`,
    verified: false,
    note: 'Absorption improves with vitamin C and falls with tea, calcium and PPIs. Recheck haemoglobin at 4 weeks. In an adult, iron deficiency is a symptom - find the bleeding source.',
  },
  {
    generic: 'Allopurinol',
    indication: 'Long-term urate lowering in gout',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: 'Start 100 mg once daily after food, titrated upward against serum urate',
    maxPerDay: '900 mg (rarely needed)',
    reference: `${WMF}, section 2.3 (medicines used to treat gout), allopurinol; ${EML}`,
    verified: false,
    note: 'Do NOT start during an acute attack and do NOT stop it during one. Start lower in renal impairment. Severe rash means stop immediately.',
  },
  {
    generic: 'Colchicine',
    indication: 'Acute gout',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '0.5 mg two to three times daily',
    maxPerDay: 'See source; cumulative dose is limited by diarrhoea and toxicity',
    reference: `${WMF}, section 2.3, colchicine; ${EML}`,
    verified: false,
    note: 'Diarrhoea is the dose-limiting effect and the signal to stop. Reduce in renal or hepatic impairment and with statins or clarithromycin.',
  },
  // ===================== rheumatology / immunosuppression =================
  {
    generic: 'Methotrexate',
    indication: 'Rheumatoid arthritis (disease-modifying, low-dose weekly regimen)',
    route: 'oral',
    ageBand: ADULT,
    fixedDose:
      'ONCE A WEEK only: 7.5 mg to 25 mg once weekly, usually paired with folic acid on a ' +
      'different day. NEVER a daily dose.',
    reference: `${EML}, disease-modifying agents used in rheumatoid disorders, methotrexate`,
    verified: false,
    // The row this schema note and CLAUDE.md 6d exist for: a daily dose of a
    // weekly-only drug is fatal, not merely wrong. See domain/sig.ts's
    // weeklyOnlyViolation, which refuses to let this render against a daily
    // frequency regardless of which sig template is chosen.
    weeklyOnly: true,
    note:
      'Fatal in overdose from a daily-instead-of-weekly dosing error -- confirm the frequency ' +
      'reads "once a week" before signing, and confirm the patient understands it. Requires ' +
      'baseline and periodic FBC/LFT/renal monitoring; contraindicated in pregnancy.',
  },
  {
    generic: 'Amitriptyline',
    indication: 'Neuropathic pain',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: '10 to 25 mg at night, increased slowly to response',
    reference: `${EML}, medicines for neuropathic pain, amitriptyline; ${WMF}, section 24.2`,
    verified: false,
    note: 'Sedation, dry mouth, urinary retention and postural drops, worse in the elderly. Warn about driving. Dangerous in overdose.',
  },
  {
    generic: 'Carbamazepine',
    indication: 'Focal epilepsy or trigeminal neuralgia',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: 'Start 100 to 200 mg once or twice daily, increased slowly',
    reference: `${WMF}, section 5 (anticonvulsants), carbamazepine; ${EML}`,
    verified: false,
    note: 'Enzyme inducer - contraceptives and many other drugs become unreliable. HLA-B*1502 is linked to severe skin reactions in some Asian populations. Teratogenic.',
  },
  {
    generic: 'Sodium valproate',
    indication: 'Generalised epilepsy',
    route: 'oral',
    ageBand: ADULT,
    fixedDose: 'Start 500 mg daily in divided doses, increased to response',
    reference: `${WMF}, section 5, valproic acid; ${EML}`,
    verified: false,
    note: 'HIGHLY TERATOGENIC. Avoid in women and girls of childbearing potential unless there is no alternative and pregnancy is reliably prevented.',
  },
];

export default medicineDosingSeed;
