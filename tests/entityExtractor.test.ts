import { describe, expect, it } from 'vitest';
import {
  extractAppointmentFromTranscript,
  extractPatientFromTranscript,
  extractProviderFromTranscript,
} from '../src/core/clinical/entityExtractor';

describe('extractPatientFromTranscript', () => {
  it('extracts structured patient fields from natural Spanish clinical dictation', () => {
    const transcript =
      'Nuevo paciente Lucía Fernández, DNI 35.420.118, tiene 33 años, nació el 12 de mayo de 1988, teléfono 11 5544 3322, correo lucia arroba gmail punto com, domicilio Av. Santa Fe 1420, obra social OSDE, afiliado 405012, alergia a la penicilina, antecedentes hipertensión controlada, motivo de consulta dolor agudo en pieza 3.6.';

    const res = extractPatientFromTranscript(transcript);

    expect(res.fullName).toBe('Lucía Fernández');
    expect(res.dni).toBe('35.420.118');
    expect(res.age).toBe('33');
    expect(res.birthDate).toBe('1988-05-12');
    expect(res.phone).toBe('11 5544 3322');
    expect(res.email).toBe('lucia@gmail.com');
    expect(res.address).toBe('Av. Santa Fe 1420');
    expect(res.insuranceProvider).toBe('OSDE');
    expect(res.insuranceNumber).toBe('405012');
    expect(res.allergies).toContain('penicilina');
    expect(res.medicalHistory).toContain('hipertensión controlada');
    expect(res.chiefComplaint).toContain('pieza 3.6');
    expect(res.notes).toContain('3.6');
  });
});

describe('extractProviderFromTranscript', () => {
  it('extracts structured provider fields from natural Spanish dictation', () => {
    const transcript =
      'Nuevo proveedor Laboratorio Dental Sur, contacto Martín Gómez, CUIT 30-71234567-9, teléfono 11 4890 1122, mail pedidos arroba dentalsur punto com, dirección Av. Rivadavia 4200, productos coronas de zirconio y prótesis flexibles, condiciones de pago cuenta corriente 30 días.';

    const res = extractProviderFromTranscript(transcript);

    expect(res.name).toBe('Laboratorio Dental Sur');
    expect(res.category).toBe('laboratorio');
    expect(res.contactName).toBe('Martín Gómez');
    expect(res.taxId).toBe('30-71234567-9');
    expect(res.phone).toBe('11 4890 1122');
    expect(res.email).toBe('pedidos@dentalsur.com');
    expect(res.address).toBe('Av. Rivadavia 4200');
    expect(res.specialtyOrProducts).toContain('coronas de zirconio');
    expect(res.paymentTerms).toContain('cuenta corriente 30 días');
  });
});

describe('extractAppointmentFromTranscript', () => {
  // Monday, 2026-11-16
  const refMonday = new Date(2026, 10, 16, 12, 0, 0);

  it('extracts explicit spoken date, time and procedure from consultation closing', () => {
    const res = extractAppointmentFromTranscript(
      'Realizamos apertura cameral en pieza 3.6. Nos vemos el 25 de noviembre a las 15:30 para control de endodoncia.',
      refMonday
    );
    expect(res).not.toBeNull();
    expect(res?.date).toBe('2026-11-25');
    expect(res?.startTime).toBe('15:30');
    expect(res?.procedure.toLowerCase()).toContain('endodoncia');
  });

  it('resolves relative Spanish weekdays and afternoon spoken hours', () => {
    const res = extractAppointmentFromTranscript(
      'Te espero el próximo jueves a las 4 de la tarde para retiro de puntos.',
      refMonday
    );
    expect(res).not.toBeNull();
    expect(res?.date).toBe('2026-11-19');
    expect(res?.startTime).toBe('16:00');
    expect(res?.procedure).toContain('Retiro de puntos');
  });

  it('resolves numeric dates with scheduling cue and relative week offsets', () => {
    const numeric = extractAppointmentFromTranscript(
      'Agendamos turno el 4/12 a las 10 de la mañana para limpieza dental.',
      refMonday
    );
    expect(numeric?.date).toBe('2026-12-04');
    expect(numeric?.startTime).toBe('10:00');

    const offset = extractAppointmentFromTranscript(
      'Volvé en dos semanas a las 9 y media para cementado definitivo.',
      refMonday
    );
    expect(offset?.date).toBe('2026-11-30');
    expect(offset?.startTime).toBe('09:30');
    expect(offset?.procedure).toContain('Cementado definitivo');
  });

  it('ignores birth dates, past dates, and "por la mañana" medication instructions', () => {
    const pastAndMeds = extractAppointmentFromTranscript(
      'Paciente nació el 12 de mayo de 1988. Tuvo dolor el martes pasado. Tomar ibuprofeno 600 mg por la mañana.',
      refMonday
    );
    expect(pastAndMeds).toBeNull();
  });
});
