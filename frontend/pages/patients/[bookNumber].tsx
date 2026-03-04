import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

const PatientBookPage = () => {
    const router = useRouter();
    const { bookNumber } = router.query;
    const [patient, setPatient] = useState(null);
    const [editForm, setEditForm] = useState({ birthDate: '', gender: '', regNo: '' });
    const [isValidRegNo, setIsValidRegNo] = useState(null);
    const [saveError, setSaveError] = useState('');
    const [activeTab, setActiveTab] = useState('profile');

    useEffect(() => {
        // Fetch patient data and initialize state
        const fetchPatientData = async () => {
            const res = await axios.get(`/api/patients/${bookNumber}`);
            setPatient(res.data);
        };

        if (bookNumber) fetchPatientData();
    }, [bookNumber]);

    const handleRegNoChange = async (newRegNo) => {
        setEditForm({ ...editForm, regNo: newRegNo });
        const response = await axios.get(`/api/regno/parse?regNo=${newRegNo}`);
        if (response.data.isValid) {
            setEditForm({ 
                ...editForm,
                birthDate: response.data.birthDate,
                gender: response.data.gender
            });
            setIsValidRegNo(true);
        } else {
            setIsValidRegNo(false);
        }
    };

    const handleSave = async () => {
        try {
            await axios.post(`/api/patients/${bookNumber}`, editForm);
            setSaveError('');
        } catch (error) {
            if (error.response && error.response.data.error === 'duplicate regNo') {
                setSaveError('This regNo is already registered');
            }
            // Handle other errors
        }
    };

    const calculateAge = (birthDate) => {
        if (!birthDate) return '-';
        const ageDifMs = Date.now() - new Date(birthDate).getTime();
        const ageDate = new Date(ageDifMs); // miliseconds from epoch
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    };

    return (
        <div>
            <h1>Үндсэн мэдээлэл</h1>
            <label>Нас: {calculateAge(patient?.birthDate || editForm.birthDate)}</label>
            <div>
                <label>Регистрын дугаар: </label>
                <input 
                    type="text" 
                    value={editForm.regNo} 
                    onChange={(e) => handleRegNoChange(e.target.value)}
                />
                {isValidRegNo === false && <p>{'РД-ээс автоматаар бөглөгдөнө'}</p>}
            </div>
            <div>
                <label>Төрсөн огноо:</label> 
                <input 
                    type="date" 
                    value={editForm.birthDate} 
                    disabled={isValidRegNo === true}
                    onChange={(e) => setEditForm({...editForm, birthDate: e.target.value})}
                />
            </div>
            <div>
                <label>Хүйс:</label> 
                <input 
                    type="text" 
                    value={editForm.gender} 
                    disabled={isValidRegNo === true}
                    onChange={(e) => setEditForm({...editForm, gender: e.target.value})}
                />
            </div>
            <button onClick={handleSave}>Save</button>
            {saveError && <p>{saveError}</p>}
        </div>
    );
};

export default PatientBookPage;
