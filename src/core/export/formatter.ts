import { formatClinicalNoteText } from '../clinical/clinicalTemplates';
import { Session, TranscriptSegment } from '../types';

export function formatTimeSrt(seconds: number): string {
  const pad = (n: number, z = 2) => ('00' + n).slice(-z);
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(ms, 3)}`;
}

export function formatTimeDisplay(seconds: number): string {
  const pad = (n: number) => ('00' + n).slice(-2);
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${pad(mins)}:${pad(secs)}`;
}

export const ExportFormatter = {
  toTxt(session: Session, segments: TranscriptSegment[]): string {
    const dateStr = new Date(session.createdAt).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const lines: string[] = [
      `CONSULTA ODONTOLÓGICA - ${session.title || 'Sin título'}`,
      `Fecha: ${dateStr}`,
      `Referencia: ${session.reference || 'No especificada'}`,
      `Duración: ${formatTimeDisplay(session.durationSec)}`,
      `----------------------------------------`,
      '',
    ];

    if (session.clinicalNote) {
      lines.push(formatClinicalNoteText(session, session.clinicalNote));
      lines.push('');
      lines.push('TRANSCRIPCIÓN COMPLETA:');
      lines.push('');
    }

    for (const seg of segments) {
      const time = `[${formatTimeDisplay(seg.start)} - ${formatTimeDisplay(seg.end)}]`;
      const speaker = seg.speaker ? `${seg.speaker}: ` : '';
      lines.push(`${time} ${speaker}${seg.text}`);
    }

    return lines.join('\n');
  },

  toMd(session: Session, segments: TranscriptSegment[]): string {
    const dateStr = new Date(session.createdAt).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const lines: string[] = [
      `# Consulta Odontológica: ${session.title || 'Sin título'}`,
      '',
      `- **Fecha:** ${dateStr}`,
      `- **Referencia / Paciente:** ${session.reference || 'N/A'}`,
      `- **Duración:** ${formatTimeDisplay(session.durationSec)}`,
      `- **Modelo usado:** ${session.modelTierUsed || 'Automático'}`,
      '',
    ];

    if (session.clinicalNote) {
      const n = session.clinicalNote;
      lines.push('## Ficha Clínica Estructurada', '');
      if (n.patient?.fullName) lines.push(`- **Paciente:** ${n.patient.fullName}`);
      if (n.patient?.documentNumber) {
        lines.push(
          `- **Documento:** ${n.patient.documentType || 'CI'} ${n.patient.documentNumber}`
        );
      }
      if (n.consultationDate) {
        lines.push(
          `- **Fecha de consulta:** ${n.consultationDate}${n.consultationTime ? ` ${n.consultationTime} hs` : ''}`
        );
      }
      if (n.professionalName) {
        lines.push(
          `- **Profesional:** ${n.professionalName}${n.professionalLicense ? ` · Mat. ${n.professionalLicense}` : ''}`
        );
      }
      if (n.detectedTeeth.length > 0) lines.push(`- **Piezas FDI:** ${n.detectedTeeth.join(', ')}`);
      if (n.chiefComplaint) lines.push(`- **Motivo / Relato:** ${n.chiefComplaint}`);
      if (n.currentIllness) lines.push(`- **Enfermedad actual:** ${n.currentIllness}`);
      if (n.medicalHistory) lines.push(`- **Antecedentes:** ${n.medicalHistory}`);
      if (n.allergies) lines.push(`- **Alergias:** ${n.allergies}`);
      if (n.medications) lines.push(`- **Medicación habitual:** ${n.medications}`);
      if (n.extraoralExam) lines.push(`- **Examen extraoral:** ${n.extraoralExam}`);
      if (n.findings) lines.push(`- **Hallazgos:** ${n.findings}`);
      if (n.diagnosis) lines.push(`- **Diagnóstico:** ${n.diagnosis}`);
      if (n.treatmentPlan) lines.push(`- **Plan de tratamiento:** ${n.treatmentPlan}`);
      if (n.procedure) lines.push(`- **Procedimiento:** ${n.procedure}`);
      if (n.anesthesia) lines.push(`- **Anestesia:** ${n.anesthesia}`);
      if (n.indications) lines.push(`- **Indicaciones:** ${n.indications}`);
      if (n.nextVisit) lines.push(`- **Próximo control:** ${n.nextVisit}`);
      if (n.observations) lines.push(`- **Observaciones:** ${n.observations}`);
      lines.push(`- **Consentimiento informado:** ${n.consentGiven ? 'Sí' : 'No registrado'}`);
      lines.push('');
    }

    lines.push(`## Transcripción`, '');

    for (const seg of segments) {
      const time = `\`${formatTimeDisplay(seg.start)} - ${formatTimeDisplay(seg.end)}\``;
      const speaker = seg.speaker ? `**${seg.speaker}:** ` : '';
      lines.push(`${time} ${speaker}${seg.text}\n`);
    }

    return lines.join('\n');
  },

  toSrt(segments: TranscriptSegment[]): string {
    return segments
      .map((seg, i) => {
        const index = i + 1;
        const time = `${formatTimeSrt(seg.start)} --> ${formatTimeSrt(seg.end)}`;
        const text = seg.speaker ? `${seg.speaker}: ${seg.text}` : seg.text;
        return `${index}\n${time}\n${text}\n`;
      })
      .join('\n');
  },

  toJson(session: Session, segments: TranscriptSegment[]): string {
    return JSON.stringify(
      {
        session: {
          id: session.id,
          title: session.title,
          reference: session.reference,
          createdAt: new Date(session.createdAt).toISOString(),
          durationSec: session.durationSec,
          consentGiven: session.consentGiven,
          modelTierUsed: session.modelTierUsed,
          clinicalNote: session.clinicalNote || null,
        },
        segments: segments.map((s) => ({
          id: s.id,
          start: s.start,
          end: s.end,
          text: s.text,
          originalText: s.originalText,
          speaker: s.speaker || null,
          edited: s.edited,
        })),
      },
      null,
      2
    );
  },

  toAiContext(session: Session, segments: TranscriptSegment[]): string {
    const dateStr = new Date(session.createdAt).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const lines: string[] = [
      `Contexto: A continuación se transcribe la conversación de una consulta odontológica grabada en consultorio.`,
      `Fecha de la sesión: ${dateStr}`,
      session.reference ? `Referencia / Código del paciente: ${session.reference}` : '',
      `Instrucción clínica: Utiliza este registro oral para redactar la historia clínica, resumen odontológico o plan de tratamiento correspondiente.`,
      `----------------------------------------`,
      `TRANSCRIPCIÓN DE LA CONSULTA:`,
      '',
    ].filter(Boolean);

    for (const seg of segments) {
      if (seg.speaker) {
        lines.push(`${seg.speaker}: ${seg.text}`);
      } else {
        lines.push(seg.text);
      }
    }

    return lines.join('\n\n');
  },

  toCleanPlainText(segments: TranscriptSegment[]): string {
    return segments
      .map((seg) => {
        const text = seg.text.trim();
        if (!text) return '';
        return seg.speaker ? `${seg.speaker}: ${text}` : text;
      })
      .filter(Boolean)
      .join('\n\n');
  },
};
