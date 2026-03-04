import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

const PatientBookPage = () => {
  const router = useRouter();
  const { bookNumber } = router.query;

  const [patient, setPatient] = useState(null);
  const [editForm, setEditForm] = useState({ birthDate: '', gender: '', regNo: '' });

  const [regNoParse, setRegNoParse] = useState({
    isValidRegNo: null,
    reason: '',
    loading: false,
  });

  const [saveError, setSaveError] = useState('');
  const [activeTab, setActiveTab] = useState('profile');

  const lastRegNoRequestIdRef = useRef(0);

  useEffect(() => {
    const fetchPatientData = async () => {
      const res = await axios.get(`/api/patients/${bookNumber}`);
      setPatient(res.data);

      // initialize editForm from patient
      setEditForm({
        regNo: res.data?.regNo || '',
        birthDate: res.data?.birthDate || '',
        gender: res.data?.gender || '',
      });
    };

    if (bookNumber) fetchPatientData();
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

      // Prefer patient.id if available
      const targetId = patient?.id || bookNumber;
      const res = await fetch(`/api/patients/${targetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const backendError = (json && (json.error || json.message)) || '';

        if (typeof backendError === 'string' && backendError.toLowerCase().includes('duplicate') && backendError.toLowerCase().includes('regno')) {
          setSaveError('Регистрын дугаар давхцаж байна');
          return;
        }

        setSaveError(backendError || 'Өгөгдөл хадгалах үед алдаа гарлаа');
        return;
      }

      // refresh patient after save
      const refreshed = await axios.get(`/api/patients/${bookNumber}`);
      setPatient(refreshed.data);
      setSaveError('');
    } catch (error) {
      setSaveError('Өгөгдөл хадгалах үед алдаа гарлаа');
    }
  };

  return (
    <div>
      <h1>Үндсэн мэдээлэл</h1>

      <div>
        <label>Нас: {age}</label>
      </div>

      <div>
        <label>Регистрын дугаар: </label>
        <input type="text" value={editForm.regNo} onChange={(e) => handleRegNoChange(e.target.value)} />
        {regNoParse.isValidRegNo === true && <p>РД-ээс автоматаар бөгл��гдөнө</p>}
        {regNoParse.isValidRegNo === false && regNoParse.reason && <p>{regNoParse.reason}</p>}
      </div>

      <div>
        <label>Төрсөн огноо:</label>
        <input
          type="date"
          value={editForm.birthDate}
          disabled={regNoParse.isValidRegNo === true}
          onChange={(e) => setEditForm((prev) => ({ ...prev, birthDate: e.target.value }))}
        />
        {regNoParse.isValidRegNo === true && <small>РД-ээс автоматаар бөглөгдөнө</small>}
      </div>

      <div>
        <label>Хүйс:</label>
        <input
          type="text"
          value={editForm.gender}
          disabled={regNoParse.isValidRegNo === true}
          onChange={(e) => setEditForm((prev) => ({ ...prev, gender: e.target.value }))}
        />
        {regNoParse.isValidRegNo === true && <small>РД-ээс автоматаар бөглөгдөнө</small>}
      </div>

      <div>
        <label>Нас: {age}</label>
      </div>

      <button onClick={handleSave} disabled={regNoParse.loading}>Save</button>
      {saveError && <p>{saveError}</p>}
    </div>
  );
};

export default PatientBookPage;
