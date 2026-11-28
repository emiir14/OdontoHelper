import React, { useRef, useState } from 'react';
import { Camera, ChevronDown, ChevronUp, User } from 'lucide-react';
import { calculateAgeFromBirthDate } from '../../core/clinic/clinicHelpers';
import { Patient, PatientDraftInput } from '../../core/types';
import { revealExpandedSection } from '../../core/utils/scrollReveal';
import { useAppStore } from '../../store/useAppStore';
import { AutoResizeTextarea } from '../ui/AutoResizeTextarea';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { inputClass, inputMonoClass, labelCompactClass } from '../ui/uiClasses';

interface PatientEditModalProps {
  patient: Patient;
  onClose: () => void;
}

export const PatientEditModal: React.FC<PatientEditModalProps> = ({ patient, onClose }) => {
  const { updatePatient, showToast } = useAppStore();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const moreInfoRef = useRef<HTMLDivElement | null>(null);

  const [fullName, setFullName] = useState(patient.fullName || '');
  const [dni, setDni] = useState(patient.dni || '');
  const [documentType, setDocumentType] = useState<Patient['documentType']>(
    patient.documentType || 'CI'
  );
  const [hasBirthDate, setHasBirthDate] = useState(Boolean(patient.birthDate));
  const [birthDate, setBirthDate] = useState(patient.birthDate || '');
  const [gender, setGender] = useState<'F' | 'M' | 'X' | undefined>(patient.gender);
  const [phone, setPhone] = useState(patient.phone || '');
  const [email, setEmail] = useState(patient.email || '');
  const [address, setAddress] = useState(patient.address || '');
  const [secondaryPhone, setSecondaryPhone] = useState(patient.secondaryPhone || '');
  const [groupTag, setGroupTag] = useState(patient.groupTag || '');
  const [insuranceProvider, setInsuranceProvider] = useState(patient.insuranceProvider || '');
  const [insuranceNumber, setInsuranceNumber] = useState(patient.insuranceNumber || '');
  const [occupation, setOccupation] = useState(patient.occupation || '');
  const [maritalStatus, setMaritalStatus] = useState(patient.maritalStatus || '');
  const [emergencyContactName, setEmergencyContactName] = useState(
    patient.emergencyContactName || ''
  );
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    patient.emergencyContactPhone || ''
  );
  const [allergies, setAllergies] = useState(patient.allergies || '');
  const [medicalHistory, setMedicalHistory] = useState(patient.medicalHistory || '');
  const [chiefComplaint, setChiefComplaint] = useState(patient.chiefComplaint || '');
  const [notes, setNotes] = useState(patient.notes || '');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(patient.photoDataUrl);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [saving, setSaving] = useState(false);

  const computedAge = hasBirthDate ? calculateAgeFromBirthDate(birthDate) : null;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      showToast('La imagen no debe superar los 4 MB.', 'warning');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      showToast('El nombre del paciente es obligatorio.', 'warning');
      return;
    }
    setSaving(true);
    try {
      const nextBirth = hasBirthDate && birthDate ? birthDate : undefined;
      const nextAgeNum = nextBirth ? calculateAgeFromBirthDate(nextBirth) : null;
      const patch: Partial<PatientDraftInput> = {
        fullName: fullName.trim(),
        dni: dni.trim() || undefined,
        documentType,
        birthDate: nextBirth,
        age: nextAgeNum !== null ? `${nextAgeNum} años` : patient.age,
        gender,
        phone: phone.trim() || undefined,
        secondaryPhone: secondaryPhone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        groupTag: groupTag.trim() || undefined,
        occupation: occupation.trim() || undefined,
        maritalStatus: maritalStatus.trim() || undefined,
        emergencyContactName: emergencyContactName.trim() || undefined,
        emergencyContactPhone: emergencyContactPhone.trim() || undefined,
        photoDataUrl,
        insuranceProvider: insuranceProvider.trim() || undefined,
        insuranceNumber: insuranceNumber.trim() || undefined,
        allergies: allergies.trim() || undefined,
        medicalHistory: medicalHistory.trim() || undefined,
        chiefComplaint: chiefComplaint.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      await updatePatient(patient.id, patch);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      size="lg"
      title="Editar Paciente"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          <Button type="submit" form="patient-edit-form" variant="primary" loading={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </>
      }
    >
      <form id="patient-edit-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col items-center gap-2 pt-1">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center text-slate-400">
            {photoDataUrl ? (
              <img src={photoDataUrl} alt={fullName} className="w-full h-full object-cover" />
            ) : (
              <User className="w-8 h-8" />
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="hidden"
          />
          <div className="flex items-center gap-2">
            <Button
              variant="soft"
              size="xs"
              icon={<Camera className="w-3 h-3" />}
              onClick={() => fileRef.current?.click()}
            >
              Elegir foto
            </Button>
            {photoDataUrl && (
              <Button variant="ghost" size="xs" onClick={() => setPhotoDataUrl(undefined)}>
                Quitar
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className={labelCompactClass}>Nombre del paciente *</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nombre y apellido"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelCompactClass}>Tipo de documento</label>
            <select
              value={documentType || 'CI'}
              onChange={(e) => setDocumentType(e.target.value as Patient['documentType'])}
              className={inputClass}
            >
              {(['CI', 'DNI', 'Pasaporte', 'Otro'] as const).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCompactClass}>Cédula de identidad</label>
            <input
              type="text"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              placeholder="Ej: 4.512.890-3"
              className={inputMonoClass}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                Fecha de Nacimiento
              </label>
              <button
                type="button"
                role="switch"
                aria-checked={hasBirthDate}
                onClick={() => setHasBirthDate((v) => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                  hasBirthDate ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    hasBirthDate ? 'translate-x-4.5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {hasBirthDate && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className={`${inputMonoClass} flex-1 min-w-0`}
                />
                {computedAge !== null && (
                  <span className="text-[11px] text-slate-500 whitespace-nowrap font-mono">
                    ({computedAge} años)
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 py-1">
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
              Sexo:
            </span>
            {(['F', 'M', 'X'] as const).map((g) => (
              <label
                key={g}
                className="inline-flex items-center gap-1.5 text-xs text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <input
                  type="radio"
                  name="edit-patient-gender"
                  checked={gender === g}
                  onChange={() => setGender(g)}
                  className="accent-teal-600"
                />
                <span>{g}</span>
              </label>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCompactClass}>Teléfono móvil</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej: 099 412 890"
                className={inputMonoClass}
              />
            </div>

            <div>
              <label className={labelCompactClass}>Teléfono particular</label>
              <input
                type="tel"
                value={secondaryPhone}
                onChange={(e) => setSecondaryPhone(e.target.value)}
                placeholder="Ej: 2708 4412"
                className={inputMonoClass}
              />
            </div>
          </div>

          <div>
            <label className={labelCompactClass}>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="paciente@ejemplo.com"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelCompactClass}>Dirección</label>
            <AutoResizeTextarea
              minRows={1}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Calle, número, barrio"
            />
          </div>
        </div>

        <div
          ref={moreInfoRef}
          className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden"
        >
          <button
            type="button"
            aria-expanded={showMoreInfo}
            onClick={() => {
              const next = !showMoreInfo;
              setShowMoreInfo(next);
              if (next) revealExpandedSection(moreInfoRef.current);
            }}
            className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-slate-100/70 dark:hover:bg-slate-800 cursor-pointer"
          >
            <span>Más información</span>
            {showMoreInfo ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {showMoreInfo && (
            <div className="p-3.5 space-y-3 border-t border-slate-200/70 dark:border-slate-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCompactClass}>Grupo / Etiqueta</label>
                  <input
                    type="text"
                    value={groupTag}
                    onChange={(e) => setGroupTag(e.target.value)}
                    placeholder="Ej: Ortodoncia, Implantología"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelCompactClass}>Mutualista / Obra social</label>
                  <input
                    type="text"
                    value={insuranceProvider}
                    onChange={(e) => setInsuranceProvider(e.target.value)}
                    placeholder="Ej: CASMU, FONASA, Particular"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCompactClass}>Ocupación</label>
                  <input
                    type="text"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    placeholder="Ej: Docente"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelCompactClass}>Estado civil</label>
                  <input
                    type="text"
                    value={maritalStatus}
                    onChange={(e) => setMaritalStatus(e.target.value)}
                    placeholder="Ej: Casada/o"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCompactClass}>Contacto de emergencia</label>
                  <input
                    type="text"
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    placeholder="Nombre y vínculo"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelCompactClass}>Teléfono de emergencia</label>
                  <input
                    type="tel"
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    placeholder="Ej: 098 123 456"
                    className={inputMonoClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCompactClass}>N° de afiliado</label>
                  <input
                    type="text"
                    value={insuranceNumber}
                    onChange={(e) => setInsuranceNumber(e.target.value)}
                    placeholder="Credencial"
                    className={inputMonoClass}
                  />
                </div>
                <div>
                  <label className={labelCompactClass}>Alergias</label>
                  <AutoResizeTextarea
                    minRows={1}
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder="Ej: Penicilina, látex"
                  />
                </div>
              </div>

              <div>
                <label className={labelCompactClass}>Antecedentes médicos</label>
                <AutoResizeTextarea
                  minRows={2}
                  value={medicalHistory}
                  onChange={(e) => setMedicalHistory(e.target.value)}
                  placeholder="Medicación o enfermedades previas"
                />
              </div>

              <div>
                <label className={labelCompactClass}>Motivo de consulta</label>
                <AutoResizeTextarea
                  minRows={2}
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                />
              </div>

              <div>
                <label className={labelCompactClass}>Notas</label>
                <AutoResizeTextarea
                  minRows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
};
