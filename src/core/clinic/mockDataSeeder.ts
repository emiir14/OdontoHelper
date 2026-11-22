import {
  sharedActivityRepo,
  sharedAppointmentRepo,
  sharedEvolutionRepo,
  sharedFinancialTxRepo,
  sharedLabOrderRepo,
  sharedOdontogramRepo,
  sharedPatientRepo,
  sharedPeriodontogramRepo,
  sharedProfessionalRepo,
  sharedProviderRepo,
  sharedSessionRepo,
  sharedTranscriptRepo,
  sharedTreatmentPlanRepo,
} from '../../adapters/repositoryRegistry';
import {
  ActivityLogEntry,
  Appointment,
  ClinicalEvolutionEntry,
  ClinicProfessional,
  CurrencyCode,
  FinancialTransaction,
  LabOrder,
  OdontogramRecord,
  Patient,
  PeriodontogramRecord,
  Provider,
  Session,
  TranscriptSegment,
  TreatmentPlan,
} from '../types';
import { DEFAULT_CURRENCY } from './clinicHelpers';

function addDaysIso(base: Date, deltaDays: number): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + deltaDays);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export async function seedDemoClinicData(
  workspaceId: string,
  options: { force?: boolean; currency?: CurrencyCode; ownerName?: string } = {}
): Promise<boolean> {
  const { force = false, currency = DEFAULT_CURRENCY, ownerName } = options;

  const seedFlagKey = `odontohelper_demo_seeded_${workspaceId}`;
  const seedDateKey = `odontohelper_demo_seed_date_${workspaceId}`;
  const today = new Date();
  const todayStr = addDaysIso(today, 0);
  const yesterdayStr = addDaysIso(today, -1);
  const twoDaysAgoStr = addDaysIso(today, -2);
  const fourDaysAgoStr = addDaysIso(today, -4);
  const tomorrowStr = addDaysIso(today, 1);
  const inThreeDaysStr = addDaysIso(today, 3);
  const inFiveDaysStr = addDaysIso(today, 5);
  const wsPrefix = workspaceId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || 'local';
  const id = (tag: string) => `demo_${wsPrefix}_${tag}`;

  if (!force && typeof localStorage !== 'undefined' && localStorage.getItem(seedFlagKey) === '1') {
    const storedSeedDate = localStorage.getItem(seedDateKey);
    if (storedSeedDate !== todayStr) {
      try {
        const existingAppts = await sharedAppointmentRepo.getAll(workspaceId);
        const anchorToday = existingAppts.find((a) => !a.deletedAt && a.id === id('appt_today_1'));
        if (anchorToday && anchorToday.date !== todayStr && (!storedSeedDate || anchorToday.date === storedSeedDate)) {
          const demoDateTargets: Array<[string, string]> = [
            [id('appt_today_1'), todayStr],
            [id('appt_today_2'), todayStr],
            [id('appt_today_3'), todayStr],
            [id('appt_today_4'), todayStr],
            [id('appt_tomorrow_1'), tomorrowStr],
            [id('appt_future_1'), inThreeDaysStr],
            [id('appt_past_1'), fourDaysAgoStr],
            [id('appt_past_2'), twoDaysAgoStr],
            [id('appt_past_unannotated'), yesterdayStr],
            [id('appt_cancelled'), twoDaysAgoStr],
          ];
          await Promise.all(
            demoDateTargets
              .filter(([apptId]) => existingAppts.some((a) => !a.deletedAt && a.id === apptId))
              .map(([apptId, targetDate]) => sharedAppointmentRepo.update(apptId, { date: targetDate }))
          );

          const [sess1, sess2] = await Promise.all([
            sharedSessionRepo.getById(id('sess_1')),
            sharedSessionRepo.getById(id('sess_2')),
          ]);
          if (sess1?.clinicalNote) {
            await sharedSessionRepo.update(sess1.id, {
              clinicalNote: {
                ...sess1.clinicalNote,
                nextVisit: `${todayStr} 09:00 hs — Prueba y ajuste de corona definitiva.`,
              },
            });
          }
          if (sess2?.clinicalNote) {
            await sharedSessionRepo.update(sess2.id, {
              clinicalNote: {
                ...sess2.clinicalNote,
                nextVisit: `${todayStr} 10:30 hs — Instalación de corona definitiva sobre implante 4.6.`,
              },
            });
          }
        }
        localStorage.setItem(seedDateKey, todayStr);
      } catch {
        // Ignore non-critical background resync failure
      }
    }
    return false;
  }

  const [existingPatients, existingAppts, existingPlans, existingTx] = await Promise.all([
    sharedPatientRepo.getAll(workspaceId),
    sharedAppointmentRepo.getAll(workspaceId),
    sharedTreatmentPlanRepo.getAll(workspaceId),
    sharedFinancialTxRepo.getAll(workspaceId),
  ]);

  if (
    !force &&
    (existingPatients.length > 0 ||
      existingAppts.length > 0 ||
      existingPlans.length > 0 ||
      existingTx.length > 0)
  ) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(seedFlagKey, '1');
      localStorage.setItem(seedDateKey, todayStr);
    }
    return false;
  }

  const now = Date.now();

  const upcomingBirthdayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 4);
  const bdayMonth = String(upcomingBirthdayDate.getMonth() + 1).padStart(2, '0');
  const bdayDay = String(upcomingBirthdayDate.getDate()).padStart(2, '0');

  // 1. Clinic Professionals
  const existingProfs = await sharedProfessionalRepo.getAll(workspaceId);
  const resolvedOwner =
    existingProfs.find((p) => p.role === 'owner') ||
    ({
      id: id('prof_owner'),
      workspaceId,
      fullName: ownerName && ownerName !== 'Dra. Titular' ? ownerName : 'Dr. Martín Echeverría',
      specialty: 'Odontología General y Rehabilitación',
      licenseNumber: 'MSP 4821',
      role: 'owner',
      agendaColor: '#0d9488',
      canViewFinance: true,
      active: true,
      createdAt: now - 86400000 * 20,
      updatedAt: now,
    } satisfies ClinicProfessional);

  const extraProfs: ClinicProfessional[] = [
    {
      id: id('prof_endo'),
      workspaceId,
      fullName: 'Dra. Sofía Rodríguez',
      specialty: 'Endodoncia y Estética Dental',
      licenseNumber: 'MSP 5390',
      role: 'odontologo',
      agendaColor: '#2563eb',
      canViewFinance: true,
      active: true,
      createdAt: now - 86400000 * 18,
      updatedAt: now,
    },
    {
      id: id('prof_sec'),
      workspaceId,
      fullName: 'Camila Bentancor',
      specialty: 'Recepción y Coordinación',
      role: 'secretaria',
      agendaColor: '#d97706',
      canViewFinance: true,
      active: true,
      createdAt: now - 86400000 * 15,
      updatedAt: now,
    },
  ];

  if (!existingProfs.some((p) => p.role === 'owner')) {
    await sharedProfessionalRepo.create(resolvedOwner);
  }
  const resolvedExtraProfs: ClinicProfessional[] = [];
  for (const prof of extraProfs) {
    const match = existingProfs.find((p) => p.id === prof.id || p.fullName === prof.fullName);
    if (!match) {
      await sharedProfessionalRepo.create(prof);
      resolvedExtraProfs.push(prof);
    } else {
      resolvedExtraProfs.push(match);
    }
  }
  const resolvedEndo = resolvedExtraProfs[0] || extraProfs[0];

  // 2. Patients (Uruguayan context: CI, +598 mobiles, Mutualistas)
  const patients: Patient[] = [
    {
      id: id('pat_lucia'),
      workspaceId,
      fullName: 'Lucía Fernández Silva',
      dni: '4.512.890-3',
      birthDate: '1991-06-14',
      age: '35 años',
      gender: 'F',
      phone: '099 412 890',
      secondaryPhone: '2708 4412',
      email: 'lucia.fernandez@correo.uy',
      address: 'Bvar. España 2415, Pocitos, Montevideo',
      groupTag: 'Rehabilitación y Bruxismo',
      insuranceProvider: 'CASMU',
      insuranceNumber: '4512890-01',
      allergies: 'Penicilina (rash cutáneo leve)',
      medicalHistory: 'Bruxismo nocturno en seguimiento. Sin antecedentes cardiovasculares.',
      chiefComplaint: 'Sensibilidad en molar inferior izquierdo (3.6) y rehabilitación protésica',
      notes: 'Prefiere turnos por la mañana.',
      anamnesis: {
        bruxism: true,
        anesthesiaReaction: false,
        takesMedication: false,
        updatedAt: now - 86400000 * 5,
      },
      physicalExam: {
        bloodPressure: '115/75 mmHg',
        mucosa: 'Mucosas rosadas e hidratadas, sin lesiones visibles.',
        lymphNodes: 'Sin adenopatías palpables.',
        tmj: 'Leve chasquido articular derecho en apertura máxima, sin dolor.',
        occlusion: 'Facetas de desgaste en caninos por bruxismo nocturno.',
        oralHygiene: 'Buena',
        observations: 'Sensibilidad térmica en pieza 3.6 ya tratada endodónticamente.',
        updatedAt: now - 86400000 * 5,
      },
      nextControlDate: addDaysIso(today, 21),
      nextControlNote: 'Control de placa miorelajante y cementado definitivo de corona en 3.6.',
      sourceSessionId: id('sess_1'),
      createdAt: now - 86400000 * 12,
      updatedAt: now - 86400000 * 1,
    },
    {
      id: id('pat_mateo'),
      workspaceId,
      fullName: 'Mateo Pereira Techera',
      dni: '3.890.231-7',
      birthDate: '1984-03-22',
      age: '42 años',
      gender: 'M',
      phone: '098 734 112',
      email: 'mateo.pereira@correo.uy',
      address: 'Av. 18 de Julio 1780, Cordón, Montevideo',
      groupTag: 'Implantología',
      insuranceProvider: 'Médica Uruguaya',
      insuranceNumber: 'MU-88291',
      allergies: 'Ninguna conocida',
      medicalHistory: 'Hipertensión arterial controlada con losartán 50 mg/día.',
      chiefComplaint: 'Colocación de corona sobre implante pieza 4.6 e higiene semestral',
      anamnesis: {
        hypertension: true,
        takesMedication: true,
        medicationDetail: 'Losartán 50 mg (1 comprimido/día)',
        updatedAt: now - 86400000 * 4,
      },
      physicalExam: {
        bloodPressure: '130/82 mmHg',
        mucosa: 'Encía periimplantaria en 4.6 sana y sin sangrado.',
        lymphNodes: 'Normales.',
        tmj: 'Sin alteraciones.',
        occlusion: 'Estable en máxima intercuspidación.',
        oralHygiene: 'Regular (reforzar uso de cepillo interdental)',
        updatedAt: now - 86400000 * 4,
      },
      sourceSessionId: id('sess_2'),
      createdAt: now - 86400000 * 10,
      updatedAt: now - 86400000 * 1,
    },
    {
      id: id('pat_valentina'),
      workspaceId,
      fullName: 'Valentina Acosta Núñez',
      dni: '5.120.448-1',
      birthDate: '1997-09-08',
      age: '29 años',
      phone: '091 558 320',
      email: 'valentina.acosta@correo.uy',
      address: 'Av. Arocena 1640, Carrasco, Montevideo',
      insuranceProvider: 'Asociación Española',
      insuranceNumber: 'AE-102934',
      allergies: 'Látex (usar guantes de nitrilo)',
      chiefComplaint: 'Control estético y blanqueamiento en consultorio',
      anamnesis: {
        smoking: false,
        updatedAt: now - 86400000 * 3,
      },
      createdAt: now - 86400000 * 8,
      updatedAt: now - 86400000 * 2,
    },
    {
      id: id('pat_joaquin'),
      workspaceId,
      fullName: 'Joaquín Méndez Cabrera',
      dni: '2.984.110-5',
      birthDate: '1976-12-03',
      age: '49 años',
      phone: '094 218 745',
      email: 'joaquin.mendez@correo.uy',
      address: 'Colonia 1140, Centro, Montevideo',
      insuranceProvider: 'Particular',
      medicalHistory: 'Diabetes tipo 2 compensada (metformina 850 mg). Fumador moderado.',
      chiefComplaint: 'Sangrado gingival en sector posterior y desgaste incisal',
      anamnesis: {
        diabetes: true,
        smoking: true,
        bruxism: true,
        takesMedication: true,
        medicationDetail: 'Metformina 850 mg',
        updatedAt: now - 86400000 * 6,
      },
      createdAt: now - 86400000 * 6,
      updatedAt: now - 86400000 * 2,
    },
    {
      id: id('pat_florencia'),
      workspaceId,
      fullName: 'Florencia Suárez Olivera',
      dni: '4.778.602-9',
      birthDate: `1993-${bdayMonth}-${bdayDay}`,
      age: '33 años',
      phone: '099 883 204',
      email: 'florencia.suarez@correo.uy',
      address: 'Rambla O’Higgins 4920, Malvín, Montevideo',
      insuranceProvider: 'COSEM',
      insuranceNumber: 'COS-54120',
      chiefComplaint: 'Carilla estética en incisivo central superior 1.1',
      createdAt: now - 86400000 * 5,
      updatedAt: now - 86400000 * 1,
    },
    {
      id: id('pat_santiago'),
      workspaceId,
      fullName: 'Santiago Delgado Ramos',
      dni: '3.451.990-2',
      birthDate: '1988-04-19',
      age: '38 años',
      phone: '092 610 448',
      email: 'santiago.delgado@correo.uy',
      address: 'Bvar. Artigas 980, Parque Rodó, Montevideo',
      insuranceProvider: 'Particular',
      chiefComplaint: 'Fractura de borde incisal en pieza 2.1',
      notes: 'Pendiente agendar control de seguimiento.',
      createdAt: now - 86400000 * 3,
      updatedAt: now - 86400000 * 1,
    },
  ];

  for (const pat of patients) {
    await sharedPatientRepo.create(pat);
  }

  // 3. Providers
  const providers: Provider[] = [
    {
      id: id('prov_lab_mvd'),
      workspaceId,
      name: 'Laboratorio Dental Montevideo',
      category: 'laboratorio',
      contactName: 'Téc. Daniel Sosa',
      taxId: 'RUT 214589020019',
      phone: '2408 5510',
      email: 'ordenes@labmontevideo.uy',
      address: 'Bvar. Artigas 1420, Tres Cruces, Montevideo',
      specialtyOrProducts: 'Coronas de zirconio, disilicato, pilares CAD/CAM y placas oclusales',
      paymentTerms: 'Cuenta corriente mensual / Transferencia BROU',
      createdAt: now - 86400000 * 15,
      updatedAt: now - 86400000 * 2,
    },
    {
      id: id('prov_ceramica'),
      workspaceId,
      name: 'Cerámica & Estética Lab',
      category: 'laboratorio',
      contactName: 'Téc. Paula Giménez',
      taxId: 'RUT 218834100014',
      phone: '099 304 118',
      email: 'estetica@ceramicalab.uy',
      address: 'Gabriel Pereira 2940, Pocitos, Montevideo',
      specialtyOrProducts: 'Carillas E-max estratificadas y estética anterior',
      paymentTerms: 'Contra entrega / 15 días',
      createdAt: now - 86400000 * 12,
      updatedAt: now - 86400000 * 3,
    },
    {
      id: id('prov_insumos'),
      workspaceId,
      name: 'Insumos Odontológicos del Sur',
      category: 'insumos',
      contactName: 'Federico Ibarra',
      taxId: 'RUT 210945110018',
      phone: '2902 4480',
      email: 'ventas@insumossur.uy',
      address: 'Av. 18 de Julio 1950, Montevideo',
      specialtyOrProducts: 'Anestésicos, composites 3M/Ivoclar, nitrilo y descartables',
      paymentTerms: 'Contado / Crédito 30 días',
      createdAt: now - 86400000 * 10,
      updatedAt: now - 86400000 * 1,
    },
    {
      id: id('prov_cirugia'),
      workspaceId,
      name: 'Dr. Alejandro Viera — Cirugía Maxilofacial',
      category: 'especialista',
      contactName: 'Dr. Alejandro Viera',
      phone: '099 710 225',
      email: 'viera.cirugia@clinica.uy',
      address: 'Av. Italia 2520, Parque Batlle, Montevideo',
      specialtyOrProducts: 'Interconsultas quirúrgicas, terceros molares retenidos e injertos',
      paymentTerms: 'Honorarios por derivación',
      createdAt: now - 86400000 * 9,
      updatedAt: now - 86400000 * 4,
    },
  ];

  for (const prov of providers) {
    await sharedProviderRepo.create(prov);
  }

  // 4. Appointments (covering all statuses & dates)
  const appointments: Appointment[] = [
    {
      id: id('appt_today_1'),
      workspaceId,
      patientId: id('pat_lucia'),
      patientName: 'Lucía Fernández Silva',
      professionalId: resolvedOwner.id,
      professionalName: resolvedOwner.fullName,
      date: todayStr,
      startTime: '09:00',
      durationMin: 45,
      procedure: 'Prueba de estructura y ajuste corona zirconio (3.6)',
      status: 'waiting',
      notes: 'Verificar contacto interproximal y oclusión.',
      createdAt: now - 86400000 * 2,
      updatedAt: now,
    },
    {
      id: id('appt_today_2'),
      workspaceId,
      patientId: id('pat_mateo'),
      patientName: 'Mateo Pereira Techera',
      professionalId: resolvedOwner.id,
      professionalName: resolvedOwner.fullName,
      date: todayStr,
      startTime: '10:30',
      durationMin: 60,
      procedure: 'Instalación de pilar y corona sobre implante (4.6)',
      status: 'confirmed',
      notes: 'Trabajo ya recibido en clínica.',
      createdAt: now - 86400000 * 2,
      updatedAt: now,
    },
    {
      id: id('appt_today_3'),
      workspaceId,
      patientId: id('pat_florencia'),
      patientName: 'Florencia Suárez Olivera',
      professionalId: resolvedEndo.id,
      professionalName: resolvedEndo.fullName,
      date: todayStr,
      startTime: '14:30',
      durationMin: 45,
      procedure: 'Cementado provisional y control estético pieza 1.1',
      status: 'in_progress',
      createdAt: now - 86400000 * 1,
      updatedAt: now,
    },
    {
      id: id('appt_today_4'),
      workspaceId,
      patientId: id('pat_joaquin'),
      patientName: 'Joaquín Méndez Cabrera',
      professionalId: resolvedOwner.id,
      professionalName: resolvedOwner.fullName,
      date: todayStr,
      startTime: '16:30',
      durationMin: 45,
      procedure: 'Raspaje y alisado radicular cuadrante inferior derecho',
      status: 'pending',
      createdAt: now - 86400000 * 1,
      updatedAt: now,
    },
    {
      id: id('appt_tomorrow_1'),
      workspaceId,
      patientId: id('pat_valentina'),
      patientName: 'Valentina Acosta Núñez',
      professionalId: resolvedEndo.id,
      professionalName: resolvedEndo.fullName,
      date: tomorrowStr,
      startTime: '11:00',
      durationMin: 60,
      procedure: 'Blanqueamiento dental en consultorio (sesión 1)',
      status: 'confirmed',
      autoCaptured: true,
      createdAt: now - 86400000 * 1,
      updatedAt: now,
    },
    {
      id: id('appt_future_1'),
      workspaceId,
      patientId: id('pat_lucia'),
      patientName: 'Lucía Fernández Silva',
      professionalId: resolvedOwner.id,
      professionalName: resolvedOwner.fullName,
      date: inThreeDaysStr,
      startTime: '09:30',
      durationMin: 30,
      procedure: 'Control oclusal post-cementado y toma registro placa',
      status: 'confirmed',
      createdAt: now - 86400000 * 1,
      updatedAt: now,
    },
    {
      id: id('appt_past_1'),
      workspaceId,
      patientId: id('pat_lucia'),
      patientName: 'Lucía Fernández Silva',
      professionalId: resolvedOwner.id,
      professionalName: resolvedOwner.fullName,
      date: fourDaysAgoStr,
      startTime: '09:00',
      durationMin: 60,
      procedure: 'Tallado y toma de impresión definitiva pieza 3.6',
      status: 'completed',
      sourceSessionId: id('sess_1'),
      createdAt: now - 86400000 * 5,
      updatedAt: now - 86400000 * 4,
    },
    {
      id: id('appt_past_2'),
      workspaceId,
      patientId: id('pat_mateo'),
      patientName: 'Mateo Pereira Techera',
      professionalId: resolvedOwner.id,
      professionalName: resolvedOwner.fullName,
      date: twoDaysAgoStr,
      startTime: '11:30',
      durationMin: 45,
      procedure: 'Limpieza ultrasónica y control de implante 4.6',
      status: 'completed',
      sourceSessionId: id('sess_2'),
      createdAt: now - 86400000 * 4,
      updatedAt: now - 86400000 * 2,
    },
    {
      id: id('appt_past_unannotated'),
      workspaceId,
      patientId: id('pat_santiago'),
      patientName: 'Santiago Delgado Ramos',
      professionalId: resolvedOwner.id,
      professionalName: resolvedOwner.fullName,
      date: yesterdayStr,
      startTime: '17:00',
      durationMin: 30,
      procedure: 'Urgencia fractura borde incisal pieza 2.1',
      status: 'completed',
      notes: 'Pendiente cargar evolución del día.',
      createdAt: now - 86400000 * 2,
      updatedAt: now - 86400000 * 1,
    },
    {
      id: id('appt_cancelled'),
      workspaceId,
      patientId: id('pat_valentina'),
      patientName: 'Valentina Acosta Núñez',
      professionalId: resolvedEndo.id,
      professionalName: resolvedEndo.fullName,
      date: twoDaysAgoStr,
      startTime: '15:00',
      durationMin: 30,
      procedure: 'Evaluación estética inicial (reprogramado)',
      status: 'cancelled',
      createdAt: now - 86400000 * 4,
      updatedAt: now - 86400000 * 2,
    },
  ];

  for (const appt of appointments) {
    await sharedAppointmentRepo.create(appt);
  }

  // 5. Voice Sessions + Transcripts + Structured Clinical Notes (for "Dictar historia clínica" tab)
  const sessions: Session[] = [
    {
      id: id('sess_1'),
      workspaceId,
      title: 'Consulta 3.6 — Lucía Fernández Silva',
      reference: 'Lucía Fernández Silva (CI 4.512.890-3)',
      patientId: id('pat_lucia'),
      intakeTarget: 'consultation',
      status: 'completed',
      durationSec: 184,
      consentGiven: true,
      modelTierUsed: 'balanced',
      audioDeleted: true,
      clinicalNote: {
        templateId: 'general',
        detectedTeeth: ['3.6', '1.6'],
        chiefComplaint: 'Sensibilidad en molar inferior izquierdo con restauración filtrada.',
        findings: 'Pieza 3.6 con endodoncia previa satisfactoria y corona provisoria desadaptada. Pieza 1.6 con composite oclusal en buen estado.',
        procedure: 'Retiro de provisorio, tallado periférico completo en 3.6, hilo retractor y toma de impresión con silicona de adición para corona de zirconio color A2.',
        indications: 'Cuidar provisorio, evitar alimentos muy duros o pegajosos del lado izquierdo. Ibuprofeno 400 mg si presenta molestia gingival.',
        nextVisit: `${todayStr} 09:00 hs — Prueba y ajuste de corona definitiva.`,
        updatedAt: now - 86400000 * 4,
      },
      createdAt: now - 86400000 * 4,
      updatedAt: now - 86400000 * 4,
    },
    {
      id: id('sess_2'),
      workspaceId,
      title: 'Profilaxis y control implante 4.6 — Mateo Pereira',
      reference: 'Mateo Pereira Techera',
      patientId: id('pat_mateo'),
      intakeTarget: 'consultation',
      status: 'completed',
      durationSec: 142,
      consentGiven: true,
      modelTierUsed: 'balanced',
      audioDeleted: true,
      clinicalNote: {
        templateId: 'periodoncia',
        detectedTeeth: ['4.6'],
        chiefComplaint: 'Control periódico e higiene antes de instalar corona sobre implante 4.6.',
        findings: 'Mucosa periimplantaria sana, sin sangrado al sondaje. Oseointegración clínica y radiográfica estable.',
        procedure: 'Destartraje ultrasónico general, pulido con pasta profiláctica y verificación de torque de cicatrizador en 4.6.',
        indications: 'Uso diario de cepillo interdental y enjuague con clorhexidina 0,12% por 5 días.',
        nextVisit: `${todayStr} 10:30 hs — Instalación de corona definitiva sobre implante 4.6.`,
        updatedAt: now - 86400000 * 2,
      },
      createdAt: now - 86400000 * 2,
      updatedAt: now - 86400000 * 2,
    },
  ];

  for (const sess of sessions) {
    await sharedSessionRepo.create(sess);
  }

  const segs1: TranscriptSegment[] = [
    {
      id: id('seg_1_1'),
      sessionId: id('sess_1'),
      start: 0,
      end: 14.5,
      text: 'Paciente Lucía Fernández Silva refiere molestia leve en la pieza tres punto seis con corona provisoria desadaptada.',
      originalText: 'Paciente Lucía Fernández Silva refiere molestia leve en la pieza 3.6 con corona provisoria desadaptada.',
      speaker: 'Odontólogo',
      edited: false,
      createdAt: now - 86400000 * 4,
      updatedAt: now - 86400000 * 4,
    },
    {
      id: id('seg_1_2'),
      sessionId: id('sess_1'),
      start: 15.0,
      end: 34.2,
      text: 'Realizamos tallado periférico completo en pieza 3.6, colocamos hilo retractor y tomamos impresión con silicona de adición para corona de zirconio color A2.',
      originalText: 'Realizamos tallado periférico completo en pieza 3.6, colocamos hilo retractor y tomamos impresión con silicona de adición para corona de zirconio color A2.',
      speaker: 'Odontólogo',
      edited: false,
      createdAt: now - 86400000 * 4,
      updatedAt: now - 86400000 * 4,
    },
  ];

  const segs2: TranscriptSegment[] = [
    {
      id: id('seg_2_1'),
      sessionId: id('sess_2'),
      start: 0,
      end: 18.4,
      text: 'Paciente Mateo Pereira concurre para limpieza ultrasónica y control del implante en pieza 4.6 previo a la instalación protésica.',
      originalText: 'Paciente Mateo Pereira concurre para limpieza ultrasónica y control del implante en pieza 4.6 previo a la instalación protésica.',
      speaker: 'Odontólogo',
      edited: false,
      createdAt: now - 86400000 * 2,
      updatedAt: now - 86400000 * 2,
    },
  ];

  await sharedTranscriptRepo.saveSegments([...segs1, ...segs2]);

  // 6. Odontograms & Periodontograms
  const odontogramLucia: OdontogramRecord = {
    id: id('odo_lucia'),
    workspaceId,
    patientId: id('pat_lucia'),
    label: 'Odontograma inicial de rehabilitación',
    dentition: 'adulto',
    teeth: {
      '1.6': { fdi: '1.6', status: 'obturada', surfaces: { O: 'obturada', M: 'obturada' }, updatedAt: now - 86400000 * 6 },
      '2.4': { fdi: '2.4', status: 'caries', surfaces: { D: 'caries' }, notes: 'Caries dentinaria distal', updatedAt: now - 86400000 * 6 },
      '3.6': { fdi: '3.6', status: 'endodoncia', surfaces: { O: 'corona' }, notes: 'Tallado para corona zirconio', updatedAt: now - 86400000 * 4 },
      '3.8': { fdi: '3.8', status: 'ausente', surfaces: {}, updatedAt: now - 86400000 * 6 },
      '4.8': { fdi: '4.8', status: 'ausente', surfaces: {}, updatedAt: now - 86400000 * 6 },
    },
    notes: 'Rehabilitación protésica en 3.6 y operatoria pendiente en 2.4.',
    createdBy: resolvedOwner.fullName,
    createdAt: now - 86400000 * 6,
    updatedAt: now - 86400000 * 4,
  };

  const odontogramMateo: OdontogramRecord = {
    id: id('odo_mateo'),
    workspaceId,
    patientId: id('pat_mateo'),
    label: 'Control de implantología y oclusión',
    dentition: 'adulto',
    teeth: {
      '4.6': { fdi: '4.6', status: 'implante', surfaces: {}, notes: 'Implante oseointegrado en fase protésica', updatedAt: now - 86400000 * 2 },
      '1.4': { fdi: '1.4', status: 'obturada', surfaces: { O: 'obturada' }, updatedAt: now - 86400000 * 5 },
      '2.6': { fdi: '2.6', status: 'corona', surfaces: {}, updatedAt: now - 86400000 * 5 },
    },
    createdBy: resolvedOwner.fullName,
    createdAt: now - 86400000 * 5,
    updatedAt: now - 86400000 * 2,
  };

  await sharedOdontogramRepo.create(odontogramLucia);
  await sharedOdontogramRepo.create(odontogramMateo);

  const perioJoaquin: PeriodontogramRecord = {
    id: id('perio_joaquin'),
    workspaceId,
    patientId: id('pat_joaquin'),
    label: 'Sondaje periodontal inicial',
    teeth: {
      '4.6': {
        fdi: '4.6',
        probingVestibular: [5, 4, 5],
        probingLingual: [4, 4, 5],
        recessionMm: 1,
        bleeding: true,
        suppuration: false,
        plaque: true,
        mobility: 1,
        furcation: 1,
        notes: 'Bolsa mesial de 5 mm, indicado raspaje y alisado.',
      },
      '4.7': {
        fdi: '4.7',
        probingVestibular: [4, 3, 4],
        probingLingual: [4, 3, 4],
        recessionMm: 1,
        bleeding: true,
        suppuration: false,
        plaque: true,
        mobility: 0,
      },
      '3.6': {
        fdi: '3.6',
        probingVestibular: [3, 2, 3],
        probingLingual: [3, 3, 3],
        recessionMm: 0,
        bleeding: false,
        suppuration: false,
        plaque: false,
        mobility: 0,
      },
    },
    notes: 'Control periodontal cada 90 días.',
    createdBy: resolvedOwner.fullName,
    createdAt: now - 86400000 * 4,
    updatedAt: now - 86400000 * 4,
  };

  await sharedPeriodontogramRepo.create(perioJoaquin);

  // 7. Clinical Evolutions
  const evolutions: ClinicalEvolutionEntry[] = [
    {
      id: id('evol_1'),
      workspaceId,
      patientId: id('pat_lucia'),
      date: fourDaysAgoStr,
      toothFdi: '3.6',
      procedure: 'Tallado e impresión definitiva para corona zirconio',
      description: 'Se retira provisorio, se regulariza terminación gingival en chamfer y se toma impresión con silicona de adición. Envío a Laboratorio Dental Montevideo color A2.',
      highlightColor: 'teal',
      professionalId: resolvedOwner.id,
      professionalName: resolvedOwner.fullName,
      sourceSessionId: id('sess_1'),
      sourceTreatmentPlanId: id('plan_lucia'),
      createdAt: now - 86400000 * 4,
      updatedAt: now - 86400000 * 4,
    },
    {
      id: id('evol_2'),
      workspaceId,
      patientId: id('pat_lucia'),
      date: addDaysIso(today, -8),
      toothFdi: '1.6',
      procedure: 'Restauración con composite simple',
      description: 'Eliminación de caries incipiente oclusal, grabado ácido, adhesivo universal y composite A2 fotopolimerizado.',
      highlightColor: 'blue',
      professionalId: resolvedEndo.id,
      professionalName: resolvedEndo.fullName,
      sourceTreatmentPlanId: id('plan_lucia'),
      createdAt: now - 86400000 * 8,
      updatedAt: now - 86400000 * 8,
    },
    {
      id: id('evol_3'),
      workspaceId,
      patientId: id('pat_mateo'),
      date: twoDaysAgoStr,
      toothFdi: '4.6',
      procedure: 'Limpieza ultrasónica y control periimplantario',
      description: 'Destartraje completo y pulido con pasta sin flúor alrededor del implante 4.6. Tejidos gingivales sin inflamación.',
      highlightColor: 'teal',
      professionalId: resolvedOwner.id,
      professionalName: resolvedOwner.fullName,
      sourceSessionId: id('sess_2'),
      sourceTreatmentPlanId: id('plan_mateo'),
      createdAt: now - 86400000 * 2,
      updatedAt: now - 86400000 * 2,
    },
  ];

  for (const evol of evolutions) {
    await sharedEvolutionRepo.create(evol);
  }

  // 8. Treatment Plans / Budgets (Single currency: UYU or selected currency)
  const plans: TreatmentPlan[] = [
    {
      id: id('plan_lucia'),
      workspaceId,
      patientId: id('pat_lucia'),
      patientName: 'Lucía Fernández Silva',
      title: 'Rehabilitación posterior y operatoria',
      currency,
      status: 'en_curso',
      professionalId: resolvedOwner.id,
      professionalName: resolvedOwner.fullName,
      validUntil: addDaysIso(today, 25),
      notes: 'Abono inicial del 50% al iniciar tallado.',
      items: [
        {
          id: 'it_lucia_1',
          procedure: 'Restauración con composite simple',
          toothFdi: '1.6',
          quantity: 1,
          unitPrice: 3200,
          discountPct: 0,
          completed: true,
          completedAt: now - 86400000 * 8,
          professionalId: resolvedEndo.id,
          professionalName: resolvedEndo.fullName,
        },
        {
          id: 'it_lucia_2',
          procedure: 'Corona de porcelana / zirconio',
          toothFdi: '3.6',
          quantity: 1,
          unitPrice: 22000,
          discountPct: 0,
          completed: true,
          completedAt: now - 86400000 * 4,
          professionalId: resolvedOwner.id,
          professionalName: resolvedOwner.fullName,
        },
        {
          id: 'it_lucia_3',
          procedure: 'Restauración con composite compleja',
          toothFdi: '2.4',
          quantity: 1,
          unitPrice: 4400,
          discountPct: 0,
          completed: false,
          professionalId: resolvedOwner.id,
          professionalName: resolvedOwner.fullName,
        },
      ],
      createdAt: now - 86400000 * 10,
      updatedAt: now - 86400000 * 4,
    },
    {
      id: id('plan_mateo'),
      workspaceId,
      patientId: id('pat_mateo'),
      patientName: 'Mateo Pereira Techera',
      title: 'Rehabilitación sobre implante 4.6 e higiene',
      currency,
      status: 'aprobado',
      professionalId: resolvedOwner.id,
      professionalName: resolvedOwner.fullName,
      validUntil: addDaysIso(today, 30),
      items: [
        {
          id: 'it_mateo_1',
          procedure: 'Limpieza ultrasónica y profilaxis',
          toothFdi: 'Arcada',
          quantity: 1,
          unitPrice: 2400,
          completed: true,
          completedAt: now - 86400000 * 2,
          professionalId: resolvedOwner.id,
          professionalName: resolvedOwner.fullName,
        },
        {
          id: 'it_mateo_2',
          procedure: 'Corona sobre implante dental',
          toothFdi: '4.6',
          quantity: 1,
          unitPrice: 26500,
          completed: false,
          professionalId: resolvedOwner.id,
          professionalName: resolvedOwner.fullName,
        },
      ],
      createdAt: now - 86400000 * 6,
      updatedAt: now - 86400000 * 2,
    },
    {
      id: id('plan_valentina'),
      workspaceId,
      patientId: id('pat_valentina'),
      patientName: 'Valentina Acosta Núñez',
      title: 'Estética dental y blanqueamiento LED',
      currency,
      status: 'presentado',
      professionalId: resolvedEndo.id,
      professionalName: resolvedEndo.fullName,
      validUntil: addDaysIso(today, 15),
      notes: 'Pendiente confirmación de la paciente.',
      items: [
        {
          id: 'it_val_1',
          procedure: 'Blanqueamiento dental en consultorio',
          quantity: 1,
          unitPrice: 9800,
          completed: false,
        },
        {
          id: 'it_val_2',
          procedure: 'Limpieza ultrasónica y profilaxis',
          quantity: 1,
          unitPrice: 2400,
          completed: false,
        },
      ],
      createdAt: now - 86400000 * 3,
      updatedAt: now - 86400000 * 3,
    },
    {
      id: id('plan_joaquin'),
      workspaceId,
      patientId: id('pat_joaquin'),
      patientName: 'Joaquín Méndez Cabrera',
      title: 'Terapia periodontal + placa de bruxismo',
      currency,
      status: 'borrador',
      professionalId: resolvedOwner.id,
      professionalName: resolvedOwner.fullName,
      items: [
        {
          id: 'it_joa_1',
          procedure: 'Raspaje y alisado radicular por cuadrante',
          quantity: 2,
          unitPrice: 5200,
          completed: false,
        },
        {
          id: 'it_joa_2',
          procedure: 'Placa miorelajante / bruxismo',
          quantity: 1,
          unitPrice: 8900,
          completed: false,
        },
      ],
      createdAt: now - 86400000 * 2,
      updatedAt: now - 86400000 * 2,
    },
  ];

  for (const plan of plans) {
    await sharedTreatmentPlanRepo.create(plan);
  }

  // 9. Financial Transactions (Charges, Patient Payments & Clinic/Provider Expenses in single currency)
  const transactions: FinancialTransaction[] = [
    {
      id: id('tx_lucia_c1'),
      workspaceId,
      patientId: id('pat_lucia'),
      patientName: 'Lucía Fernández Silva',
      type: 'charge',
      currency,
      amount: 3200,
      paymentMethod: 'cargo_clinico',
      concept: 'Restauración con composite simple (Pieza 1.6)',
      date: addDaysIso(today, -8),
      professionalId: resolvedEndo.id,
      professionalName: resolvedEndo.fullName,
      sourceTreatmentPlanId: id('plan_lucia'),
      sourceTreatmentItemId: 'it_lucia_1',
      createdAt: now - 86400000 * 8,
      updatedAt: now - 86400000 * 8,
    },
    {
      id: id('tx_lucia_c2'),
      workspaceId,
      patientId: id('pat_lucia'),
      patientName: 'Lucía Fernández Silva',
      type: 'charge',
      currency,
      amount: 22000,
      paymentMethod: 'cargo_clinico',
      concept: 'Corona de porcelana / zirconio (Pieza 3.6)',
      date: fourDaysAgoStr,
      professionalId: resolvedOwner.id,
      professionalName: resolvedOwner.fullName,
      sourceTreatmentPlanId: id('plan_lucia'),
      sourceTreatmentItemId: 'it_lucia_2',
      createdAt: now - 86400000 * 4,
      updatedAt: now - 86400000 * 4,
    },
    {
      id: id('tx_lucia_p1'),
      workspaceId,
      patientId: id('pat_lucia'),
      patientName: 'Lucía Fernández Silva',
      type: 'payment',
      currency,
      amount: 14200,
      paymentMethod: 'transferencia',
      concept: 'Entrega inicial corona 3.6 + composite 1.6',
      date: fourDaysAgoStr,
      professionalId: resolvedOwner.id,
      professionalName: resolvedOwner.fullName,
      receiptNumber: 'REC-UY-1001',
      notes: 'Transferencia BROU confirmada.',
      createdAt: now - 86400000 * 4 + 1000,
      updatedAt: now - 86400000 * 4 + 1000,
    },
    {
      id: id('tx_mateo_c1'),
      workspaceId,
      patientId: id('pat_mateo'),
      patientName: 'Mateo Pereira Techera',
      type: 'charge',
      currency,
      amount: 2400,
      paymentMethod: 'cargo_clinico',
      concept: 'Limpieza ultrasónica y profilaxis',
      date: twoDaysAgoStr,
      professionalId: resolvedOwner.id,
      professionalName: resolvedOwner.fullName,
      sourceTreatmentPlanId: id('plan_mateo'),
      sourceTreatmentItemId: 'it_mateo_1',
      createdAt: now - 86400000 * 2,
      updatedAt: now - 86400000 * 2,
    },
    {
      id: id('tx_mateo_p1'),
      workspaceId,
      patientId: id('pat_mateo'),
      patientName: 'Mateo Pereira Techera',
      type: 'payment',
      currency,
      amount: 2400,
      paymentMethod: 'tarjeta_debito',
      concept: 'Pago limpieza ultrasónica',
      date: twoDaysAgoStr,
      professionalId: resolvedOwner.id,
      professionalName: resolvedOwner.fullName,
      receiptNumber: 'REC-UY-1002',
      createdAt: now - 86400000 * 2 + 1000,
      updatedAt: now - 86400000 * 2 + 1000,
    },
    {
      id: id('tx_mateo_p2'),
      workspaceId,
      patientId: id('pat_mateo'),
      patientName: 'Mateo Pereira Techera',
      type: 'charge',
      currency,
      amount: 12000,
      paymentMethod: 'cargo_clinico',
      concept: 'Adelanto fase protésica implante 4.6',
      date: yesterdayStr,
      professionalId: resolvedOwner.id,
      professionalName: resolvedOwner.fullName,
      createdAt: now - 86400000 * 1,
      updatedAt: now - 86400000 * 1,
    },
    {
      id: id('tx_florencia_p1'),
      workspaceId,
      patientId: id('pat_florencia'),
      patientName: 'Florencia Suárez Olivera',
      type: 'payment',
      currency,
      amount: 8500,
      paymentMethod: 'mercadopago',
      concept: 'Seña carilla estética pieza 1.1',
      date: todayStr,
      professionalId: resolvedEndo.id,
      professionalName: resolvedEndo.fullName,
      receiptNumber: 'REC-UY-1003',
      createdAt: now - 3600000 * 3,
      updatedAt: now - 3600000 * 3,
    },
    {
      id: id('tx_santiago_c1'),
      workspaceId,
      patientId: id('pat_santiago'),
      patientName: 'Santiago Delgado Ramos',
      type: 'charge',
      currency,
      amount: 2800,
      paymentMethod: 'cargo_clinico',
      concept: 'Consulta de urgencia y reconstrucción provisoria 2.1',
      date: yesterdayStr,
      professionalId: resolvedOwner.id,
      professionalName: resolvedOwner.fullName,
      createdAt: now - 86400000 * 1,
      updatedAt: now - 86400000 * 1,
    },
    {
      id: id('tx_exp_1'),
      workspaceId,
      type: 'expense',
      currency,
      amount: 4950,
      paymentMethod: 'transferencia',
      concept: 'Insumos Odontológicos del Sur — Reposición mensual',
      date: yesterdayStr,
      professionalId: resolvedOwner.id,
      professionalName: resolvedOwner.fullName,
      notes: 'Factura A-00421 (guantes nitrilo, anestesia, ácido grabador).',
      createdAt: now - 86400000 * 1,
      updatedAt: now - 86400000 * 1,
    },
    {
      id: id('tx_exp_2'),
      workspaceId,
      type: 'expense',
      currency,
      amount: 3200,
      paymentMethod: 'efectivo',
      concept: 'Laboratorio Dental Montevideo — Adelanto trabajos fijos',
      date: todayStr,
      professionalId: resolvedOwner.id,
      professionalName: resolvedOwner.fullName,
      notes: 'Pago parcial orden corona 3.6.',
      createdAt: now - 3600000 * 2,
      updatedAt: now - 3600000 * 2,
    },
  ];

  for (const tx of transactions) {
    await sharedFinancialTxRepo.create(tx);
  }

  // 10. Lab Orders
  const labOrders: LabOrder[] = [
    {
      id: id('lab_1'),
      workspaceId,
      patientId: id('pat_lucia'),
      patientName: 'Lucía Fernández Silva',
      providerId: id('prov_lab_mvd'),
      providerName: 'Laboratorio Dental Montevideo',
      workType: 'Corona zirconio monolítico',
      toothFdi: '3.6',
      shade: 'A2',
      sentDate: fourDaysAgoStr,
      dueDate: todayStr,
      cost: 6800,
      currency,
      status: 'en_laboratorio',
      notes: 'Retirar antes de las 12:00 o confirmar envío.',
      createdAt: now - 86400000 * 4,
      updatedAt: now - 86400000 * 4,
    },
    {
      id: id('lab_2'),
      workspaceId,
      patientId: id('pat_florencia'),
      patientName: 'Florencia Suárez Olivera',
      providerId: id('prov_ceramica'),
      providerName: 'Cerámica & Estética Lab',
      workType: 'Carilla E-max disilicato de litio',
      toothFdi: '1.1',
      shade: 'B1',
      sentDate: addDaysIso(today, -6),
      dueDate: yesterdayStr, // Vencida para mostrar alerta en Facturas por pagar
      cost: 7400,
      currency,
      status: 'en_laboratorio',
      notes: 'Controlar translucidez en borde incisal.',
      createdAt: now - 86400000 * 6,
      updatedAt: now - 86400000 * 2,
    },
    {
      id: id('lab_3'),
      workspaceId,
      patientId: id('pat_mateo'),
      patientName: 'Mateo Pereira Techera',
      providerId: id('prov_lab_mvd'),
      providerName: 'Laboratorio Dental Montevideo',
      workType: 'Pilar personalizado + corona atornillada',
      toothFdi: '4.6',
      shade: 'A3',
      sentDate: addDaysIso(today, -7),
      dueDate: yesterdayStr,
      receivedDate: yesterdayStr,
      cost: 8900,
      currency,
      status: 'en_clinica',
      notes: 'Listo en recepción para el turno de hoy 10:30.',
      createdAt: now - 86400000 * 7,
      updatedAt: now - 86400000 * 1,
    },
    {
      id: id('lab_4'),
      workspaceId,
      patientId: id('pat_joaquin'),
      patientName: 'Joaquín Méndez Cabrera',
      providerId: id('prov_lab_mvd'),
      providerName: 'Laboratorio Dental Montevideo',
      workType: 'Placa miorelajante acrílico rígido',
      toothFdi: 'Arcada sup.',
      sentDate: todayStr,
      dueDate: inFiveDaysStr,
      cost: 3400,
      currency,
      status: 'sin_enviar',
      notes: 'Enviar modelos junto con registro de mordida.',
      createdAt: now - 3600000 * 5,
      updatedAt: now - 3600000 * 5,
    },
  ];

  for (const lab of labOrders) {
    await sharedLabOrderRepo.create(lab);
  }

  // 11. Activity Log
  const logs: ActivityLogEntry[] = [
    {
      id: id('act_1'),
      workspaceId,
      actionType: 'created',
      entityType: 'finance',
      summary: `Cobro registrado a Florencia Suárez Olivera ($ 8.500)`,
      details: 'Seña carilla estética pieza 1.1 · Mercado Pago',
      createdAt: now - 3600000 * 3,
    },
    {
      id: id('act_2'),
      workspaceId,
      actionType: 'status_changed',
      entityType: 'lab_order',
      summary: 'Trabajo de laboratorio recibido en clínica: Mateo Pereira Techera (4.6)',
      details: 'Laboratorio Dental Montevideo · Pilar + corona atornillada',
      createdAt: now - 86400000 * 1,
    },
    {
      id: id('act_3'),
      workspaceId,
      actionType: 'created',
      entityType: 'evolution',
      summary: 'Evolución clínica registrada: Lucía Fernández Silva (Pieza 3.6)',
      details: 'Tallado e impresión definitiva para corona zirconio',
      createdAt: now - 86400000 * 4,
    },
    {
      id: id('act_4'),
      workspaceId,
      actionType: 'transcribed',
      entityType: 'session',
      summary: 'Consulta dictada y estructurada: Mateo Pereira Techera',
      details: 'Profilaxis y control implante 4.6',
      createdAt: now - 86400000 * 2,
    },
  ];

  for (const log of logs) {
    await sharedActivityRepo.add(log);
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(seedFlagKey, '1');
    localStorage.setItem(seedDateKey, todayStr);
  }
  return true;
}
