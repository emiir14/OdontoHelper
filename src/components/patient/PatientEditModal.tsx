import React, { useRef, useState } from 'react';
import { Camera, ChevronDown, ChevronUp, User, X } from 'lucide-react';
import { calculateAgeFromBirthDate } from '../../core/clinic/clinicHelpers';
import { Patient, PatientDraftInput } from '../../core/types';
import { useAppStore } from '../../store/useAppStore';

interface PatientEditModalProps {
  patient: Patient;
  onClose: () => void;
}

export const PatientEditModal: React.FC<PatientEditModalProps> = ({ patient, onClose }) => {
  const { updatePatient, showToast } = useAppStore();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [fullName, setFullName] = useState(patient.fullName || '');
  const [dni, setDni] = useState(patient.dni || '');
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
        birthDate: nextBirth,
        age: nextAgeNum !== null ? `${nextAgeNum} años` : patient.age,
        gender,
        phone: phone.trim() || undefined,
        secondaryPhone: secondaryPhone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        groupTag: groupTag.trim() || undefined,
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

  const inputClass =
    'w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500';
  const labelClass = 'block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Editar Paciente
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-5 py-4 space-y-4">
          {/* Avatar Upload */}
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
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 transition-colors"
              >
                <Camera className="w-3 h-3" />
                <span>ELEGIR</span>
              </button>
              {photoDataUrl && (
                <button
                  type="button"
                  onClick={() => setPhotoDataUrl(undefined)}
                  className="text-[11px] text-slate-400 hover:text-rose-600"
                >
                  Quitar
                </button>
              )}
            </div>
          </div>

          {/* Core Identity Fields */}
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Nombre del paciente *</label>
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
              <label className={labelClass}>CI / ID</label>
              <input
                type="text"
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                placeholder="Ej: 4.512.890-3"
                className={`${inputClass} font-mono tabular-nums`}
              />
            </div>

            {/* Birth Date toggle + input */}
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
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
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
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className={`${inputClass} font-mono tabular-nums`}
                  />
                  {computedAge !== null && (
                    <span className="text-[11px] text-slate-500 whitespace-nowrap font-mono">
                      ({computedAge} años)
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Gender */}
            <div className="flex items-center gap-4 py-1">
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
                <label className={labelClass}>Teléfono móvil</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej: 099 412 890"
                  className={`${inputClass} font-mono tabular-nums`}
                />
              </div>

              <div>
                <label className={labelClass}>Teléfono particular</label>
                <input
                  type="tel"
                  value={secondaryPhone}
                  onChange={(e) => setSecondaryPhone(e.target.value)}
                  placeholder="Ej: 2708 4412"
                  className={`${inputClass} font-mono tabular-nums`}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="paciente@ejemplo.com"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Dirección</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Calle, número, barrio"
                className={inputClass}
              />
            </div>
          </div>

          {/* Expandable Más información */}
          <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowMoreInfo((v) => !v)}
              className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-slate-100/70 dark:hover:bg-slate-800"
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
                    <label className={labelClass}>Grupo / Etiqueta</label>
                    <input
                      type="text"
                      value={groupTag}
                      onChange={(e) => setGroupTag(e.target.value)}
                      placeholder="Ej: Ortodoncia, Implantología"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Mutualista / Obra social</label>
                    <input
                      type="text"
                      value={insuranceProvider}
                      onChange={(e) => setInsuranceProvider(e.target.value)}
                      placeholder="Ej: CASMU, Particular"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>N° de afiliado</label>
                    <input
                      type="text"
                      value={insuranceNumber}
                      onChange={(e) => setInsuranceNumber(e.target.value)}
                      placeholder="Credencial"
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Alergias</label>
                    <input
                      type="text"
                      value={allergies}
                      onChange={(e) => setAllergies(e.target.value)}
                      placeholder="Ej: Penicilina, látex"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Antecedentes médicos</label>
                  <input
                    type="text"
                    value={medicalHistory}
                    onChange={(e) => setMedicalHistory(e.target.value)}
                    placeholder="Medicación o enfermedades previas"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Motivo de consulta</label>
                  <textarea
                    rows={2}
                    value={chiefComplaint}
                    onChange={(e) => setChiefComplaint(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Notas</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              CERRAR
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? 'GUARDANDO...' : 'GUARDAR'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
