import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

const PatientBookPage = () => {
  const router = useRouter();
  const { bookNumber } = router.query;

  const [patient, setPatient] = useState(null);
  const [encounters, setEncounters] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [editForm, setEditForm] = useState({ birthDate: '', gender: '', regNo: '' });
  const [isEditing, setIsEditing] = useState(false);

  const [regNoParse, setRegNoParse] = useState({
    isValidRegNo: null,
    reason: '',
    loading: false,
  });

  const [saveError, setSaveError] = useState('');
  const [activeTab, setActiveTab] = useState('profile');

  const lastRegNoRequestIdRef = useRef(0);

  const fetchPatientData = async (bookNum) => {
    const res = await axios.get(`/api/patients/profile/by-book/${encodeURIComponent(bookNum)}`);
    const data = res.data;
    setPatient(data.patient);
    setEncounters(data.encounters || []);
    setAppointments(data.appointments || []);
    setEditForm({
      regNo: data.patient?.regNo || '',
      birthDate: data.patient?.birthDate ? data.patient.birthDate.slice(0, 10) : '',
      gender: data.patient?.gender || '',
    });
  };

  useEffect(() => {
    if (bookNumber && typeof bookNumber === 'string') {
      fetchPatientData(bookNumber);
    }
  }, [bookNumber]);

  const calculateAge = (birthDate) => {
    if (!birthDate) return '-';
    const d = new Date(birthDate);
    if (Number.isNaN(d.getTime())) return '-';

    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
      age--;
    }

    return Number.isFinite(age) && age >= 0 ? age : '-';
  };

  const age = useMemo(() => calculateAge(editForm.birthDate || patient?.birthDate), [editForm.birthDate, patient?.birthDate]);

  const parseRegNoAndAutofill = async (newRegNo) => {
    const requestId = ++lastRegNoRequestIdRef.current;

    const regNoTrimmed = String(newRegNo || '').trim();
    if (!regNoTrimmed) {
      setRegNoParse({ isValidRegNo: null, reason: '', loading: false });
      return;
    }

    setRegNoParse((s) => ({ ...s, loading: true }));

    try {
      const response = await axios.get(`/api/regno/parse?regNo=${encodeURIComponent(regNoTrimmed)}`);

      // ignore stale responses
      if (requestId !== lastRegNoRequestIdRef.current) return;

      if (response.data?.isValid) {
        setEditForm((prev) => ({
          ...prev,
          birthDate: response.data.birthDate || prev.birthDate,
          gender: response.data.gender || prev.gender,
        }));
        setRegNoParse({ isValidRegNo: true, reason: '', loading: false });
      } else {
        setRegNoParse({ isValidRegNo: false, reason: response.data?.reason || '', loading: false });
      }
    } catch (e) {
      if (requestId !== lastRegNoRequestIdRef.current) return;
      setRegNoParse({ isValidRegNo: false, reason: 'РД шалгах үед алдаа гарлаа', loading: false });
    }
  };

  const handleRegNoChange = async (newRegNo) => {
    setEditForm((prev) => ({ ...prev, regNo: newRegNo }));
    await parseRegNoAndAutofill(newRegNo);
  };

  const handleSave = async () => {
    try {
      setSaveError('');

      if (!patient?.id) {
        setSaveError('Өвчтөний мэдээлэл олдсонгүй');
        return;
      }

      const targetId = patient.id;
      const res = await fetch(`/api/patients/${targetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const backendError = (json && (json.error || json.message)) || '';

        if (
          typeof backendError === 'string' &&
          (backendError.toLowerCase().includes('duplicate') || backendError.toLowerCase().includes('already registered')) &&
          backendError.toLowerCase().includes('regno')
        ) {
          setSaveError('Регистрын дугаар давхцаж байна');
          return;
        }

        setSaveError(backendError || 'Өгөгдөл хадгалах үед алдаа гарлаа');
        return;
      }

      // refresh patient after save
      if (bookNumber && typeof bookNumber === 'string') {
        await fetchPatientData(bookNumber);
      }
      setSaveError('');
      setIsEditing(false);
    } catch (error) {
      setSaveError('Өгөгдөл хадгалах үед алдаа гарлаа');
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSaveError('');
    setRegNoParse({ isValidRegNo: null, reason: '', loading: false });
    setEditForm({
      regNo: patient?.regNo || '',
      birthDate: patient?.birthDate ? patient.birthDate.slice(0, 10) : '',
      gender: patient?.gender || '',
    });
  };

  const tabStyle = (tab) => ({
    padding: '8px 16px',
    border: 'none',
    borderBottom: activeTab === tab ? '2px solid #1d4ed8' : '2px solid transparent',
    background: 'transparent',
    color: activeTab === tab ? '#1d4ed8' : '#6b7280',
    fontWeight: activeTab === tab ? 600 : 400,
    cursor: 'pointer',
    fontSize: 14,
  });

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>
        {patient ? `${patient.ovog || ''} ${patient.name || ''}`.trim() || 'Өвчтөний профайл' : 'Өвчтөний профайл'}
      </h1>

      {/* Tab navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: 16 }}>
        <button type="button" style={tabStyle('profile')} onClick={() => setActiveTab('profile')}>
          Профайл
        </button>
        <button type="button" style={tabStyle('appointments')} onClick={() => setActiveTab('appointments')}>
          Цагууд
        </button>
      </div>

      {/* PROFILE TAB */}
      {activeTab === 'profile' && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, margin: 0 }}>Үндсэн мэдээлэл</h2>
            {!isEditing && (
              <button
                type="button"
                onClick={() => { setSaveError(''); setRegNoParse({ isValidRegNo: null, reason: '', loading: false }); setIsEditing(true); }}
                style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: 13 }}
              >
                Засах
              </button>
            )}
          </div>

          {!isEditing ? (
            // View mode
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: 14 }}>
              <div><span style={{ color: '#6b7280' }}>Регистрын дугаар:</span> {patient?.regNo || '-'}</div>
              <div><span style={{ color: '#6b7280' }}>Нас:</span> {calculateAge(patient?.birthDate)}</div>
              <div><span style={{ color: '#6b7280' }}>Төрсөн огноо:</span> {patient?.birthDate ? patient.birthDate.slice(0, 10) : '-'}</div>
              <div><span style={{ color: '#6b7280' }}>Хүйс:</span> {patient?.gender || '-'}</div>
              <div><span style={{ color: '#6b7280' }}>Утас:</span> {patient?.phone || '-'}</div>
              <div><span style={{ color: '#6b7280' }}>И-мэйл:</span> {patient?.email || '-'}</div>
            </div>
          ) : (
            // Edit mode
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, color: '#374151' }}>Регистрын дугаар</label>
                <input
                  type="text"
                  value={editForm.regNo}
                  onChange={(e) => handleRegNoChange(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }}
                />
                {regNoParse.isValidRegNo === true && (
                  <small style={{ color: '#059669' }}>РД-ээс автоматаар бөглөгдөнө</small>
                )}
                {regNoParse.isValidRegNo === false && regNoParse.reason && (
                  <small style={{ color: '#dc2626' }}>{regNoParse.reason}</small>
                )}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 4, color: '#374151' }}>Төрсөн огноо <span style={{ color: '#6b7280', fontWeight: 400 }}>(Нас: {age})</span></label>
                <input
                  type="date"
                  value={editForm.birthDate}
                  disabled={regNoParse.isValidRegNo === true}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, birthDate: e.target.value }))}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14, boxSizing: 'border-box', background: regNoParse.isValidRegNo === true ? '#f3f4f6' : 'white' }}
                />
                {regNoParse.isValidRegNo === true && (
                  <small style={{ color: '#059669' }}>РД-ээс автоматаар бөглөгдөнө</small>
                )}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 4, color: '#374151' }}>Хүйс</label>
                <input
                  type="text"
                  value={editForm.gender}
                  disabled={regNoParse.isValidRegNo === true}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, gender: e.target.value }))}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14, boxSizing: 'border-box', background: regNoParse.isValidRegNo === true ? '#f3f4f6' : 'white' }}
                />
                {regNoParse.isValidRegNo === true && (
                  <small style={{ color: '#059669' }}>РД-ээс автоматаар бөглөгдөнө</small>
                )}
              </div>

              {saveError && (
                <div style={{ color: '#dc2626', fontSize: 13, padding: '8px', background: '#fef2f2', borderRadius: 4 }}>
                  {saveError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={regNoParse.loading}
                  style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#1d4ed8', color: 'white', cursor: 'pointer', fontSize: 13 }}
                >
                  Хадгалах
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: 13 }}
                >
                  Болих
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ЦАГУУД TAB */}
      {activeTab === 'appointments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Appointments */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: 'white' }}>
            <h2 style={{ fontSize: 16, margin: '0 0 12px 0' }}>Цагийн мэдээлэл</h2>
            {appointments.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: 14 }}>Цаг байхгүй байна</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Огноо</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Эмч</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((apt) => (
                    <tr key={apt.id}>
                      <td style={{ padding: '8px', borderBottom: '1px solid #f3f4f6' }}>
                        {apt.scheduledAt ? new Date(apt.scheduledAt).toLocaleString('mn-MN') : '-'}
                      </td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #f3f4f6' }}>
                        {apt.doctor ? `${apt.doctor.ovog || ''} ${apt.doctor.name || ''}`.trim() || '-' : '-'}
                      </td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #f3f4f6' }}>{apt.status || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Encounter history */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: 'white' }}>
            <h2 style={{ fontSize: 16, margin: '0 0 12px 0' }}>Үзлэгийн түүх</h2>
            {encounters.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: 14 }}>Үзлэг байхгүй байна</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Огноо</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Эмч</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Тэмдэглэл</th>
                  </tr>
                </thead>
                <tbody>
                  {encounters.map((enc) => (
                    <tr key={enc.id}>
                      <td style={{ padding: '8px', borderBottom: '1px solid #f3f4f6' }}>
                        {enc.visitDate ? new Date(enc.visitDate).toLocaleDateString('mn-MN') : '-'}
                      </td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #f3f4f6' }}>
                        {enc.doctor ? `${enc.doctor.ovog || ''} ${enc.doctor.name || ''}`.trim() || '-' : '-'}
                      </td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #f3f4f6' }}>{enc.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientBookPage;
