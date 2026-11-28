import { describe, expect, it } from 'vitest';
import {
  buildPatientFieldsFromClinicalNote,
  clinicalNotePatientName,
  findPatientForClinicalNote,
} from '../src/core/clinical/clinicalRecord';
import {
  buildDraftClinicalNote,
  buildPatientSnapshot,
  createEmptyClinicalNote,
  formatClinicalNoteText,
  hydrateClinicalNote,
} from '../src/core/clinical/clinicalTemplates';
import {
  packPatientAnamnesis,
  unpackPatientProfileMeta,
} from '../src/core/clinic/clinicHelpers';
import { ClinicalNote, Patient, Session, TranscriptSegment } from '../src/core/types';

const session: Session = {
  id: 'sess_ficha_1',
  workspaceId: 'ws_1',
  title: 'Consulta de María Gómez',
  reference: 'María Gómez',
  status: 'completed',
  durationSec: 320,
  consentGiven: true,
  audioDeleted: false,
  createdAt: new Date('2026-11-20T13:45:00').getTime(),
  updatedAt: new Date('2026-11-20T13:45:00').getTime(),
};

const patient: Patient = {
  id: 'pat_1',
  workspaceId: 'ws_1',
  fullName: 'María Fernanda Gómez',
  dni: '3.456.789-0',
  documentType: 'CI',
  birthDate: '1990-04-12',
  age: '36',
  gender: 'F',
  phone: '099 412 890',
  email: 'maria@example.com',
  address: 'Av. 18 de Julio 1234, Montevideo',
  insuranceProvider: 'FONASA',
  insuranceNumber: '123456',
  occupation: 'Docente',
  maritalStatus: 'Casada',
  emergencyContactName: 'Juan Gómez (esposo)',
  emergencyContactPhone: '098 123 456',
  allergies: 'Penicilina',
  medicalHistory: 'Hipertensión controlada',
  chiefComplaint: 'Dolor en pieza 4.6',
  createdAt: 1,
  updatedAt: 1,
};

function segment(text: string, speaker?: string): TranscriptSegment {
  return {
    id: `seg_${Math.random()}`,
    sessionId: session.id,
    start: 0,
    end: 5,
    text,
    originalText: text,
    speaker,
    edited: false,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('Ficha clínica odontológica (Uruguay)', () => {
  it('builds a complete draft from the transcript, including anamnesis sections', () => {
    const note = buildDraftClinicalNote(
      [
        segment('Me duele al morder del lado derecho.', 'Paciente'),
        segment('Soy hipertensa y tomo enalapril.', 'Paciente'),
        segment('Es alérgica a la penicilina.', 'Odontólogo'),
        segment('Hay caries profunda en la pieza 4.6.', 'Odontólogo'),
        segment('Realizamos apertura y conductometría con anestesia troncular.', 'Odontólogo'),
        segment('Indico ibuprofeno 600 mg cada 8 horas.', 'Odontólogo'),
        segment('Próximo control en 15 días.', 'Odontólogo'),
      ],
      'endodoncia'
    );

    expect(note.templateId).toBe('endodoncia');
    expect(note.detectedTeeth).toEqual(['4.6']);
    expect(note.chiefComplaint).toContain('Me duele al morder');
    expect(note.medicalHistory).toContain('hipertensa');
    expect(note.medications).toContain('enalapril');
    expect(note.allergies).toContain('penicilina');
    expect(note.findings).toContain('caries profunda');
    expect(note.diagnosis).toContain('caries profunda');
    expect(note.procedure).toContain('conductometría');
    expect(note.anesthesia).toContain('anestesia troncular');
    expect(note.indications).toContain('ibuprofeno');
    expect(note.nextVisit).toContain('15 días');
  });

  it('hydrates patient identity, encounter date/time and professional data', () => {
    const note = hydrateClinicalNote(
      createEmptyClinicalNote('operatoria', { chiefComplaint: 'Sensibilidad' }),
      session,
      patient,
      { fullName: 'Dra. Ana Pérez', specialty: 'Odontología General', licenseNumber: '12345' }
    );

    expect(note.patient?.fullName).toBe('María Fernanda Gómez');
    expect(note.patient?.patientId).toBe('pat_1');
    expect(note.patient?.documentType).toBe('CI');
    expect(note.patient?.documentNumber).toBe('3.456.789-0');
    expect(note.patient?.insuranceProvider).toBe('FONASA');
    expect(note.patient?.occupation).toBe('Docente');
    expect(note.patient?.emergencyContactName).toContain('Juan Gómez');
    expect(note.consultationDate).toBe('2026-11-20');
    expect(note.consultationTime).toBe('13:45');
    expect(note.consultationType).toBe('primera_consulta');
    expect(note.allergies).toBe('Penicilina');
    expect(note.medicalHistory).toBe('Hipertensión controlada');
    expect(note.professionalName).toBe('Dra. Ana Pérez');
    expect(note.professionalLicense).toBe('12345');
  });

  it('builds a patient snapshot from session reference when no patient is linked', () => {
    const snapshot = buildPatientSnapshot(undefined, session);
    expect(snapshot.fullName).toBe('María Gómez');
    expect(snapshot.patientId).toBeUndefined();
  });

  it('finds an existing patient by document or exact name', () => {
    const byDocument = findPatientForClinicalNote(
      { ...createEmptyClinicalNote(), patient: { fullName: 'M. Gómez', documentNumber: '34567890' } },
      session,
      [patient]
    );
    expect(byDocument?.id).toBe('pat_1');

    const byName = findPatientForClinicalNote(
      { ...createEmptyClinicalNote(), patient: { fullName: '  maría fernanda gómez ' } },
      session,
      [patient]
    );
    expect(byName?.id).toBe('pat_1');

    const unknown = findPatientForClinicalNote(
      { ...createEmptyClinicalNote(), patient: { fullName: 'Otro Paciente' } },
      session,
      [patient]
    );
    expect(unknown).toBeUndefined();
  });

  it('maps ficha sections to patient model fields without erasing empty data', () => {
    const note: ClinicalNote = {
      ...createEmptyClinicalNote('general'),
      patient: {
        fullName: 'María Fernanda Gómez',
        documentType: 'CI',
        documentNumber: '3.456.789-0',
        phone: '099 412 890',
        insuranceProvider: 'FONASA',
        occupation: 'Docente',
      },
      allergies: 'Penicilina',
      medicalHistory: 'Hipertensión',
      chiefComplaint: 'Dolor 4.6',
      extraoralExam: 'ATM sin ruidos',
      findings: 'Caries oclusal',
      nextVisit: 'Control el 2026-12-05',
    };

    const fields = buildPatientFieldsFromClinicalNote(note);
    expect(fields.fullName).toBe('María Fernanda Gómez');
    expect(fields.dni).toBe('3.456.789-0');
    expect(fields.documentType).toBe('CI');
    expect(fields.insuranceProvider).toBe('FONASA');
    expect(fields.occupation).toBe('Docente');
    expect(fields.allergies).toBe('Penicilina');
    expect(fields.medicalHistory).toBe('Hipertensión');
    expect(fields.chiefComplaint).toBe('Dolor 4.6');
    expect(fields.physicalExam?.observations).toContain('ATM sin ruidos');
    expect(fields.physicalExam?.observations).toContain('Caries oclusal');
    expect(fields.nextControlDate).toBe('2026-12-05');
    expect(fields.nextControlNote).toBe('Control el 2026-12-05');

    const empty = buildPatientFieldsFromClinicalNote(createEmptyClinicalNote());
    expect(empty).toEqual({});
  });

  it('formats the full Uruguayan dental record with patient identity and all sections', () => {
    const note = hydrateClinicalNote(
      {
        ...createEmptyClinicalNote('cirugia'),
        detectedTeeth: ['4.8'],
        chiefComplaint: 'Dolor agudo',
        extraoralExam: 'ATM sin ruidos, ganglios no palpables',
        findings: 'Caries oclusal en 4.8',
        diagnosis: 'Pulpitis irreversible',
        treatmentPlan: 'Exodoncia y control postquirúrgico',
        procedure: 'Exodoncia pieza 4.8',
        anesthesia: 'Lidocaína 2%',
        indications: 'Ibuprofeno 600 mg',
        nextVisit: 'Control en 7 días',
        consentGiven: true,
      },
      session,
      patient,
      { fullName: 'Dra. Ana Pérez', licenseNumber: '12345' }
    );

    const text = formatClinicalNoteText(session, note);
    expect(text).toContain('FICHA CLÍNICA ODONTOLÓGICA (CIRUGÍA / IMPLANTES)');
    expect(text).toContain('DATOS DEL PACIENTE');
    expect(text).toContain('María Fernanda Gómez');
    expect(text).toContain('Documento de identidad: CI 3.456.789-0');
    expect(text).toContain('Cobertura: FONASA');
    expect(text).toContain('DATOS DE LA CONSULTA');
    expect(text).toContain('Piezas FDI detectadas: 4.8');
    expect(text).toContain('ANAMNESIS');
    expect(text).toContain('EXAMEN CLÍNICO');
    expect(text).toContain('DIAGNÓSTICO');
    expect(text).toContain('PLAN DE TRATAMIENTO');
    expect(text).toContain('PROCEDIMIENTO REALIZADO');
    expect(text).toContain('Anestesia:');
    expect(text).toContain('INDICACIONES Y CONTROL');
    expect(text).toContain('CONSENTIMIENTO INFORMADO');
    expect(text).toContain('Consentimiento informado: Sí, otorgado');
    expect(text).toContain('FIRMA DEL PROFESIONAL');
    expect(text).toContain('Matrícula MSP: 12345');
  });

  it('uses the note patient name before the session reference when saving', () => {
    const note = {
      ...createEmptyClinicalNote(),
      patient: { fullName: '  Nuevo Paciente  ' },
    };
    expect(clinicalNotePatientName(note, session)).toBe('Nuevo Paciente');
  });

  it('persists new filiation fields inside patients.anamnesis JSONB', () => {
    const packed = packPatientAnamnesis({
      documentType: 'CI',
      occupation: 'Docente',
      maritalStatus: 'Casada',
      emergencyContactName: 'Juan Gómez',
      emergencyContactPhone: '098 123 456',
    });
    const meta = unpackPatientProfileMeta(packed);
    expect(meta.documentType).toBe('CI');
    expect(meta.occupation).toBe('Docente');
    expect(meta.maritalStatus).toBe('Casada');
    expect(meta.emergencyContactName).toBe('Juan Gómez');
    expect(meta.emergencyContactPhone).toBe('098 123 456');
  });
});
