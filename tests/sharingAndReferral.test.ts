import { describe, expect, it } from 'vitest';
import {
  buildExternalReferralWhatsAppText,
  buildInternalShareWhatsAppMessage,
  canMutateClinicalRecord,
  generateShareInviteToken,
  summarizeOdontogramFindings,
} from '../src/core/clinic/referralExport';
import {
  buildAppUrl,
  isOpaqueEntityId,
  parseAppLocation,
  sanitizeInternalNextPath,
} from '../src/core/routing/appRoutes';
import { ClinicalEvolutionEntry, OdontogramRecord, Patient, PatientFileAttachment } from '../src/core/types';

describe('Clinical Referral Export & Privacy Guards', () => {
  const samplePatient: Patient = {
    id: 'pat_1',
    workspaceId: 'ws_owner',
    fullName: 'Lucía Fernández',
    dni: '35444222',
    birthDate: '1991-04-12',
    phone: '+5491155551234',
    insuranceProvider: 'OSDE 310',
    insuranceNumber: '987654',
    allergies: 'Penicilina',
    chiefComplaint: 'Dolor al masticar en molar inferior izquierdo',
    medicalHistory: 'Sin otras patologías relevantes.',
    anamnesis: {
      hypertension: false,
      diabetes: false,
      bruxism: true,
      takesMedication: true,
      medicationDetail: 'Ibuprofeno 400mg ocasional',
    },
    physicalExam: {
      bloodPressure: '115/75 mmHg',
      tmj: 'Chasquido leve bilateral',
      oralHygiene: 'Buena',
    },
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  };

  const sampleOdontogram: OdontogramRecord = {
    id: 'odon_1',
    workspaceId: 'ws_owner',
    patientId: 'pat_1',
    label: 'Ingreso endodoncia',
    dentition: 'adulto',
    createdBy: 'Dra. Sofía Méndez',
    authorUserId: 'usr_a',
    authorWorkspaceId: 'ws_owner',
    teeth: {
      '1.1': { fdi: '1.1', status: 'sano', surfaces: {}, updatedAt: 1700000000000 },
      '3.6': {
        fdi: '3.6',
        status: 'endodoncia',
        surfaces: { O: 'caries', M: 'obturada' },
        notes: 'Lesión periapical en raíz mesial',
        updatedAt: 1700000000000,
      },
      '4.6': {
        fdi: '4.6',
        status: 'corona',
        surfaces: {},
        updatedAt: 1700000000000,
      },
    },
    notes: 'Requiere tomografía cone beam',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  };

  const sampleEvolutions: ClinicalEvolutionEntry[] = [
    {
      id: 'evol_1',
      workspaceId: 'ws_owner',
      patientId: 'pat_1',
      date: '2026-03-10',
      toothFdi: '3.6',
      procedure: 'Apertura y medicación intraconducto',
      description: 'Se realiza acceso cameral bajo aislamiento absoluto e hidróxido de calcio.',
      highlightColor: 'teal',
      professionalName: 'Dra. Sofía Méndez',
      authorUserId: 'usr_a',
      authorWorkspaceId: 'ws_owner',
      createdAt: 1700000001000,
      updatedAt: 1700000001000,
    },
  ];

  const sampleFiles: PatientFileAttachment[] = [
    {
      id: 'file_1',
      workspaceId: 'ws_owner',
      patientId: 'pat_1',
      name: 'rx_periapical_36.png',
      category: 'radiografia',
      mimeType: 'image/png',
      sizeBytes: 120000,
      dataUrl: 'data:image/png;base64,abc',
      notes: 'Periapical inicial',
      uploadedBy: 'Dra. Sofía Méndez',
      authorUserId: 'usr_a',
      authorWorkspaceId: 'ws_owner',
      capturedAt: '2026-03-10',
      createdAt: 1700000002000,
    },
  ];

  it('summarizes odontogram findings in FDI order without healthy-only teeth', () => {
    const findings = summarizeOdontogramFindings(sampleOdontogram);
    expect(findings).toHaveLength(2);
    expect(findings[0].fdi).toBe('3.6');
    expect(findings[0].summary).toContain('Endodoncia');
    expect(findings[0].summary).toContain('Oclusal/Incisal: Caries / Lesión');
    expect(findings[0].notes).toBe('Lesión periapical en raíz mesial');
    expect(findings[1].fdi).toBe('4.6');
    expect(findings[1].summary).toBe('Corona');
  });

  it('builds external WhatsApp clinical summary with clinical context and zero pricing/budget info', () => {
    const text = buildExternalReferralWhatsAppText({
      patient: samplePatient,
      practitionerName: 'Dra. Sofía Méndez',
      practitionerSpecialty: 'Endodoncia',
      practitionerLicense: 'MN 44120',
      referralNote: 'Derivo para retratamiento de conducto en 3.6.',
      latestOdontogram: sampleOdontogram,
      evolutions: sampleEvolutions,
      files: sampleFiles,
    });

    expect(text).toContain('Lucía Fernández');
    expect(text).toContain('Penicilina');
    expect(text).toContain('Bruxismo / ATM');
    expect(text).toContain('Ibuprofeno 400mg ocasional');
    expect(text).toContain('Derivo para retratamiento de conducto en 3.6.');
    expect(text).toContain('Pieza 3.6');
    expect(text).toContain('Apertura y medicación intraconducto');
    expect(text).toContain('Dra. Sofía Méndez');
    expect(text).toContain('rx_periapical_36.png');
    expect(text).toContain('sin importes ni presupuestos');
    expect(text).not.toMatch(/\$\s?\d/);
    expect(text).not.toContain('Saldo actual');
  });

  it('builds internal WhatsApp invitation message without leaking budgets', () => {
    const msg = buildInternalShareWhatsAppMessage({
      ownerName: 'Dra. Sofía Méndez',
      patientName: 'Lucía Fernández',
      shareUrl: 'https://app.odontohelper.com/compartir/shr_abc123def456',
      referralNote: 'Interconsulta periodontal',
    });

    expect(msg).toContain('https://app.odontohelper.com/compartir/shr_abc123def456');
    expect(msg).toContain('Interconsulta periodontal');
    expect(msg).toContain('presupuestos y caja quedan privados');
  });

  it('generates opaque, unique single-use invite tokens', () => {
    const t1 = generateShareInviteToken();
    const t2 = generateShareInviteToken();
    expect(t1).not.toBe(t2);
    expect(t1.startsWith('shr_')).toBe(true);
    expect(isOpaqueEntityId(t1)).toBe(true);
    expect(isOpaqueEntityId(t2)).toBe(true);
  });

  it('enforces strict author immutability via canMutateClinicalRecord', () => {
    const authoredByA = {
      workspaceId: 'ws_owner',
      authorUserId: 'usr_a',
      authorWorkspaceId: 'ws_owner',
    };
    expect(canMutateClinicalRecord(authoredByA, 'ws_owner', 'usr_a')).toBe(true);
    expect(canMutateClinicalRecord(authoredByA, 'ws_colleague', 'usr_b')).toBe(false);

    const authoredByBInSharedPatient = {
      workspaceId: 'ws_owner',
      authorUserId: 'usr_b',
      authorWorkspaceId: 'ws_colleague',
    };
    expect(canMutateClinicalRecord(authoredByBInSharedPatient, 'ws_colleague', 'usr_b')).toBe(true);
    expect(canMutateClinicalRecord(authoredByBInSharedPatient, 'ws_owner', 'usr_a')).toBe(false);

    const legacyOwnerRecord = { workspaceId: 'ws_owner' };
    expect(canMutateClinicalRecord(legacyOwnerRecord, 'ws_owner', 'usr_a')).toBe(true);
    expect(canMutateClinicalRecord(legacyOwnerRecord, 'ws_colleague', 'usr_b')).toBe(false);
  });
});

describe('Share Link Routing (/compartir/:token)', () => {
  it('parses /compartir/:token cleanly without PII', () => {
    const token = 'shr_0123456789abcdef0123456789abcdef0123';
    const parsed = parseAppLocation(`/compartir/${token}`);
    expect(parsed.shareInviteToken).toBe(token);
    expect(parsed.currentView).toBe('patients-search');
    expect(parsed.hadForbiddenPii).toBe(false);
  });

  it('preserves /compartir/:token across login next= redirect and builds canonical share URL', () => {
    const token = 'shr_0123456789abcdef0123456789abcdef0123';
    const nextPath = sanitizeInternalNextPath(`/compartir/${token}`);
    expect(nextPath).toBe(`/compartir/${token}`);

    const loginUrl = buildAppUrl({
      authRequired: true,
      currentView: 'patients-search',
      postLoginRedirect: nextPath,
    });
    expect(loginUrl).toBe(`/login?next=${encodeURIComponent(`/compartir/${token}`)}`);

    const activeShareUrl = buildAppUrl({
      authRequired: false,
      currentView: 'patients-search',
      shareInviteToken: token,
    });
    expect(activeShareUrl).toBe(`/compartir/${token}`);
  });
});
