import React, { useEffect, useState } from 'react';
import PatientRegisterForm from '../components/PatientRegisterForm';

export default function PatientsPage() {
  const [patients, setPatients] = useState([]);
  useEffect(() => {
    fetch('/api/patients')
      .then(res => res.json())
      .then(setPatients)
      .catch(() => {});
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h2>Patients</h2>
      <PatientRegisterForm onSuccess={p => setPatients(ps => [p, ...ps])} />
      <table>
        <thead>
          <tr><th>Name</th><th>Citizen ID</th><th>Phone</th><th>Book #</th></tr>
        </thead>
        <tbody>
          {patients.map(p => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.regNo}</td>
              <td>{p.phone}</td>
              <td>{p.patientBook?.bookNumber}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
